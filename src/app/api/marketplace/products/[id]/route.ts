// src/app/api/marketplace/products/[id]/route.ts
// Individual product operations

import { NextRequest as Req, NextResponse as Res } from 'next/server';
import { requireAuth as auth, requireOwnership as ownership } from '@/lib/api/middleware';
import { checkRateLimit as rateLimit } from '@/lib/rate-limit-upstash';
import { createClient as client } from '@/lib/supabase/server';
import { sanitizeUuid as uuid, sanitizeText as text, sanitizeHtml as html } from '@/lib/security/sanitize';
import { logger as log } from '@/lib/logger';
import { z as Z } from 'zod';

const updateSchema = Z.object({
  title: Z.string().min(10).max(200).optional(),
  description: Z.string().min(20).max(2000).optional(),
  price: Z.number().min(100).max(10000000).optional(),
  images: Z.array(Z.string()).min(1).max(8).optional(),
  condition: Z.enum(['new', 'like_new', 'used']).optional(),
  is_active: Z.boolean().optional(),
});

// GET - Get product details
export async function GET(
  req: Req,
  { params }: { params: { id: string } }
) {
  try {
    const productId = uuid(params.id);
    if (!productId) {
      return Res.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit('api', ip);
    if (!rateLimitResult.success) {
      return Res.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const supabase = client();
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id, full_name, profile_image_url,
          freelancer_rating, total_jobs_completed,
          identity_verified, created_at, location
        )
      `)
      .eq('id', productId)
      .single();

    if (error || !product) {
      log.warn('Product not found', { productId });
      return Res.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Increment views
    supabase
      .from('products')
      .update({ views_count: (product.views_count || 0) + 1 })
      .eq('id', productId)
      .then();

    return Res.json({ success: true, data: product });
  } catch (error) {
    log.error('Product fetch error', error as Error);
    return Res.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PATCH - Update product
export async function PATCH(
  req: Req,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await auth(req);
    if (authResult instanceof Res) return authResult;
    const { user } = authResult;

    const productId = uuid(params.id);
    if (!productId) {
      return Res.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const ownershipResult = await ownership(req, 'products', productId, 'seller_id');
    if (ownershipResult instanceof Res) return ownershipResult;

    const rateLimitResult = await rateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return Res.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const body = await req.json();
    const sanitized = {
      ...body,
      title: body.title ? text(body.title) : undefined,
      description: body.description ? html(body.description) : undefined,
    };

    const validated = updateSchema.parse(sanitized);
    const supabase = client();

    const { data: updated, error } = await supabase
      .from('products')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      log.error('Product update failed', error, { productId, userId: user.id });
      throw error;
    }

    log.info('Product updated', { productId, userId: user.id });

    return Res.json({
      success: true,
      data: updated,
      message: 'Product updated successfully',
    });
  } catch (error) {
    if (error instanceof Z.ZodError) {
      return Res.json(
        { success: false, error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    log.error('Product update error', error as Error);
    return Res.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE - Delete product
export async function DELETE(
  req: Req,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await auth(req);
    if (authResult instanceof Res) return authResult;
    const { user } = authResult;

    const productId = uuid(params.id);
    if (!productId) {
      return Res.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const supabase = client();
    const { data: product } = await supabase
      .from('products')
      .select('seller_id, sales_count')
      .eq('id', productId)
      .single();

    if (!product) {
      return Res.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (product.seller_id !== user.id) {
      log.warn('Unauthorized delete attempt', { productId, userId: user.id });
      return Res.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Soft delete if has sales
    if (product.sales_count > 0) {
      await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);
    } else {
      await supabase.from('products').delete().eq('id', productId);
    }

    log.info('Product deleted', { productId, userId: user.id });

    return Res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    log.error('Product deletion error', error as Error);
    return Res.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}