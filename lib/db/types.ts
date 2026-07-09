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

export interface UserUpdateFields {
  username?: string;
  email?: string;
  role?: 'ADMIN' | 'CREATOR' | 'VIEWER';
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  profilePic?: string | null;
}

// Loose shape for the document-sync payload coming from the client's full-state
// POST to /api/vfs. Kept permissive (fields optional) since it's parsed from
// arbitrary JSON, not constructed server-side.
export interface DbDocumentSync {
  id: string;
  title?: string;
  content?: string;
  ownerId?: string | null;
  visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  isDeleted?: boolean;
  collaborators?: { userId: string; access: 'READ' | 'WRITE' }[];
  teamCollaborators?: { teamId: string; access: 'READ' | 'WRITE' }[];
  sharedWith?: { userId: string; role: string }[];
  history?: { versionId: string; timestamp: string; content: string; authorId?: string; name?: string }[];
  comments?: { commentId: string; text: string; authorId?: string; targetText?: string; timestamp: string }[];
}

export interface DbDocumentSyncWarning {
  documentId: string;
  message: string;
}

export interface SyncDocumentsResult {
  documentErrors: DbDocumentSyncWarning[]; // hard failures: content did not save
  warnings: DbDocumentSyncWarning[]; // soft failures: collaborators/history/comments did not save
}
