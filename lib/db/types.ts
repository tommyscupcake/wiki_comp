export interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'CREATOR' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  requiresPasswordChange: boolean;
  profilePic: string | null;
  sessionVersion: number;
}

export interface NewDbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'CREATOR' | 'VIEWER';
  profilePic: string | null;
}

export function toSafeUser(user: DbUser) {
  const { passwordHash, ...safe } = user;
  return safe;
}
