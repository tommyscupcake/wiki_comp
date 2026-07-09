import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { backupDocumentToS3 } from '@/lib/s3';

const DB_PATH = path.join(process.cwd(), 'database.json');

function stripPasswords(users: any[] | undefined): any[] {
  if (!Array.isArray(users)) return [];
  return users.map(({ password, ...rest }) => rest);
}

// The client never holds a password field after auth moved server-side, so the
// periodic full-state sync from the client must not wipe out stored hashes.
function mergeUserPasswords(existingUsers: any[] | undefined, incomingUsers: any[] | undefined): any[] {
  const existingById = new Map((existingUsers || []).map((u: any) => [u.id, u]));
  return (incomingUsers || []).map((incoming: any) => {
    if (incoming.password !== undefined) return incoming;
    const existing = existingById.get(incoming.id);
    return existing?.password !== undefined ? { ...incoming, password: existing.password } : incoming;
  });
}

export async function GET() {
  try {
    await fs.access(DB_PATH);
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    const sanitized = {
      ...data,
      users: stripPasswords(data.users),
      virtualFileSystem: data.virtualFileSystem
        ? { ...data.virtualFileSystem, 'users.json': stripPasswords(data.virtualFileSystem['users.json']) }
        : data.virtualFileSystem,
    };

    return NextResponse.json({ exists: true, data: sanitized });
  } catch (error) {
    return NextResponse.json({ exists: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    let existing: any = null;
    try {
      existing = JSON.parse(await fs.readFile(DB_PATH, 'utf-8'));
    } catch {
      existing = null;
    }

    const merged = {
      ...body,
      users: mergeUserPasswords(existing?.users, body.users),
      virtualFileSystem: body.virtualFileSystem
        ? {
            ...body.virtualFileSystem,
            'users.json': mergeUserPasswords(existing?.virtualFileSystem?.['users.json'], body.virtualFileSystem['users.json']),
          }
        : body.virtualFileSystem,
    };

    await fs.writeFile(DB_PATH, JSON.stringify(merged, null, 2), 'utf-8');

    if (Array.isArray(body.documents) && body.documents.length > 0) {
      // Postgres is authoritative for document content (title/content). This
      // must succeed for the save to count as successful.
      const syncResult = await db.syncDocumentsDb(body.documents);
      if (!syncResult.success) {
        console.error('Failed to persist documents to Postgres:', syncResult.error);
        return NextResponse.json(
          { success: false, error: syncResult.error || 'Database error', warnings: syncResult.warnings },
          { status: 500 }
        );
      }

      // S3 backup is best-effort and must never block or fail the response.
      if (process.env.STORAGE_MODE === 's3') {
        await Promise.all(
          body.documents.map((doc: any) =>
            backupDocumentToS3(doc).catch((err) =>
              console.warn(`S3 backup failed for document ${doc?.id}:`, err instanceof Error ? err.message : err)
            )
          )
        );
      }

      if (syncResult.warnings && syncResult.warnings.length > 0) {
        // Sync partially succeeded: content is saved, but some relational
        // data (e.g. team sharing) couldn't be persisted. Surface this to the
        // client instead of only logging it server-side.
        return NextResponse.json({ success: true, warnings: syncResult.warnings });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error writing database.json:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
