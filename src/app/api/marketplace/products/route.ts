// src/app/api/marketplace/products/route.ts
// PRODUCTION-READY: Marketplace products with full security

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { sanitizeText, sanitizeHtml, sanitizeUrl } from '@/lib/security/sanitize';
import { containsSqlInjection } from '@/lib/security/sql-injection-check';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const productSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(20).max(2000),
  price: z.number().min(100).max(10000000),
  category: z.string(),
  images: z.array(z.string()).min(1).max(8),
  condition: z.enum(['new', 'like_new', 'used']),
  delivery_options: z.array(z.string()).min(1),
});

// GET - Browse products
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const category = sanitizeText(searchParams.get('category') || '');
    const search = sanitizeText(searchParams.get('search') || '');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const condition = searchParams.get('condition');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20')));

    // SQL injection check
    if (search && containsSqlInjection(search)) {
      logger.warn('SQL injection attempt in product search', { 
        search, 
        ip: request.headers.get('x-forwarded-for') 
      });
      return NextResponse.json(
        { success: false, error: 'Invalid search query' },
        { status: 400 }
      );
    }

    // Rate limiting for reads
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit('api', ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id, full_name, profile_image_url, 
          freelancer_rating, identity_verified
        )
      `, { count: 'exact' })
      .eq('is_active', true);
    
    // Filters
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('title', `%${search}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (condition) query = query.eq('condition', condition);
    
    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      logger.error('Products fetch error', error);
      throw error;
    }

    logger.info('Products query executed', {
      filters: { category, search },
      resultCount: data?.length || 0
    });

    return NextResponse.json({ 
      success: true, 
      data,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      }
    });
  } catch (error) {
    logger.error('Products GET error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST - Create product
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // 2. Rate limiting (10 products per day)
    const rateLimitResult = await checkRateLimit('createService', user.id);
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for product creation', { userId: user.id });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many product creations. Please try again later.',
          resetAt: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }

    // 3. Parse and sanitize
    const body = await request.json();
    
    const sanitizedBody = {
      ...body,
      title: sanitizeText(body.title || ''),
      description: sanitizeHtml(body.description || ''),
      category: sanitizeText(body.category || ''),
      images: body.images?.map((url: string) => sanitizeUrl(url)).filter(Boolean) || [],
      delivery_options: body.delivery_options?.map((opt: string) => sanitizeText(opt)) || [],
    };

    // 4. Validate
    const validated = productSchema.parse(sanitizedBody);
    
    const supabase = createClient();

    // 5. Create product
    const { data, error } = await supabase
      .from('products')
      .insert({ 
        seller_id: user.id, 
        ...validated,
        is_active: true,
        views_count: 0,
        sales_count: 0,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Product creation failed', error, { userId: user.id });
      throw error;
    }

    logger.info('Product created', { productId: data.id, userId: user.id });

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Product created successfully'
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Product creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}