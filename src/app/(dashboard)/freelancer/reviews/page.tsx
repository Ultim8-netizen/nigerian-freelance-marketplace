// src/app/(dashboard)/freelancer/reviews/page.tsx
// FIXED: This page was returning 404 - file now exists

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Star, MessageCircle } from 'lucide-react';

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, profile_image_url),
      order:orders(title)
    `)
    .eq('reviewee_id', user.id)
    .order('created_at', { ascending: false });

  const averageRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reviews & Ratings</h1>
        <p className="text-gray-600">See what clients say about your work</p>
      </div>

      {/* Rating Summary */}
      {reviews && reviews.length > 0 && (
        <Card className="p-6 mb-8 bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600">{averageRating}</div>
              <div className="flex gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(parseFloat(averageRating as string))
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">{reviews.length} reviews</p>
            </div>
            <div className="flex-1">
              <p className="text-gray-700 dark:text-gray-300">
                Based on {reviews.length} client review{reviews.length !== 1 ? 's' : ''}, you have an excellent rating!
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews && reviews.length > 0 ? (
          reviews.map((review) => (
            <Card key={review.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shrink-0">
                  {review.reviewer?.full_name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {review.reviewer?.full_name || 'Client'}
                    </h3>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.order?.title && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      Project: {review.order.title}
                    </p>
                  )}
                </div>
              </div>

              {review.review_text && (
                <p className="text-gray-700 dark:text-gray-300 mb-4">{review.review_text}</p>
              )}

              {/* Detailed Ratings */}
              {(review.communication_rating || review.quality_rating || review.professionalism_rating) && (
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {review.communication_rating && (
                    <div className="text-sm">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Communication</p>
                      <div className="flex gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < review.communication_rating
                                ? 'fill-blue-400 text-blue-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.quality_rating && (
                    <div className="text-sm">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Quality</p>
                      <div className="flex gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < review.quality_rating
                                ? 'fill-blue-400 text-blue-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.professionalism_rating && (
                    <div className="text-sm">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Professionalism</p>
                      <div className="flex gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < review.professionalism_rating
                                ? 'fill-blue-400 text-blue-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-4">
                {new Date(review.created_at).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Reviews Yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Complete your first order to receive reviews from clients
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}