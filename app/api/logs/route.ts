import { NextRequest, NextResponse } from 'next/server';
import { getLogsPage, LogQueryOptions } from '@/lib/store';
import { requireAuth } from '@/lib/auth-guard';

function phDateBoundary(date: string, endOfDay: boolean): string {
  return `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+08:00`;
}

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const officeId = searchParams.get('officeId') || undefined;
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const status = statusParam === 'success' || statusParam === 'failed'
      ? statusParam
      : undefined;

    const options: LogQueryOptions = {
      from: from ? phDateBoundary(from, false) : undefined,
      to: to ? phDateBoundary(to, true) : undefined,
      officeId,
      status,
      limit: limitParam ? Number(limitParam) : 500,
      offset: offsetParam ? Number(offsetParam) : 0,
    };

    const { logs, total } = await getLogsPage(options);
    return NextResponse.json({ logs, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
