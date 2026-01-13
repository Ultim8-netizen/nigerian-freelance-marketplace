import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Star } from 'lucide-react';

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`*, reviewer:profiles!reviews_reviewer_id_fkey(full_name)`)
    .eq('reviewee_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Reviews</h1>
      <div className="space-y-4">
        {reviews?.map((review) => (
          <Card key={review.id} className="p-6">
             <div className="flex justify-between mb-2">
                 <h3 className="font-semibold">{review.reviewer?.full_name || 'Client'}</h3>
                 <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                 </div>
             </div>
             <p className="text-gray-600">{review.review_text}</p>
          </Card>
        ))}
        {(!reviews || reviews.length === 0) && (
            <Card className="p-8 text-center text-gray-500">No reviews yet.</Card>
        )}
      </div>
    </div>
  );
}