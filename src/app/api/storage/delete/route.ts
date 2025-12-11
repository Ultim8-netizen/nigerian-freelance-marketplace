// src/app/api/storage/delete/route.ts
export async function POST_DELETE(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const { key, shared } = await request.json();

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('artifact_storage')
      .delete()
      .eq('key', key)
      .eq('shared', shared || false)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ key, deleted: true, shared: shared || false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}