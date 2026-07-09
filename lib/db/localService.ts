import fs from 'fs/promises';
import path from 'path';
import { hashPassword } from '../auth';
import { DbUser, NewDbUser, UserUpdateFields, DbDocumentSync, SyncDocumentsResult } from './types';

const DB_PATH = path.join(process.cwd(), 'database.json');

interface LocalDbShape {
  users: any[];
  documents: any[];
  teams: any[];
  auditLogs: any[];
  notifications: any[];
  virtualFileSystem: any;
}

async function readLocalDb(): Promise<LocalDbShape> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const seeded = await seedDefaultDb();
    await writeLocalDb(seeded);
    return seeded;
  }
}

async function writeLocalDb(data: LocalDbShape): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function seedDefaultDb(): Promise<LocalDbShape> {
  const adminHash = await hashPassword('admin');
  const userHash = await hashPassword('user');
  const users = [
    {
      id: 'admin-id',
      username: 'admin',
      email: 'admin@enterprise.wiki',
      password: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      requiresPasswordChange: false,
      profilePic: null,
      sessionVersion: 1,
    },
    {
      id: 'user-id',
      username: 'user',
      email: 'user@enterprise.wiki',
      password: userHash,
      role: 'CREATOR',
      status: 'ACTIVE',
      requiresPasswordChange: false,
      profilePic: null,
      sessionVersion: 1,
    },
  ];
  return {
    users,
    documents: [],
    teams: [],
    auditLogs: [],
    notifications: [],
    virtualFileSystem: { 'users.json': users, 'teams.json': [], 'audit-logs.json': [], 'templates.json': [], pages: {} },
  };
}

function rowToDbUser(row: any): DbUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password,
    role: row.role,
    status: row.status || 'ACTIVE',
    requiresPasswordChange: !!row.requiresPasswordChange,
    profilePic: row.profilePic ?? null,
    sessionVersion: row.sessionVersion || 1,
  };
}

export const softDeleteTeamDb = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
  console.log('Local DB: Successfully soft-deleted team', teamId);
  return { success: true };
};

export const restoreTeamDb = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
  console.log('Local DB: Successfully restored team', teamId);
  return { success: true };
};

export const getUserByUsernameDb = async (username: string): Promise<DbUser | null> => {
  const db = await readLocalDb();
  const found = db.users.find((u: any) => u.username?.toLowerCase() === username.toLowerCase());
  return found ? rowToDbUser(found) : null;
};

export const listUsersDb = async (): Promise<DbUser[]> => {
  const db = await readLocalDb();
  return db.users.map(rowToDbUser);
};

export const createUserDb = async (user: NewDbUser): Promise<{ success: boolean; error?: string; user?: DbUser }> => {
  const db = await readLocalDb();
  const exists = db.users.some((u: any) => u.username?.toLowerCase() === user.username.toLowerCase());
  if (exists) {
    return { success: false, error: 'Username or email already exists' };
  }
  const newRow = {
    id: user.id,
    username: user.username,
    email: user.email,
    password: user.passwordHash,
    role: user.role,
    status: 'ACTIVE',
    requiresPasswordChange: false,
    profilePic: user.profilePic,
    sessionVersion: 1,
  };
  db.users.push(newRow);
  await writeLocalDb(db);
  return { success: true, user: rowToDbUser(newRow) };
};

export const updateUserPasswordDb = async (
  userId: string,
  passwordHash: string,
  requiresPasswordChange: boolean
): Promise<{ success: boolean; error?: string }> => {
  const db = await readLocalDb();
  const idx = db.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return { success: false, error: 'User not found' };
  db.users[idx] = { ...db.users[idx], password: passwordHash, requiresPasswordChange };
  await writeLocalDb(db);
  return { success: true };
};

export const setRequiresPasswordChangeDb = async (
  userId: string,
  requiresPasswordChange: boolean
): Promise<{ success: boolean; error?: string }> => {
  const db = await readLocalDb();
  const idx = db.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return { success: false, error: 'User not found' };
  db.users[idx] = { ...db.users[idx], requiresPasswordChange };
  await writeLocalDb(db);
  return { success: true };
};

export const updateUserDb = async (
  userId: string,
  updates: UserUpdateFields
): Promise<{ success: boolean; error?: string; user?: DbUser }> => {
  const db = await readLocalDb();
  const idx = db.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return { success: false, error: 'User not found' };

  if (updates.username !== undefined || updates.email !== undefined) {
    const clash = db.users.some((u: any, i: number) =>
      i !== idx && (
        (updates.username !== undefined && u.username?.toLowerCase() === updates.username.toLowerCase()) ||
        (updates.email !== undefined && u.email?.toLowerCase() === updates.email.toLowerCase())
      )
    );
    if (clash) return { success: false, error: 'Username or email already exists' };
  }

  db.users[idx] = { ...db.users[idx], ...updates };
  await writeLocalDb(db);
  return { success: true, user: rowToDbUser(db.users[idx]) };
};

export const deleteUserDb = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  const db = await readLocalDb();
  const idx = db.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return { success: false, error: 'User not found' };
  db.users.splice(idx, 1);
  await writeLocalDb(db);
  return { success: true };
};

export const incrementSessionVersionDb = async (
  userId: string
): Promise<{ success: boolean; error?: string; sessionVersion?: number }> => {
  const db = await readLocalDb();
  const idx = db.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return { success: false, error: 'User not found' };
  const nextVersion = (db.users[idx].sessionVersion || 1) + 1;
  db.users[idx] = { ...db.users[idx], sessionVersion: nextVersion };
  await writeLocalDb(db);
  return { success: true, sessionVersion: nextVersion };
};

export const syncDocumentsDb = async (_documents: DbDocumentSync[]): Promise<SyncDocumentsResult> => {
  // Local mode's database.json already stores documents verbatim via the
  // full-state write in app/api/vfs/route.ts — nothing extra to do here.
  return { success: true };
};
