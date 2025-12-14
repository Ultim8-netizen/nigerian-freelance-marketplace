// src/app/marketplace/sell/page.tsx
// NEW FILE: Redirect /marketplace/sell to proper product creation route

import { redirect } from 'next/navigation';

export default function MarketplaceSellPage() {
  // Redirect to the actual product creation page
  redirect('/marketplace/seller/products/new');
}