// src/app/api/marketplace/products/[id]/route.ts
// Individual product operations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProductSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  description: z.string().min(20).max(2000).optional(),
  price: z.number().min(100).max(10000000).optional(),
  images: z.array(z.string()).min(1).max(8).optional(),
  condition: z.enum(['new', 'like_new', 'used']).optional(),
  is_active: z.boolean().optional(),
});

// GET - Get product details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id,
          full_name,
          profile_image_url,
          freelancer_rating,
          total_jobs_completed,
          identity_verified,
          created_at
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Increment view count
    await supabase
      .from('products')
      .update({ views_count: (product.views_count || 0) + 1 })
      .eq('id', params.id);

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PATCH - Update product (seller only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const { data: product } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', params.id)
      .single();

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    if (product.seller_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateProductSchema.parse(body);

    const { data: updated, error } = await supabase
      .from('products')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Product updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Product update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Delete product (seller only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const { data: product } = await supabase
      .from('products')
      .select('seller_id, sales_count')
      .eq('id', params.id)
      .single();

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    if (product.seller_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Soft delete if has sales
    if (product.sales_count > 0) {
      await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', params.id);
    } else {
      await supabase
        .from('products')
        .delete()
        .eq('id', params.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}