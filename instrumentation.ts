import fs from 'fs/promises';
import path from 'path';

// Runs once when the Node.js server process starts (Next.js instrumentation
// hook — see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
//
// Background: a client-side seed-data bug used to poison database.json with
// documents/users/teams whose ids referenced hardcoded placeholders
// ('admin-id'/'user-id') that never existed in Postgres. Once that happened,
// database.json kept re-serving that poisoned data to every fresh client via
// GET /api/vfs, which re-sent it on save, causing the same FK violation
// (wiki_documents_owner_id_fkey / document_history_author_id_fkey) over and
// over — and required manually SSHing in to hand-edit the file. This
// self-heals it on every server boot instead.
//
// Scoped to live mode only: in local mode, database.json's seed admin/user
// accounts legitimately use these same literal ids (see
// lib/db/localService.ts's seedDefaultDb()) and are safe there — local mode
// has no FK constraints. Stripping them there would break local dev login.
const KNOWN_BAD_IDS = new Set(['admin-id', 'user-id']);
const DB_PATH = path.join(process.cwd(), 'database.json');

async function cleanLegacyPlaceholderIds(): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(DB_PATH, 'utf-8');
  } catch {
    return; // no database.json yet — nothing to clean
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[startup cleanup] database.json is not valid JSON, skipping cleanup:', err);
    return;
  }

  const removed = {
    documents: [] as string[],
    users: [] as string[],
    teams: [] as string[],
    auditLogs: [] as string[],
  };

  if (Array.isArray(data.documents)) {
    data.documents = data.documents.filter((doc: any) => {
      const bad = doc && KNOWN_BAD_IDS.has(doc.ownerId);
      if (bad) removed.documents.push(doc.id);
      return !bad;
    });
    // Strip stray references to placeholder ids from documents that survive
    // (e.g. a real document that got shared with the phantom seed user).
    for (const doc of data.documents) {
      if (Array.isArray(doc.sharedWith)) {
        doc.sharedWith = doc.sharedWith.filter((s: any) => !KNOWN_BAD_IDS.has(s?.userId));
      }
      if (Array.isArray(doc.collaborators)) {
        doc.collaborators = doc.collaborators.filter((c: any) => !KNOWN_BAD_IDS.has(c?.userId));
      }
    }
  }

  if (Array.isArray(data.users)) {
    data.users = data.users.filter((u: any) => {
      const bad = u && KNOWN_BAD_IDS.has(u.id);
      if (bad) removed.users.push(u.id);
      return !bad;
    });
  }

  if (Array.isArray(data.teams)) {
    data.teams = data.teams.filter((t: any) => {
      const onlyBadMembers =
        Array.isArray(t?.members) && t.members.length > 0 && t.members.every((m: any) => KNOWN_BAD_IDS.has(m?.userId));
      if (onlyBadMembers) removed.teams.push(t.id);
      return !onlyBadMembers;
    });
    for (const team of data.teams) {
      if (Array.isArray(team.members)) {
        team.members = team.members.filter((m: any) => !KNOWN_BAD_IDS.has(m?.userId));
      }
    }
  }

  if (Array.isArray(data.auditLogs)) {
    data.auditLogs = data.auditLogs.filter((log: any) => {
      const bad = log && KNOWN_BAD_IDS.has(log.adminId);
      if (bad) removed.auditLogs.push(log.id);
      return !bad;
    });
  }

  // Mirror the same cleanup into the legacy virtualFileSystem blob so a
  // client can't repopulate state.documents/users/teams from it either.
  if (data.virtualFileSystem) {
    const vfs = data.virtualFileSystem;
    if (vfs.pages && typeof vfs.pages === 'object') {
      for (const folderId of Object.keys(vfs.pages)) {
        const folder = vfs.pages[folderId];
        if (!folder || typeof folder !== 'object') continue;
        for (const pageId of Object.keys(folder)) {
          if (KNOWN_BAD_IDS.has(folder[pageId]?.ownerId)) {
            delete folder[pageId];
          }
        }
      }
    }
    if (Array.isArray(vfs['users.json'])) {
      vfs['users.json'] = vfs['users.json'].filter((u: any) => !KNOWN_BAD_IDS.has(u?.id));
    }
    if (Array.isArray(vfs['teams.json'])) {
      vfs['teams.json'] = vfs['teams.json'].filter((t: any) => {
        const onlyBadMembers =
          Array.isArray(t?.members) && t.members.length > 0 && t.members.every((m: any) => KNOWN_BAD_IDS.has(m?.userId));
        return !onlyBadMembers;
      });
    }
  }

  const totalRemoved = removed.documents.length + removed.users.length + removed.teams.length + removed.auditLogs.length;
  if (totalRemoved === 0) return; // already clean — don't touch the file or log noise on every restart

  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.warn(
    `[startup cleanup] Removed legacy placeholder-id entries from database.json: ` +
      `${removed.documents.length} document(s)${removed.documents.length ? ` [${removed.documents.join(', ')}]` : ''}, ` +
      `${removed.users.length} user(s)${removed.users.length ? ` [${removed.users.join(', ')}]` : ''}, ` +
      `${removed.teams.length} team(s)${removed.teams.length ? ` [${removed.teams.join(', ')}]` : ''}, ` +
      `${removed.auditLogs.length} audit log(s). ` +
      `These referenced 'admin-id'/'user-id' placeholders that don't exist in Postgres.`
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PUBLIC_API_MODE !== 'live') return;

  try {
    await cleanLegacyPlaceholderIds();
  } catch (err) {
    console.error('[startup cleanup] Failed to clean database.json:', err);
  }
}
