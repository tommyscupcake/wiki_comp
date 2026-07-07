import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { toSafeUser } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let username: unknown;
  let password: unknown;
  try {
    const body = await req.json();
    username = body.username;
    password = body.password;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
  }

  try {
    const user = await db.getUserByUsernameDb(username);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      return NextResponse.json({ success: false, error: 'This account is not active' }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: toSafeUser(user) });
  } catch (err) {
    console.error('Login failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
