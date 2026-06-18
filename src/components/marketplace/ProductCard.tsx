'use client';

// src/components/marketplace/ProductCard.tsx
// FIX: uses ProductWithSeller (schema-derived) instead of the retired
//      hand-rolled Product interface from marketplace.types.ts.
// FIX: displays product.rating instead of seller.freelancer_rating.
//      product.rating is the product's marketplace rating (NOT NULL, default 0,
//      maintained by updateProductRating in reviews/route.ts).
//      seller.freelancer_rating is the gig-domain rating — wrong signal for
//      marketplace product browsing and semantically distinct from how the
//      seller performs as a product seller.
// FIX: product.sales_count ?? 0 — sales_count is integer | null in the schema.

import Image from 'next/image';
import Link from 'next/link';
import type { ProductWithSeller } from '@/types/marketplace.types';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Star } from 'lucide-react';

interface ProductCardProps {
  product: ProductWithSeller;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/marketplace/products/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative h-48 bg-gray-200">
          {/* images is string[] | null per schema */}
          <Image
            src={product.images?.[0] ?? ''}
            alt={product.title}
            fill
            className="object-cover"
          />
          {product.condition === 'new' && (
            <Badge className="absolute top-2 right-2 bg-green-600">New</Badge>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold mb-2 line-clamp-2">{product.title}</h3>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xl font-bold text-blue-600">
              {formatCurrency(product.price)}
            </span>
            {product.seller?.identity_verified && (
              <Badge variant="outline" className="text-xs">✓ Verified</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
            {/* product.rating: NOT NULL numeric, default 0 — no null guard needed. */}
            <span>{product.rating.toFixed(1)}</span>
            {/* sales_count: integer | null — guard required. */}
            <span>• {product.sales_count ?? 0} sold</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}