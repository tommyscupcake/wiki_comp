import { getPool } from './pool';
import { DbUser, NewDbUser, UserUpdateFields } from './types';

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
