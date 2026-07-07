import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toSafeUser } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['ADMIN', 'CREATOR', 'VIEWER'];
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { username, email, role, status, profilePic } = body || {};
  const updates: Record<string, unknown> = {};

  if (username !== undefined) {
    if (typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid username' }, { status: 400 });
    }
    updates.username = username.trim();
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }
    updates.email = email.trim();
  }
  if (role !== undefined) {
    if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }
    updates.role = role;
  }
  if (status !== undefined) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;
  }
  if (profilePic !== undefined) {
    if (typeof profilePic !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid profilePic' }, { status: 400 });
    }
    updates.profilePic = profilePic;
  }

  try {
    const result = await db.updateUserDb(id, updates);
    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to update user' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: toSafeUser(result.user) });
  } catch (err) {
    console.error('Update user failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await db.deleteUserDb(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to delete user' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}
