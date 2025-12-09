// src/app/api/marketplace/reviews/route.ts
// Product and seller reviews

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const productId = searchParams.get('product_id');
    const sellerId = searchParams.get('seller_id');
    const orderId = searchParams.get('order_id');

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
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST - Create review
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = createReviewSchema.parse(body);

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

    // Update product rating
    await updateProductRating(supabase, validated.product_id);
    
    // Update seller rating
    await updateSellerRating(supabase, validated.seller_id);

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: validated.seller_id,
      type: 'new_review',
      title: 'New Review Received',
      message: `You received a ${validated.rating}-star review`,
      link: `/marketplace/reviews/${review.id}`,
    });

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Review creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

// Helper: Update product average rating
async function updateProductRating(supabase: any, productId: string) {
  const { data: reviews } = await supabase
    .from('marketplace_reviews')
    .select('rating')
    .eq('product_id', productId);

  if (reviews && reviews.length > 0) {
    const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
    
    await supabase
      .from('products')
      .update({
        rating: avgRating,
        reviews_count: reviews.length,
      })
      .eq('id', productId);
  }
}

// Helper: Update seller average rating
async function updateSellerRating(supabase: any, sellerId: string) {
  const { data: reviews } = await supabase
    .from('marketplace_reviews')
    .select('rating')
    .eq('seller_id', sellerId);

  if (reviews && reviews.length > 0) {
    const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length;
    
    await supabase
      .from('profiles')
      .update({
        marketplace_rating: avgRating,
        marketplace_reviews_count: reviews.length,
      })
      .eq('id', sellerId);
  }
}