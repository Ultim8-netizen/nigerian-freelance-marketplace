// src/lib/marketplace/categories.ts
// Canonical product category list for the marketplace domain.
//
// This is the single source of truth for `products.category` values.
// Both the listing creation form (CreateProductForm) and the browse/search
// filters (Filters.tsx, marketplace/page.tsx, search/route.ts) must use
// these exact strings — previously CreateProductForm slugified its own
// divergent list ('electronics-gadgets', etc.) which never matched the
// plain-label values ('Electronics', 'Books & Stationery', etc.) that the
// filters queried against, making category filtering a permanent no-op.

export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Textbooks',
  'Books & Stationery',
  'Home & Kitchen',
  'Furniture',
  'Sports & Outdoors',
  'Beauty & Health',
  'Food & Drinks',
  'Services',
  'Other',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];