import { createServerSupabaseClient } from './supabase-server';
import { NextResponse } from 'next/server';

export async function requireAuth(): Promise<{ user: any; error: NextResponse | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    return { user, error: null };
  } catch {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}