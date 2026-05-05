import { NextRequest, NextResponse } from 'next/server';

// GET — return current config (masked)
export async function GET() {
  return NextResponse.json({
    gmailUser: process.env.GMAIL_USER || '',
    gmailFromName: process.env.GMAIL_FROM_NAME || '',
    hasPassword: !!process.env.GMAIL_APP_PASSWORD,
  });
}

// POST — on Vercel, env vars can't be written at runtime.
// Direct users to update them in the Vercel dashboard.
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Environment variables cannot be updated at runtime on Vercel. Please update GMAIL_USER, GMAIL_APP_PASSWORD, and GMAIL_FROM_NAME in your Vercel project settings under Environment Variables, then redeploy.',
    },
    { status: 400 }
  );
}