import { getPool } from './pool';
import { DbUser, NewDbUser } from './types';

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
