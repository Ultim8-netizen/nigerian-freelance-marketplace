// src/app/api/storage/list/route.ts
export async function POST_LIST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const { prefix, shared } = await request.json();

    const supabase = createClient();
    let query = supabase
      .from('artifact_storage')
      .select('key')
      .eq('shared', shared || false)
      .eq('user_id', user.id);

    if (prefix) {
      query = query.ilike('key', `${prefix}%`);
    }

    const { data, error: queryError } = await query;

    if (queryError) throw queryError;

    return NextResponse.json({
      keys: data.map(d => d.key),
      prefix,
      shared: shared || false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}