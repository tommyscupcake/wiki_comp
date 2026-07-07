import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { toSafeUser } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['ADMIN', 'CREATOR', 'VIEWER'];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { username, password, email, role, profilePic } = body || {};

  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
  }
  if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await db.createUserDb({
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      username: username.trim(),
      email: typeof email === 'string' && email.trim() ? email.trim() : `${username.trim()}@enterprise.wiki`,
      passwordHash,
      role: role as 'ADMIN' | 'CREATOR' | 'VIEWER',
      profilePic: typeof profilePic === 'string' ? profilePic : null,
    });

    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to create user' }, { status: 409 });
    }

    return NextResponse.json({ success: true, user: toSafeUser(result.user) });
  } catch (err) {
    console.error('Create user failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}
