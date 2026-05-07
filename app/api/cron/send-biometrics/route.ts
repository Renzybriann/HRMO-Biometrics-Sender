import { NextRequest, NextResponse } from 'next/server';
import { sendToAllOffices, shouldSendToday } from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const should = await shouldSendToday();
    if (!should) {
      return NextResponse.json({ skipped: true, reason: 'Not scheduled for today' });
    }

    const result = await sendToAllOffices();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}