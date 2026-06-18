// src/types/marketplace.types.ts
// All types derived from database.types.ts (source of truth).
// Hand-rolled interfaces are retired — they diverged from the schema on
// nullability (images, is_active, sales_count, views_count) and were
// missing fields present in the DB (platform_fee, seller_earnings).
//
// Base entity types (Product, MarketplaceOrder, MarketplaceReview) are
// exported from '@/types' as Tables<'...'> aliases. This file owns only
// the join-extended shapes that components and server components consume.

import type { Tables } from './database.types';

// ─── Seller join shape ────────────────────────────────────────────────────────
// Matches the SELECT column list used by:
//   products/route.ts GET — explicit column list
//   products/[id]/route.ts GET — explicit column list
//   marketplace/page.tsx — wildcard join (superset, safely assignable)
//
// Note: profiles has NO marketplace_rating or marketplace_reviews_count columns.
// The only rating field is freelancer_rating (gig domain). Marketplace product
// ratings live on products.rating / products.reviews_count and are the correct
// source for marketplace display.
export type ProductSeller = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  freelancer_rating: number | null;
  total_jobs_completed: number | null;
  identity_verified: boolean | null;
  location: string | null;
  created_at: string | null;
};

// ─── ProductWithSeller ────────────────────────────────────────────────────────
// Shape returned by any products SELECT that LEFT JOINs profiles.
// seller is optional/nullable because PostgREST returns null for the join
// object when the FK target row is missing (should not happen in production
// but the type must reflect what the client library actually emits).
export type ProductWithSeller = Tables<'products'> & {
  seller?: ProductSeller | null;
};

// ─── MarketplaceOrderWithRelations ───────────────────────────────────────────
// Shape returned by marketplace_orders SELECT with buyer/seller/product joins.
// platform_fee and seller_earnings are NOT NULL in the schema (numeric, NO, 0).
export type MarketplaceOrderWithRelations = Tables<'marketplace_orders'> & {
  product?: Tables<'products'> | null;
  buyer?:   Pick<Tables<'profiles'>, 'id' | 'full_name' | 'profile_image_url' | 'email'> | null;
  seller?:  Pick<Tables<'profiles'>, 'id' | 'full_name' | 'profile_image_url' | 'email'> | null;
};

// ─── MarketplaceReviewWithRelations ──────────────────────────────────────────
// Shape returned by marketplace_reviews SELECT with reviewer/product/order joins.
export type ReviewerShape = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
};

export type MarketplaceReviewWithRelations = Tables<'marketplace_reviews'> & {
  reviewer?: ReviewerShape | null;
  product?:  Pick<Tables<'products'>, 'id' | 'title' | 'images'> | null;
  order?:    Pick<Tables<'marketplace_orders'>, 'id' | 'order_number'> | null;
};