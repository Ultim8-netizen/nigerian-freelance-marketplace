// src/app/api/storage/get/route.ts
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

    const { data, error } = await supabase
      .from('artifact_storage')
      .select('*')
      .eq('key', key)
      .eq('shared', shared || false)
      .eq(shared ? 'shared' : 'user_id', shared ? shared : user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}