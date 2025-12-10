// src/app/api/storage/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prefix, shared } = await request.json();

    let query = supabase
      .from('artifact_storage')
      .select('key')
      .eq('shared', shared || false)
      .eq('user_id', user.id);

    if (prefix) {
      query = query.ilike('key', `${prefix}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      keys: data.map(d => d.key),
      prefix,
      shared: shared || false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}