// src/app/marketplace/products/[id]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ImageGallery } from '@/components/cloudinary/ImageGallery';
import { 
  Star, MapPin, Package, Shield, Clock, 
  MessageCircle, Share2, Heart, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';
import { BuyNowButton } from '@/components/marketplace/BuyNowButton';

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch product with seller info
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
        created_at,
        location
      )
    `)
    .eq('id', params.id)
    .single();

  if (error || !product) {
    notFound();
  }

  // Fetch seller's other products
  const { data: sellerProducts } = await supabase
    .from('products')
    .select('id, title, price, images, condition')
    .eq('seller_id', product.seller_id)
    .eq('is_active', true)
    .neq('id', params.id)
    .limit(4);

  // Fetch reviews
  const { data: reviews } = await supabase
    .from('marketplace_reviews')
    .select(`
      *,
      reviewer:profiles!marketplace_reviews_reviewer_id_fkey(
        full_name,
        profile_image_url
      )
    `)
    .eq('product_id', params.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const isOwnProduct = user?.id === product.seller_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center space-x-2">
            <li><Link href="/marketplace" className="text-blue-600 hover:underline">Marketplace</Link></li>
            <li className="text-gray-400">/</li>
            <li><Link href={`/marketplace?category=${product.category}`} className="text-blue-600 hover:underline">{product.category}</Link></li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-600 truncate max-w-[200px]">{product.title}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Images */}
          <div className="lg:col-span-2">
            <Card className="p-6 mb-6">
              <ImageGallery images={product.images} alt={product.title} />
            </Card>

            {/* Description */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Description</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">{product.description}</p>
              </div>
            </Card>

            {/* Product Details */}
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Product Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Condition</dt>
                  <dd className="font-medium capitalize">{product.condition}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Category</dt>
                  <dd className="font-medium">{product.category}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Posted</dt>
                  <dd className="font-medium">{formatRelativeTime(product.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Sales</dt>
                  <dd className="font-medium">{product.sales_count} sold</dd>
                </div>
              </dl>
            </Card>

            {/* Reviews Section */}
            {reviews && reviews.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Customer Reviews</h2>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 fill-yellow-400 stroke-yellow-400" />
                    <span className="font-semibold">{product.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-gray-500">({product.reviews_count} reviews)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-start gap-3">
                        {review.reviewer.profile_image_url ? (
                          <Image
                            src={review.reviewer.profile_image_url}
                            alt={review.reviewer.full_name}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            {review.reviewer.full_name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{review.reviewer.full_name}</span>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < review.rating
                                      ? 'fill-yellow-400 stroke-yellow-400'
                                      : 'stroke-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{review.review_text}</p>
                          <span className="text-xs text-gray-400">
                            {formatRelativeTime(review.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Link href={`/marketplace/products/${product.id}/reviews`}>
                  <Button variant="outline" className="w-full mt-4">
                    View All Reviews
                  </Button>
                </Link>
              </Card>
            )}
          </div>

          {/* Right Column - Purchase Card */}
          <div>
            <Card className="p-6 sticky top-4">
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          product.rating && i < product.rating
                            ? 'fill-yellow-400 stroke-yellow-400'
                            : 'stroke-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    ({product.reviews_count || 0} reviews)
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {formatCurrency(product.price)}
                  </span>
                  {product.condition === 'new' && (
                    <Badge variant="success">New</Badge>
                  )}
                </div>
              </div>

              {!isOwnProduct ? (
                <>
                  <BuyNowButton productId={product.id} className="w-full mb-3" />
                  <Link href={`/marketplace/products/${product.id}/contact`}>
                    <Button variant="outline" className="w-full mb-3">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Contact Seller
                    </Button>
                  </Link>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="flex-1">
                      <Heart className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="flex-1">
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </>
              ) : (
                <Link href={`/marketplace/seller/products/${product.id}/edit`}>
                  <Button className="w-full">Edit Product</Button>
                </Link>
              )}

              <div className="mt-6 pt-6 border-t space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>Buyer Protection Guarantee</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Delivery: {product.delivery_options?.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span>{product.views_count} views</span>
                </div>
              </div>
            </Card>

            {/* Seller Info */}
            <Card className="p-6 mt-4">
              <h3 className="font-semibold mb-4">Seller Information</h3>
              <Link href={`/marketplace/sellers/${product.seller_id}`}>
                <div className="flex items-center gap-3 mb-4 hover:bg-gray-50 p-2 rounded transition-colors">
                  {product.seller.profile_image_url ? (
                    <Image
                      src={product.seller.profile_image_url}
                      alt={product.seller.full_name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                      {product.seller.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.seller.full_name}</span>
                      {product.seller.identity_verified && (
                        <Badge variant="success" className="text-xs">✓ Verified</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                      <span>{product.seller.freelancer_rating.toFixed(1)}</span>
                      <span className="text-gray-400">•</span>
                      <span>{product.seller.total_jobs_completed} sales</span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="space-y-2 text-sm">
                {product.seller.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{product.seller.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Joined {formatRelativeTime(product.seller.created_at)}</span>
                </div>
              </div>

              <Link href={`/marketplace/sellers/${product.seller_id}`}>
                <Button variant="outline" className="w-full mt-4">
                  View Seller Profile
                </Button>
              </Link>
            </Card>

            {/* Safety Tips */}
            <Card className="p-4 mt-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900 mb-1">Safety Tips</p>
                  <ul className="text-yellow-800 space-y-1 text-xs">
                    <li>• Meet in public places</li>
                    <li>• Check the item before paying</li>
                    <li>• Pay only after delivery</li>
                    <li>• Report suspicious activity</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* More from Seller */}
        {sellerProducts && sellerProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">More from {product.seller.full_name}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {sellerProducts.map((item) => (
                <Link key={item.id} href={`/marketplace/products/${item.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-48 bg-gray-200">
                      <Image
                        src={item.images[0]}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2">{item.title}</h3>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}