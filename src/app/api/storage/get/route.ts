// src/app/api/storage/get/route.ts
import { NextRequest as R, NextResponse as Rs } from 'next/server';
import { requireAuth as a } from '@/lib/api/middleware';
import { createClient as c } from '@/lib/supabase/server';

export async function POST(request: R) {
  try {
    const authResult = await a(request);
    if (authResult instanceof Rs) return authResult;
    const { user } = authResult;

    const { key, shared } = await request.json();

    const supabase = c();
    const { data, error } = await supabase
      .from('artifact_storage')
      .select('*')
      .eq('key', key)
      .eq('shared', shared || false)
      .eq(shared ? 'shared' : 'user_id', shared ? shared : user.id)
      .single();

    if (error) throw error;

    return Rs.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error: any) {
    return Rs.json({ error: error.message }, { status: 404 });
  }
}