// src/app/api/marketplace/reviews/route.ts
// PRODUCTION-READY: Product and seller reviews with rating calculations
// + configurable consecutive low-rating posting suspension
//
// FIX: consecutive_low_rating_threshold and posting_suspension_hours read
//      from platform_config via createAdminClient().
// FIX: checkAndSuspendPostingOnConsecutiveLowRatings fires dual-channel on
//      new suspensions: bell notification + F9 inbox message.
// FIX: requireAuth imported from enhanced-middleware (canonical).
// FIX: updateProductRating uses adminClient for the products UPDATE (reviewer
//      session cannot satisfy products' RLS UPDATE policy).
// FIX: updateSellerRating REMOVED. Schema confirmed (database.types.ts +
//      Supabase CSV export): profiles has NO marketplace_rating or
//      marketplace_reviews_count columns. Every call was writing to
//      non-existent columns — either silently ignored or erroring. The
//      seller's gig-domain freelancer_rating (maintained by the
//      update_freelancer_rating RPC from gig reviews) must not be overwritten
//      by marketplace reviews. Product-level ratings are correctly maintained
//      via updateProductRating → products.rating / products.reviews_count.
//      A future schema migration adding marketplace_rating to profiles would
//      allow restoring a seller-level marketplace rating here.
// FIX: "new_review" notification insert uses adminClient.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth }               from '@/lib/api/enhanced-middleware';
import { checkRateLimit }            from '@/lib/rate-limit-upstash';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { sanitizeHtml, sanitizeUuid } from '@/lib/security/sanitize';
import { logger }                    from '@/lib/logger';
import { z }                         from 'zod';
import { getPlatformConfigs, CONFIG_KEYS } from '@/lib/platform-config';
import { sendF9SystemMessage }       from '@/lib/messaging/system-message';
import type { SupabaseClient }       from '@supabase/supabase-js';

const createReviewSchema = z.object({
  order_id:        z.string().uuid(),
  product_id:      z.string().uuid(),
  seller_id:       z.string().uuid(),
  rating:          z.number().int().min(1).max(5),
  review_text:     z.string().min(10).max(500),
  product_quality: z.number().int().min(1).max(5).optional(),
  delivery_speed:  z.number().int().min(1).max(5).optional(),
  communication:   z.number().int().min(1).max(5).optional(),
  images:          z.array(z.string().url()).max(5).optional(),
});

// GET - Fetch reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const productId = sanitizeUuid(searchParams.get('product_id') || '');
    const sellerId  = sanitizeUuid(searchParams.get('seller_id')  || '');
    const orderId   = sanitizeUuid(searchParams.get('order_id')   || '');

    const supabase = await createClient();
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
    if (sellerId)  query = query.eq('seller_id',  sellerId);
    if (orderId)   query = query.eq('order_id',   orderId);

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
    const supabase = await createClient();

    const authResult = await requireAuth(request, supabase);
    if (authResult.error) return authResult.error;
    const user = authResult.user!;

    const rateLimitResult = await checkRateLimit('api', user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const body = await request.json();

    const sanitized = {
      ...body,
      order_id:    sanitizeUuid(body.order_id)   || '',
      product_id:  sanitizeUuid(body.product_id) || '',
      seller_id:   sanitizeUuid(body.seller_id)  || '',
      review_text: sanitizeHtml(body.review_text || ''),
      images: Array.isArray(body.images) ? body.images : undefined,
    };

    const validated = createReviewSchema.parse(sanitized);

    // Service-role client required for platform_config reads (admin-only RLS),
    // products UPDATE (reviewer session cannot satisfy seller_id RLS), and
    // notifications INSERT (no INSERT policy for user-scoped clients).
    const adminClient = createAdminClient();
    const config = await getPlatformConfigs(adminClient, [
      CONFIG_KEYS.CONSECUTIVE_LOW_RATING_THRESHOLD,
      CONFIG_KEYS.POSTING_SUSPENSION_HOURS,
    ]);

    const consecutiveThreshold   = config[CONFIG_KEYS.CONSECUTIVE_LOW_RATING_THRESHOLD];
    const postingSuspensionHours = config[CONFIG_KEYS.POSTING_SUSPENSION_HOURS];

    // ── Order guard ─────────────────────────────────────────────────────────
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
      logger.warn('Unauthorized review attempt', {
        orderId: validated.order_id,
        userId:  user.id,
      });
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

    // ── Duplicate guard ──────────────────────────────────────────────────────
    // marketplace_reviews.order_id has a unique constraint (isOneToOne: true).
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

    // ── Insert review ────────────────────────────────────────────────────────
    const { data: review, error } = await supabase
      .from('marketplace_reviews')
      .insert({ reviewer_id: user.id, ...validated })
      .select()
      .single();

    if (error) throw error;

    // ── Post-insert side-effects ─────────────────────────────────────────────
    // updateProductRating: correctly persists products.rating and
    // products.reviews_count — both confirmed NOT NULL (numeric/integer, NO)
    // in the schema with default 0. adminClient bypasses the products RLS
    // UPDATE policy (auth.uid() = seller_id) which the reviewer never satisfies.
    //
    // updateSellerRating is intentionally absent. Schema confirmed: profiles
    // has no marketplace_rating or marketplace_reviews_count columns. The call
    // was writing to non-existent columns on every review. Product-level ratings
    // (products.rating) are the correct per-listing reputation signal in the
    // marketplace domain. A marketplace_rating column on profiles requires a
    // future migration before seller-level aggregation can be persisted.
    await updateProductRating(supabase, adminClient, validated.product_id);

    // Notify seller of new review
    await adminClient.from('notifications').insert({
      user_id: validated.seller_id,
      type:    'new_review',
      title:   'New Review Received',
      message: `You received a ${validated.rating}-star review`,
      link:    `/marketplace/reviews/${review.id}`,
    });

    // ── Consecutive low-rating check → configurable posting suspension ────────
    await checkAndSuspendPostingOnConsecutiveLowRatings(
      supabase,
      adminClient,
      validated.seller_id,
      consecutiveThreshold,
      postingSuspensionHours,
    );

    logger.info('Review created', {
      reviewId: review.id,
      userId:   user.id,
      rating:   validated.rating,
    });

    return NextResponse.json(
      {
        success: true,
        data:    review,
        message: 'Review submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Validation failed' },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recalculate and persist products.rating and products.reviews_count.
 * Schema: both columns are NOT NULL (numeric/integer) with default 0.
 *
 * @param readClient  Reviewer's session — sufficient for marketplace_reviews SELECT.
 * @param adminClient Service-role — required for products UPDATE (RLS: seller_id = uid).
 */
async function updateProductRating(
  readClient:  SupabaseClient,
  adminClient: SupabaseClient,
  productId:   string,
) {
  try {
    const { data: reviews } = await readClient
      .from('marketplace_reviews')
      .select('rating')
      .eq('product_id', productId);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      const { error } = await adminClient
        .from('products')
        .update({
          rating:        Math.round(avgRating * 10) / 10,
          reviews_count: reviews.length,
        })
        .eq('id', productId);

      if (error) {
        logger.error('Failed to persist product rating update', error, { productId });
      }
    }
  } catch (err) {
    logger.error('Failed to update product rating', err as Error, { productId });
  }
}

/**
 * After every new review, fetch the seller's N most recent marketplace reviews.
 * If every one is 1-star, suspend posting for suspensionHours.
 *
 * @param readClient           Reviewer session — sufficient for SELECTs.
 * @param adminClient          Service-role — required for profiles UPDATE and
 *                             notifications INSERT.
 * @param sellerId             Target seller.
 * @param consecutiveThreshold From platform_config.
 * @param suspensionHours      From platform_config.
 */
async function checkAndSuspendPostingOnConsecutiveLowRatings(
  readClient:           SupabaseClient,
  adminClient:          SupabaseClient,
  sellerId:             string,
  consecutiveThreshold: number,
  suspensionHours:      number,
) {
  try {
    const { data: recentReviews, error: reviewsError } = await readClient
      .from('marketplace_reviews')
      .select('rating')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(consecutiveThreshold);

    if (reviewsError) {
      logger.error(
        'Failed to fetch recent seller reviews for posting suspension check',
        reviewsError,
        { sellerId }
      );
      return;
    }

    if (!recentReviews || recentReviews.length < consecutiveThreshold) return;

    const allOneStar = recentReviews.every((r) => r.rating === 1);
    if (!allOneStar) return;

    const { data: profile, error: profileError } = await readClient
      .from('profiles')
      .select('posting_suspended_until')
      .eq('id', sellerId)
      .single();

    if (profileError) {
      logger.error(
        'Failed to fetch seller profile for posting suspension check',
        profileError,
        { sellerId }
      );
      return;
    }

    const now                = new Date();
    const existingSuspension = profile?.posting_suspended_until
      ? new Date(profile.posting_suspended_until)
      : null;

    const suspendedUntil = new Date(
      now.getTime() + suspensionHours * 60 * 60 * 1000
    ).toISOString();

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ posting_suspended_until: suspendedUntil })
      .eq('id', sellerId);

    if (updateError) {
      logger.error(
        'Failed to set posting_suspended_until after consecutive 1-star reviews',
        updateError,
        { sellerId }
      );
      return;
    }

    const isNewSuspension = !existingSuspension || existingSuspension <= now;
    if (isNewSuspension) {
      const advisoryMessage =
        `You have received ${consecutiveThreshold} consecutive 1-star reviews. ` +
        `Your ability to create new listings has been suspended for ${suspensionHours} hours. ` +
        'Existing listings and your account remain active. ' +
        'Contact support if you believe this is in error.';

      await Promise.all([
        adminClient.from('notifications').insert({
          user_id: sellerId,
          type:    'posting_suspended',
          title:   `Posting Privileges Suspended (${suspensionHours} Hours)`,
          message: advisoryMessage,
        }),
        sendF9SystemMessage(adminClient, sellerId, advisoryMessage),
      ]);
    }

    logger.warn('Seller posting suspended after consecutive 1-star reviews', {
      sellerId,
      suspendedUntil,
      consecutiveThreshold,
      suspensionHours,
      wasAlreadySuspended: !isNewSuspension,
    });
  } catch (err) {
    logger.error(
      'Unexpected error in consecutive low-rating posting suspension check',
      err as Error,
      { sellerId }
    );
  }
}