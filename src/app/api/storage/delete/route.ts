// src/app/api/storage/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, shared } = await request.json();

    const { error } = await supabase
      .from('artifact_storage')
      .delete()
      .eq('key', key)
      .eq('shared', shared || false)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ key, deleted: true, shared: shared || false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}