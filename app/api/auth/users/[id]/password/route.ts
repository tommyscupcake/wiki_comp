import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { newPassword, forceChange } = body || {};

  if (typeof forceChange !== 'boolean') {
    return NextResponse.json({ success: false, error: 'forceChange must be a boolean' }, { status: 400 });
  }
  if (newPassword !== undefined && (typeof newPassword !== 'string' || !newPassword)) {
    return NextResponse.json({ success: false, error: 'newPassword must be a non-empty string' }, { status: 400 });
  }

  try {
    const result = newPassword
      ? await db.updateUserPasswordDb(id, await hashPassword(newPassword), forceChange)
      : await db.setRequiresPasswordChangeDb(id, forceChange);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update password' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password update failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 });
  }
}
