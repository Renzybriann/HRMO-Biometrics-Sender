import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';

// GET — return current config (masked)
export async function GET() {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    return NextResponse.json({
      gmailUser: process.env.GMAIL_USER || '',
      gmailFromName: process.env.GMAIL_FROM_NAME || '',
      hasPassword: !!process.env.GMAIL_APP_PASSWORD,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST — on Vercel, env vars can't be updated at runtime.
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    return NextResponse.json(
      {
        error:
          'Environment variables cannot be updated at runtime on Vercel. Please update GMAIL_USER, GMAIL_APP_PASSWORD, and GMAIL_FROM_NAME in your Vercel project settings under Environment Variables, then redeploy.',
      },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}