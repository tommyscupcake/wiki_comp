import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await db.incrementSessionVersionDb(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to revoke sessions' }, { status: 404 });
    }
    return NextResponse.json({ success: true, sessionVersion: result.sessionVersion });
  } catch (err) {
    console.error('Revoke sessions failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Failed to revoke sessions' }, { status: 500 });
  }
}
