import { NextResponse } from 'next/server';
import { verifyConnection } from '@/lib/mailer';
import { requireAuth } from '@/lib/auth-guard';

export async function GET() {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const ok = await verifyConnection();
    return NextResponse.json({ connected: ok });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}