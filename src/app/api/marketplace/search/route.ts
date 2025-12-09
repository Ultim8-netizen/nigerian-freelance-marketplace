// src/app/api/marketplace/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; 
// ^ adjust path if your project uses a different Supabase helper

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const query = request.nextUrl.searchParams.get('q') ?? '';

  const { data, error } = await supabase
    .from('products')
    .select('*, seller:profiles(*)')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .eq('is_active', true)
    .order('sales_count', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
