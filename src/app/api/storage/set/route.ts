/ src/app/api/storage/set/route.ts
export async function POST_SET(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const { key, value, shared } = await request.json();

    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('artifact_storage')
      .upsert({
        key,
        value,
        shared: shared || false,
        user_id: user.id,
      })
      .select()
      .single();

    if (queryError) throw queryError;

    return NextResponse.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
