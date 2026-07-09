import { getPool } from './pool';
import { DbUser, NewDbUser, UserUpdateFields, DbDocumentSync, DbDocumentSyncWarning, SyncDocumentsResult } from './types';

export const softDeleteTeamDb = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await getPool().query(
      'UPDATE teams SET is_trashed = true, trashed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [teamId]
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'Team not found' };
    }
    return { success: true };
  } catch (err) {
    console.error('softDeleteTeamDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const restoreTeamDb = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await getPool().query(
      'UPDATE teams SET is_trashed = false, trashed_at = NULL WHERE id = $1',
      [teamId]
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'Team not found' };
    }
    return { success: true };
  } catch (err) {
    console.error('restoreTeamDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

function rowToDbUser(row: any): DbUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password,
    role: row.role,
    status: row.status,
    requiresPasswordChange: row.requires_password_change,
    profilePic: row.profile_pic,
    sessionVersion: row.session_version,
  };
}

export const getUserByUsernameDb = async (username: string): Promise<DbUser | null> => {
  const result = await getPool().query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (result.rowCount === 0) return null;
  return rowToDbUser(result.rows[0]);
};

export const listUsersDb = async (): Promise<DbUser[]> => {
  const result = await getPool().query('SELECT * FROM users ORDER BY created_at ASC');
  return result.rows.map(rowToDbUser);
};

export const createUserDb = async (user: NewDbUser): Promise<{ success: boolean; error?: string; user?: DbUser }> => {
  try {
    const result = await getPool().query(
      `INSERT INTO users (id, username, email, password, role, status, requires_password_change, profile_pic, session_version)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', false, $6, 1)
       RETURNING *`,
      [user.id, user.username, user.email, user.passwordHash, user.role, user.profilePic]
    );
    return { success: true, user: rowToDbUser(result.rows[0]) };
  } catch (err: any) {
    if (err?.code === '23505') {
      return { success: false, error: 'Username or email already exists' };
    }
    console.error('createUserDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const updateUserPasswordDb = async (
  userId: string,
  passwordHash: string,
  requiresPasswordChange: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await getPool().query(
      'UPDATE users SET password = $1, requires_password_change = $2 WHERE id = $3',
      [passwordHash, requiresPasswordChange, userId]
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }
    return { success: true };
  } catch (err) {
    console.error('updateUserPasswordDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const setRequiresPasswordChangeDb = async (
  userId: string,
  requiresPasswordChange: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await getPool().query(
      'UPDATE users SET requires_password_change = $1 WHERE id = $2',
      [requiresPasswordChange, userId]
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }
    return { success: true };
  } catch (err) {
    console.error('setRequiresPasswordChangeDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const updateUserDb = async (
  userId: string,
  updates: UserUpdateFields
): Promise<{ success: boolean; error?: string; user?: DbUser }> => {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (updates.username !== undefined) { fields.push(`username = $${i++}`); values.push(updates.username); }
  if (updates.email !== undefined) { fields.push(`email = $${i++}`); values.push(updates.email); }
  if (updates.role !== undefined) { fields.push(`role = $${i++}`); values.push(updates.role); }
  if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
  if (updates.profilePic !== undefined) { fields.push(`profile_pic = $${i++}`); values.push(updates.profilePic); }

  if (fields.length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  values.push(userId);

  try {
    const result = await getPool().query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }
    return { success: true, user: rowToDbUser(result.rows[0]) };
  } catch (err: any) {
    if (err?.code === '23505') {
      return { success: false, error: 'Username or email already exists' };
    }
    console.error('updateUserDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const deleteUserDb = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }
    return { success: true };
  } catch (err) {
    console.error('deleteUserDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

export const incrementSessionVersionDb = async (
  userId: string
): Promise<{ success: boolean; error?: string; sessionVersion?: number }> => {
  try {
    const result = await getPool().query(
      'UPDATE users SET session_version = session_version + 1 WHERE id = $1 RETURNING session_version',
      [userId]
    );
    if (result.rowCount === 0) {
      return { success: false, error: 'User not found' };
    }
    return { success: true, sessionVersion: result.rows[0].session_version };
  } catch (err) {
    console.error('incrementSessionVersionDb failed:', err);
    return { success: false, error: 'Database error' };
  }
};

const ACCESS_LEVEL_MAP: Record<string, 'Viewer' | 'Editor'> = { READ: 'Viewer', WRITE: 'Editor' };

// Postgres is the source of truth for document content. The wiki_documents
// upsert below is the operation that must succeed for a document to count as
// saved; the relational extras (collaborators/history/comments) are synced
// best-effort per document so a stale FK reference (see TODO in
// syncDocumentChildren) can't roll back the content write itself. Failures
// there are collected as warnings and returned to the caller instead of only
// being logged, so the UI can tell the user sharing/version data didn't save.
export const syncDocumentsDb = async (documents: DbDocumentSync[]): Promise<SyncDocumentsResult> => {
  if (!Array.isArray(documents) || documents.length === 0) {
    return { success: true };
  }

  const pool = getPool();
  const failedIds: string[] = [];
  const warnings: DbDocumentSyncWarning[] = [];

  for (const doc of documents) {
    if (!doc?.id) continue;

    try {
      await pool.query(
        `INSERT INTO wiki_documents (id, title, content, owner_id, visibility, is_deleted, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           owner_id = EXCLUDED.owner_id,
           visibility = EXCLUDED.visibility,
           is_deleted = EXCLUDED.is_deleted,
           last_updated = CURRENT_TIMESTAMP`,
        [doc.id, doc.title || '', doc.content || '', doc.ownerId || null, doc.visibility || 'PRIVATE', !!doc.isDeleted]
      );
    } catch (err) {
      // This is the one failure that matters: content didn't persist.
      console.error(`syncDocumentsDb: failed to upsert wiki_documents for ${doc.id}:`, err);
      failedIds.push(doc.id);
      continue; // don't bother syncing children for a doc whose row doesn't exist
    }

    warnings.push(...(await syncDocumentChildren(doc)));
  }

  if (failedIds.length > 0) {
    return {
      success: false,
      error: `Failed to save ${failedIds.length} document(s) to the database`,
      failedIds,
      warnings: warnings.length ? warnings : undefined,
    };
  }
  return { success: true, warnings: warnings.length ? warnings : undefined };
};

async function syncDocumentChildren(doc: DbDocumentSync): Promise<DbDocumentSyncWarning[]> {
  const pool = getPool();
  const warnings: DbDocumentSyncWarning[] = [];
  const label = doc.title ? `"${doc.title}"` : doc.id;

  const bestEffort = async (what: string, fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(`syncDocumentsDb: ${what} failed for document ${doc.id} (non-fatal):`, detail);
      warnings.push({
        documentId: doc.id,
        message: `${label}: ${what} could not be saved (${detail}). The document's content was saved, but this related data is out of date.`,
      });
    }
  };

  await bestEffort('collaborators', async () => {
    await pool.query('DELETE FROM document_collaborators WHERE document_id = $1', [doc.id]);
    for (const c of doc.collaborators || []) {
      await pool.query(
        `INSERT INTO document_collaborators (document_id, user_id, access) VALUES ($1, $2, $3)
         ON CONFLICT (document_id, user_id) DO NOTHING`,
        [doc.id, c.userId, ACCESS_LEVEL_MAP[c.access] || 'Viewer']
      );
    }
  });

  // TODO(teams): there is currently no code path that creates rows in the
  // `teams` table in Postgres (only trash/restore toggles on existing rows).
  // Until real team persistence is implemented, this will fail with a FK
  // violation for any team-shared document and surface as a warning below.
  await bestEffort('team sharing', async () => {
    await pool.query('DELETE FROM document_team_collaborators WHERE document_id = $1', [doc.id]);
    for (const tc of doc.teamCollaborators || []) {
      await pool.query(
        `INSERT INTO document_team_collaborators (document_id, team_id, access) VALUES ($1, $2, $3)
         ON CONFLICT (document_id, team_id) DO NOTHING`,
        [doc.id, tc.teamId, ACCESS_LEVEL_MAP[tc.access] || 'Viewer']
      );
    }
  });

  await bestEffort('shared-with list', async () => {
    await pool.query('DELETE FROM document_shared_with WHERE document_id = $1', [doc.id]);
    for (const sw of doc.sharedWith || []) {
      await pool.query(
        `INSERT INTO document_shared_with (document_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (document_id, user_id) DO NOTHING`,
        [doc.id, sw.userId, sw.role || 'Viewer']
      );
    }
  });

  await bestEffort('version history', async () => {
    for (const v of doc.history || []) {
      await pool.query(
        `INSERT INTO document_history (version_id, document_id, content, author_id, name, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (version_id) DO NOTHING`,
        [v.versionId, doc.id, v.content, v.authorId || null, v.name || null, v.timestamp]
      );
    }
  });

  await bestEffort('comments', async () => {
    for (const c of doc.comments || []) {
      await pool.query(
        `INSERT INTO document_comments (comment_id, document_id, text, author_id, target_text, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (comment_id) DO UPDATE SET text = EXCLUDED.text`,
        [c.commentId, doc.id, c.text, c.authorId || null, c.targetText || null, c.timestamp]
      );
    }
  });

  return warnings;
}
