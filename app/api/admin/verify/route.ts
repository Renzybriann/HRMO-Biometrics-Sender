import { NextResponse } from 'next/server';
import { verifyConnection } from '@/lib/mailer';

export async function GET() {
  const ok = await verifyConnection();
  return NextResponse.json({ connected: ok });
}
