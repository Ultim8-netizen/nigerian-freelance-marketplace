// src/app/api/marketplace/search/route.ts
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const query = request.nextUrl.searchParams.get('q');
  
  const { data } = await supabase
    .from('products')
    .select('*, seller:profiles(*)')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .eq('is_active', true)
    .order('sales_count', { ascending: false })
    .limit(50);
  
  return NextResponse.json({ success: true, data });
}