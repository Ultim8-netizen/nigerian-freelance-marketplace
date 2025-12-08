// src/app/api/marketplace/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const productSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(20).max(2000),
  price: z.number().min(100).max(10000000),
  category: z.string(),
  images: z.array(z.string()).min(1).max(8),
  condition: z.enum(['new', 'like_new', 'used']),
  delivery_options: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json();
  const validated = productSchema.parse(body);
  
  const { data, error } = await supabase
    .from('products')
    .insert({ seller_id: user.id, ...validated })
    .select()
    .single();
  
  if (error) throw error;
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  let query = supabase
    .from('products')
    .select(`
      *,
      seller:profiles!products_seller_id_fkey(
        id, full_name, profile_image_url, 
        freelancer_rating, identity_verified
      )
    `)
    .eq('is_active', true);
  
  // Filters
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');
  
  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search}%`);
  if (minPrice) query = query.gte('price', parseFloat(minPrice));
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return NextResponse.json({ success: true, data });
}