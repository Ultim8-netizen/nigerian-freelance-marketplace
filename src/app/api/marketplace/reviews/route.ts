// src/app/api/marketplace/reviews/route.ts
// PRODUCTION-READY: Product and seller reviews with rating calculations

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { checkRateLimit } from '@/lib/rate-limit-upstash';
import { createClient } from '@/lib/supabase/server';
import { sanitizeHtml, sanitizeUuid } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const createReviewSchema = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().min(10).max(500),
  product_quality: z.number().int().min(1).max(5).optional(),
  delivery_speed: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  images: z.array(z.string().url()).max(5).optional(),
});

// GET - Fetch reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const productId = sanitizeUuid(searchParams.get('product_id') || '');
    const sellerId = sanitizeUuid(searchParams.get('seller_id') || '');
    const orderId = sanitizeUuid(searchParams.get('order_id') || '');

    const supabase = createClient();
    let query = supabase
      .from('marketplace_reviews')
      .select(`
        *,
        reviewer:profiles!marketplace_reviews_reviewer_id_fkey(
          id,
          full_name,
          profile_image_url
        ),
        product:products(id, title, images),
        order:marketplace_orders(id, order_number)
      `);

    if (productId) query = query.eq('product_id', productId);
    if (sellerId) query = query.eq('seller_id', sellerId);
    if (orderId) query = query.eq('order_id', orderId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('Reviews fetch error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST - Create review
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Sanitize inputs
    const sanitized = {
      ...body,
      order_id: sanitizeUuid(body.order_id) || '',
      product_id: sanitizeUuid(body.product_id) || '',
      seller_id: sanitizeUuid(body.seller_id) || '',
      review_text: sanitizeHtml(body.review_text || ''),
      images: Array.isArray(body.images) ? body.images : undefined,
    };

    const validated = createReviewSchema.parse(sanitized);
    const supabase = createClient();

    // Verify order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .select('buyer_id, seller_id, status')
      .eq('id', validated.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.buyer_id !== user.id) {
      logger.warn('Unauthorized review attempt', { orderId: validated.order_id, userId: user.id });
      return NextResponse.json(
        { success: false, error: 'Only buyer can review' },
        { status: 403 }
      );
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: 'Can only review delivered orders' },
        { status: 400 }
      );
    }

    // Check if already reviewed
    const { data: existing } = await supabase
      .from('marketplace_reviews')
      .select('id')
      .eq('order_id', validated.order_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Order already reviewed' },
        { status: 409 }
      );
    }

    // Create review
    const { data: review, error } = await supabase
      .from('marketplace_reviews')
      .insert({
        reviewer_id: user.id,
        ...validated,
      })
      .select()
      .single();

    if (error) throw error;

    // Update product and seller ratings
    await Promise.all([
      updateProductRating(supabase, validated.product_id),
      updateSellerRating(supabase, validated.seller_id),
    ]);

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: validated.seller_id,
      type: 'new_review',
      title: 'New Review Received',
      message: `You received a ${validated.rating}-star review`,
      link: `/marketplace/reviews/${review.id}`,
    });

    logger.info('Review created', { reviewId: review.id, userId: user.id, rating: validated.rating });

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    logger.error('Review creation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

// Helper: Update product average rating
async function updateProductRating(supabase: SupabaseClient, productId: string) {
  try {
    const { data: reviews } = await supabase
      .from('marketplace_reviews')
      .select('rating')
      .eq('product_id', productId);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      
      await supabase
        .from('products')
        .update({
          rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          reviews_count: reviews.length,
        })
        .eq('id', productId);
    }
  } catch (error) {
    logger.error('Failed to update product rating', { error, productId });
  }
}

// Helper: Update seller average rating
async function updateSellerRating(supabase: SupabaseClient, sellerId: string) {
  try {
    const { data: reviews } = await supabase
      .from('marketplace_reviews')
      .select('rating')
      .eq('seller_id', sellerId);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      
      await supabase
        .from('profiles')
        .update({
          marketplace_rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          marketplace_reviews_count: reviews.length,
        })
        .eq('id', sellerId);
    }
  } catch (error) {
    logger.error('Failed to update seller rating', { error, sellerId });
  }
}