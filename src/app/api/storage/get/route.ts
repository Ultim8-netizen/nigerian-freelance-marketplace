// src/app/api/storage/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;

    const { key, shared } = await request.json();

    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('artifact_storage')
      .select('*')
      .eq('key', key)
      .eq('shared', shared || false)
      .eq(shared ? 'shared' : 'user_id', shared ? shared : user.id)
      .single();

    if (queryError) throw queryError;

    return NextResponse.json({ key: data.key, value: data.value, shared: data.shared });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}