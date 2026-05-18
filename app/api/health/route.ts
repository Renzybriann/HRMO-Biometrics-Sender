import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Simple query to keep Supabase active
    const { data, error } = await supabase
      .from('settings')
      .select('id')
      .eq('id', 1)
      .single();

    return NextResponse.json({ 
      alive: true, 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    return NextResponse.json({ alive: false }, { status: 500 });
  }
}