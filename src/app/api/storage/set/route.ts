// src/app/api/storage/set/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, value, shared } = await request.json();

    const { data, error } = await supabase
      .from('artifact_storage')
      .upsert({
        key,
        value,
        shared: shared || false,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}