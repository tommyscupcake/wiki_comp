import { create } from 'zustand';
import { set as idbSet, get as idbGet } from 'idb-keyval';

const safeSetItem = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  if (key === 'wiki_documents_list2' || key === 'virtual_file_system') {
    idbSet(key, value).catch(console.error);
    try {
      window.localStorage.removeItem(key); // clear localStorage to save space
    } catch(e) {}
  } else {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage error', e);
      idbSet(key, value).catch(console.error);
    }
  }
};

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'CREATOR' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  requiresPasswordChange: boolean;
  profilePic?: string;
  sessionVersion?: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId?: string;
  details: string;
  timestamp: string;
}

export interface WikiDocumentVersion {
  versionId: string;
  timestamp: string;
  content: string;
  authorId: string;
}

export interface WikiDocumentComment {
  commentId: string;
  text: string;
  authorId: string;
  targetText: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'MENTION' | 'ACCESS_GRANTED' | 'VERSION_PUBLISHED' | 'COMMENT_ADDED';
  message: string;
  link?: string;
  isRead: boolean;
  timestamp: string;
}

export interface Team {
  id: string;
  name: string;
  members: { userId: string; teamRole: 'MODERATOR' | 'EDITOR' | 'VIEWER' }[];
  isTrashed?: boolean;
  trashedAt?: string | null;
}

export interface WikiDocument {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
  ownerId: string;
  visibility: 'PRIVATE' | 'WORKSPACE';
  collaborators: { userId: string; access: 'READ' | 'WRITE' }[];
  teamCollaborators: { teamId: string; access: 'READ' | 'WRITE' }[];
  sharedWith: { userId: string; role: 'Viewer' | 'Editor' | 'Admin' }[];
  history?: WikiDocumentVersion[];
  comments?: WikiDocumentComment[];
  isDeleted?: boolean;
}

export interface WikiTemplate {
  id: string;
  name: string;
  content: string;
}

export interface VirtualFileSystem {
  "manifest.json": { lastUpdated: string; version: string };
  "teams.json": Team[];
  "users.json": User[];
  "audit-logs.json": AuditLog[];
  "templates.json": WikiTemplate[];
  "notifications.json"?: Notification[];
  pages: {
    [folderId: string]: {
      [pageId: string]: WikiDocument;
    };
  };
}

interface WikiState {
  virtualFileSystem: VirtualFileSystem;
  currentUser: User | null;
  impersonatorUser: User | null;
  users: User[];
  documents: WikiDocument[];
  teams: Team[];
  auditLogs: AuditLog[];
  notifications: Notification[];

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: (userId: string) => void;
  clearNotifications: (userId: string) => void;
  
  // Auth Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentUser: (user: User | null) => void;
  impersonateUser: (targetUserId: string) => void;
  stopImpersonating: () => void;
  
  // User Management
  addUser: (user: Omit<User, 'id' | 'status' | 'requiresPasswordChange' | 'sessionVersion'>) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean };
  updateUserRole: (userId: string, role: 'ADMIN' | 'CREATOR' | 'VIEWER') => void;
  updateUserStatus: (userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => void;
  updateUserProfile: (userId: string, updates: { username: string; email?: string; profilePic?: string; role: 'ADMIN' | 'CREATOR' | 'VIEWER' }) => void;
  resetUserPassword: (userId: string, newPassword: string, forceChange: boolean) => void;
  revokeUserSessions: (userId: string) => void;
  addAuditLog: (adminId: string, action: string, details: string, targetUserId?: string) => void;

  // Team Management Actions
  createTeam: (name: string, members: { userId: string; teamRole: 'MODERATOR' | 'EDITOR' | 'VIEWER' }[]) => Team;
  deleteTeam: (id: string) => void;
  restoreTeam: (id: string) => void;
  permanentlyDeleteTeam: (id: string) => void;
  updateTeamMembers: (id: string, members: { userId: string; teamRole: 'MODERATOR' | 'EDITOR' | 'VIEWER' }[]) => void;
  
  // Document Management
  createDocument: (doc: Partial<WikiDocument> & { title: string, content: string, ownerId: string }) => WikiDocument;
  updateDocument: (id: string, updates: Partial<Omit<WikiDocument, 'id' | 'ownerId'>>) => void;
  deleteDocument: (id: string) => void;
  softDeleteDocument: (id: string) => void;
  restoreDocument: (id: string) => void;
  setDocuments: (docs: WikiDocument[]) => void;
  
  // Share & Access Control Actions
  shareDocument: (docId: string, userId: string, access: 'READ' | 'WRITE') => void;
  revokeAccess: (docId: string, userId: string) => void;
  updateAccessLevel: (docId: string, userId: string, access: 'READ' | 'WRITE') => void;
  toggleVisibility: (docId: string) => void;
  setVisibility: (docId: string, visibility: 'PRIVATE' | 'WORKSPACE') => void;
  toggleSharedWith: (docId: string, userId: string, defaultRole?: 'Viewer' | 'Editor' | 'Admin') => void;
  updateSharedUserRole: (docId: string, userId: string, role: 'Viewer' | 'Editor' | 'Admin') => void;

  // New Team Share Actions
  shareDocumentWithTeam: (docId: string, teamId: string, access: 'READ' | 'WRITE') => void;
  revokeTeamAccess: (docId: string, teamId: string) => void;
  updateTeamAccessLevel: (docId: string, teamId: string, access: 'READ' | 'WRITE') => void;

  // Enhancements
  saveVersion: (docId: string, content: string, authorId: string, name?: string) => void;
  restoreVersion: (docId: string, versionId: string) => void;
  addComment: (docId: string, text: string, authorId: string, targetText: string) => void;
  loadFromServer: () => Promise<void>;
}

// Initial pages updated with ownerIds, visibility, and collaborator structure
const INITIAL_DOCUMENTS: WikiDocument[] = [
  {
    id: 'welcome-page',
    title: '🚀 Welcome to the Enterprise Wiki Workspace',
    lastUpdated: '09:42 AM',
    ownerId: 'admin-id',
    visibility: 'WORKSPACE',
    collaborators: [],
    teamCollaborators: [],
    sharedWith: [{ userId: 'admin-id', role: 'Admin' }],
    content: `<h1>Welcome to the Next-Generation Wiki Workspace!</h1>
<p>This is an enterprise-grade collaborative documentation hub built on a custom high-performance, schema-driven <strong>Tiptap</strong> text processing engine. Every formatting command behaves as isolated state layers—applying bolding or italics will never disrupt inline colors or fonts.</p>

<h2>📋 Interactive Formatting Playground</h2>
<p>To witness the strict, pixel-perfect formatting isolated layers, highlight any word and apply formatting from the toolbar, such as picking individual colors, choosing heading levels or adjusting precise pixel sizes.</p>

<h2>📏 Proportional Bullet Points & List Scaling</h2>
<p>This workspace implements an advanced cascading list marker styling. Under standard browsers, bullet points do not automatically scale or match font adjustments. Try changing the font size of the bullets below with the Font Size indicators in the toolbar! The list bullet elements will perfectly synchronize in magnitude and color with the text children:</p>

<ul>
  <li><span style="font-size: 14px; color: rgb(148, 163, 184);">Standard item scaled to 14px for meta items</span></li>
  <li><span style="font-size: 18px; color: rgb(241, 245, 249);">Slightly enlarged 18px documentation row</span></li>
  <li><span style="font-size: 28px; color: rgb(59, 130, 246);">Highly prominent 28px display bullet point row!</span></li>
</ul>

<hr />

<h2>✅ Managed Interactive Checklists</h2>
<p>We've integrated a custom-designed task checklist state. Checkboxes possess responsive CSS transitions and cross-out completed items beautifully:</p>

<ul data-type="taskList">
  <li data-checked="true" class="task-item">
    <label><input type="checkbox" checked="checked"><span></span></label>
    <div>Explore the custom horizontal formatting toolbar</div>
  </li>
  <li data-checked="false" class="task-item">
    <label><input type="checkbox"><span></span></label>
    <div>Write a customized Product Specification for our app</div>
  </li>
  <li data-checked="false" class="task-item">
    <label><input type="checkbox"><span></span></label>
    <div>Activate the <strong>Gemini AI Formatting Copilot</strong> panel to generate automated tests</div>
  </li>
</ul>`,
  },
  {
    id: 'prd-template',
    title: '📘 User Guide: Getting Started with Wiki Workspace',
    lastUpdated: '10:15 AM',
    ownerId: 'user-id',
    visibility: 'PRIVATE',
    collaborators: [],
    teamCollaborators: [],
    sharedWith: [{ userId: 'user-id', role: 'Admin' }],
    content: `<h1>Welcome to your Wiki Workspace, user!</h1>
<p>This is your personal introduction page. Only you have access to this page, and you can edit or delete it as you see fit.</p>

<h2>🚀 What you can do as a Normal User:</h2>

<h3>1. Create Your Own Wikis</h3>
<p>Click on the <strong>+ New Document</strong> button in the left sidebar to create a new wiki document. By default, newly created documents are <strong>Private</strong> to you, but you can share them or assign them to a team.</p>

<h3>2. Workspace & Team Collaboration</h3>
<p>In the sidebar, you can see <strong>Workspace Teams</strong> that you are a member of. Inside each team folder, you can access, read, and edit the wiki documents belonging to that team.</p>

<h3>3. Share & Control Access</h3>
<p>Want to work with others on a private wiki? Click the <strong>Share</strong> button at the top of the editor. You can invite specific users as Viewers or Editors, or publish the wiki to the entire Workspace.</p>

<h3>4. Review Document History & Comments</h3>
<ul>
  <li>Click <strong>History</strong> to view previous versions of your document and restore them if needed.</li>
  <li>Click <strong>Comments</strong> to discuss content with other team members in real-time.</li>
</ul>

<h3>5. Export Documents</h3>
<p>Need your documentation offline? Click the <strong>Export</strong> button to download individual pages as Word (DOCX) or PDF format, or export multiple pages simultaneously using the bulk exporter.</p>

<p><em>Have fun documenting and collaborating! If you have any questions, contact your system administrator.</em></p>`,
  },
  {
    id: 'engineering-playbook',
    title: '🛠️ Engineering Team Codebase Guidelines',
    lastUpdated: '02:30 PM',
    ownerId: 'admin-id',
    visibility: 'WORKSPACE',
    collaborators: [],
    teamCollaborators: [],
    sharedWith: [{ userId: 'admin-id', role: 'Admin' }],
    content: `<h1>Engineering Code Quality & Architecture Playbook</h1>
<p>We mandate clean code standards, explicit types, and rigorous schemas. Below are the protocols for formatting Next.js full-stack systems.</p>

<h2>💻 Server Actions & SDK Usage</h2>
<p>Always access sensitive API credentials strictly on the server side using the secure <code>GoogleGenAI</code> model. Do not prefix critical environment credentials with CLIENT-side variables to prevent build bundle leakageages.</p>

<pre><code>import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});</code></pre>

<h2>📦 Modular CSS Directives</h2>
<p>Tailwind utility directives must form the baseline styling layer. For isolated, high-performance web systems (like editor stages), inline stylesheets or targeted css rules provide resilient behavior.</p>`,
  },
];

const DEFAULT_USERS: User[] = [
  { 
    id: 'admin-id',
    username: 'admin',
    email: 'admin@enterprise.wiki',
    role: 'ADMIN',
    status: 'ACTIVE',
    requiresPasswordChange: false,
    profilePic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    sessionVersion: 1
  },
  { 
    id: 'user-id',
    username: 'user',
    email: 'user@enterprise.wiki',
    role: 'CREATOR',
    status: 'ACTIVE',
    requiresPasswordChange: false,
    profilePic: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
    sessionVersion: 1
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    adminId: 'admin-id',
    adminName: 'admin',
    action: 'SYSTEM_INIT',
    details: 'Enterprise wiki workspace audit logging system initialized.',
    timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString()
  },
  {
    id: 'log-2',
    adminId: 'admin-id',
    adminName: 'admin',
    action: 'TEAM_CREATE',
    details: 'Created team: Payit123',
    timestamp: new Date(Date.now() - 3600000).toLocaleString()
  }
];

const getStoredAuditLogs = (isClient: boolean): AuditLog[] => {
  if (!isClient) return INITIAL_AUDIT_LOGS;
  const item = localStorage.getItem('wiki_audit_logs');
  if (!item) return INITIAL_AUDIT_LOGS;
  try {
    return JSON.parse(item);
  } catch (e) {
    return INITIAL_AUDIT_LOGS;
  }
};

const INITIAL_TEMPLATES: WikiTemplate[] = [
  {
    id: 'tpl-meeting',
    name: 'Meeting Notes',
    content: '<h1>Meeting Notes</h1><h2>Attendees</h2><ul><li></li></ul><h2>Agenda</h2><ul><li></li></ul><h2>Action Items</h2><ul data-type="taskList"><li class="task-item"><label><input type="checkbox"><span></span></label><div></div></li></ul>'
  },
  {
    id: 'tpl-project',
    name: 'Project Specs',
    content: '<h1>Project Specs</h1><h2>Overview</h2><p>Provide a high-level overview.</p><h2>Goals</h2><ul><li></li></ul><h2>Timeline</h2><p>Timeline details.</p>'
  },
  {
    id: 'tpl-onboarding',
    name: 'Onboarding',
    content: '<h1>Onboarding Checklist</h1><h2>Welcome!</h2><p>Please complete the following:</p><ul data-type="taskList"><li class="task-item"><label><input type="checkbox"><span></span></label><div>Set up environment</div></li><li class="task-item"><label><input type="checkbox"><span></span></label><div>Read documentation</div></li></ul>'
  }
];

const getStoredTemplates = (isClient: boolean): WikiTemplate[] => {
  if (!isClient) return INITIAL_TEMPLATES;
  const item = localStorage.getItem('wiki_templates');
  if (!item) return INITIAL_TEMPLATES;
  try {
    return JSON.parse(item);
  } catch (e) {
    return INITIAL_TEMPLATES;
  }
};

const INITIAL_TEAMS: Team[] = [
  {
    id: 'engineering-team',
    name: 'Payit123',
    members: [
      { userId: 'admin-id', teamRole: 'MODERATOR' },
      { userId: 'user-id', teamRole: 'EDITOR' },
    ],
  },
];

const getStoredTeams = (isClient: boolean): Team[] => {
  if (!isClient) return INITIAL_TEAMS;
  const item = localStorage.getItem('wiki_teams_list');
  let loadedTeams: Team[] = INITIAL_TEAMS;
  if (item) {
    try {
      loadedTeams = JSON.parse(item);
    } catch (e) {
      loadedTeams = INITIAL_TEAMS;
    }
  }
  
  // Auto-migrate "Leo team" or "Leo Team" to "Payit123"
  let hasChanges = false;
  loadedTeams = loadedTeams.map(t => {
    if (t.name === 'Leo team' || t.name === 'Leo Team' || t.name.trim().toLowerCase() === 'leo team') {
      hasChanges = true;
      return { ...t, name: 'Payit123' };
    }
    return t;
  });

  if (hasChanges && isClient) {
    localStorage.setItem('wiki_teams_list', JSON.stringify(loadedTeams));
  }

  return loadedTeams;
};

const getStoredNotifications = (isClient: boolean): Notification[] => {
  if (!isClient) return [];
  const item = localStorage.getItem('wiki_notifications');
  if (!item) return [];
  try {
    return JSON.parse(item);
  } catch (e) {
    return [];
  }
};

const createNotification = (userId: string, type: 'MENTION' | 'ACCESS_GRANTED' | 'VERSION_PUBLISHED' | 'COMMENT_ADDED', message: string, link?: string): Notification => ({
  id: `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  userId,
  type,
  message,
  link,
  isRead: false,
  timestamp: new Date().toISOString()
});

const userHasDocAccess = (doc: WikiDocument, userId: string, state: any) => {
  if (doc.ownerId === userId) return true;
  if (doc.visibility === 'WORKSPACE') return true;
  if (doc.collaborators?.some(c => c.userId === userId)) return true;
  if (doc.sharedWith?.some(s => s.userId === userId)) return true;
  if (doc.teamCollaborators?.some(tc => {
    const team = state.teams.find((t: any) => t.id === tc.teamId);
    return team?.members.some((m: any) => m.userId === userId);
  })) return true;
  return false;
};

export const useWikiStore = create<WikiState>((originalSet, get) => {
  // Client-safe initial state retriever helper
  const isClient = typeof window !== 'undefined';

  let saveTimeout: NodeJS.Timeout | null = null;
  const saveToServer = () => {
    if (!isClient) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const state = get();
    const payload = {
      users: state.users,
      documents: state.documents,
      teams: state.teams,
      auditLogs: state.auditLogs,
      notifications: state.notifications,
      virtualFileSystem: state.virtualFileSystem
    };
    fetch('/api/vfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error('Failed to sync to server database:', err));
    }, 500);
  };

  const set: typeof originalSet = (fnOrObj) => {
    originalSet((state: any) => {
      const nextState = typeof fnOrObj === 'function' ? fnOrObj(state) : fnOrObj;
      const newState = { ...state, ...nextState };
      
      // If documents have been updated, sync virtualFileSystem.pages
      if (nextState && (nextState.documents !== undefined || nextState.virtualFileSystem !== undefined)) {
        const docs = newState.documents || [];
        const currentVfs = newState.virtualFileSystem || state.virtualFileSystem || {};
        const newVfs = JSON.parse(JSON.stringify(currentVfs));
        
        const pages: any = {};
        docs.forEach((doc: any) => {
          const folderId = doc.teamCollaborators?.[0]?.teamId || 'workspace';
          if (!pages[folderId]) pages[folderId] = {};
          pages[folderId][`${doc.id}.json`] = doc;
        });
        
        newVfs.pages = pages;
        newState.virtualFileSystem = newVfs;
        
        if (typeof window !== 'undefined') {
          safeSetItem('virtual_file_system', JSON.stringify(newVfs));
        }
      }
      
      return newState;
    });
    saveToServer();
  };
  const getStoredUser = (): User | null => {
    if (!isClient) return null;
    const item = localStorage.getItem('wiki_current_user');
    if (!item) return null;
    try {
      const u = JSON.parse(item);
      return {
        id: u.id,
        username: u.username,
        role: u.role,
        status: u.status || 'ACTIVE',
        requiresPasswordChange: u.requiresPasswordChange !== undefined ? u.requiresPasswordChange : false,
        sessionVersion: u.sessionVersion || 1,
        email: u.email || (u.username === 'admin' ? 'admin@enterprise.wiki' : `${u.username}@enterprise.wiki`),
        profilePic: u.profilePic || (u.username === 'admin' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'),
      };
    } catch {
      return null;
    }
  };

  const getStoredImpersonatorUser = (): User | null => {
    if (!isClient) return null;
    const item = localStorage.getItem('wiki_impersonator_user');
    if (!item) return null;
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  };

  const getStoredUsers = (): User[] => {
    if (!isClient) return DEFAULT_USERS;
    const item = localStorage.getItem('wiki_users_list2');
    let list: User[] = DEFAULT_USERS;
    if (item) {
      try {
        list = JSON.parse(item);
      } catch (e) {
        list = DEFAULT_USERS;
      }
    }
    return list.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      status: u.status || 'ACTIVE',
      requiresPasswordChange: u.requiresPasswordChange !== undefined ? u.requiresPasswordChange : false,
      sessionVersion: u.sessionVersion || 1,
      email: u.email || (u.username === 'admin' ? 'admin@enterprise.wiki' : `${u.username}@enterprise.wiki`),
      profilePic: u.profilePic || (u.username === 'admin' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'),
    }));
  };

  const getStoredDocuments = (): WikiDocument[] => {
    if (!isClient) {
      return INITIAL_DOCUMENTS.map(doc => ({
        ...doc,
        teamCollaborators: doc.teamCollaborators || []
      }));
    }
    const item = localStorage.getItem('wiki_documents_list2');
    if (!item) {
      return INITIAL_DOCUMENTS.map(doc => ({
        ...doc,
        teamCollaborators: []
      }));
    }
    try {
      const parsed = JSON.parse(item);
      return parsed.map((doc: any) => ({
        ...doc,
        teamCollaborators: doc.teamCollaborators || []
      }));
    } catch {
      return INITIAL_DOCUMENTS.map(doc => ({
        ...doc,
        teamCollaborators: []
      }));
    }
  };

  const getStoredVFS = (): VirtualFileSystem => {
    let item = null;
    if (isClient) item = localStorage.getItem('virtual_file_system');
    if (item) {
      try {
        const vfs = JSON.parse(item);
        let hasChanges = false;
        if (vfs && Array.isArray(vfs['teams.json'])) {
          vfs['teams.json'] = vfs['teams.json'].map((t: any) => {
            if (t.name === 'Leo team' || t.name === 'Leo Team' || t.name.trim().toLowerCase() === 'leo team') {
              hasChanges = true;
              return { ...t, name: 'Payit123' };
            }
            return t;
          });
        }
        if (hasChanges && isClient) {
          localStorage.setItem('virtual_file_system', JSON.stringify(vfs));
        }
        return vfs;
      } catch {}
    }
    
    // Fallback: migrate from old storage
    const docs = getStoredDocuments();
    const pages: any = {};
    docs.forEach(doc => {
      const folderId = doc.teamCollaborators?.[0]?.teamId || 'workspace';
      if (!pages[folderId]) pages[folderId] = {};
      pages[folderId][`${doc.id}.json`] = doc;
    });

    return {
      "manifest.json": { lastUpdated: new Date().toISOString(), version: "1.0" },
      "teams.json": getStoredTeams(isClient),
      "users.json": getStoredUsers(),
      "audit-logs.json": getStoredAuditLogs(isClient),
      "templates.json": getStoredTemplates(isClient),
      pages
    };
  };

  return {
    virtualFileSystem: getStoredVFS(),
    currentUser: getStoredUser(),
    impersonatorUser: getStoredImpersonatorUser(),
    users: getStoredUsers(),
    documents: getStoredDocuments(),
    teams: getStoredTeams(isClient),
    auditLogs: getStoredAuditLogs(isClient),
    notifications: getStoredNotifications(isClient),

    addNotification: (notification) => {
      set((state) => {
        const newNotification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          timestamp: new Date().toISOString(),
          isRead: false
        };
        const updatedNotifications = [newNotification, ...state.notifications];
        if (isClient) {
          localStorage.setItem('wiki_notifications', JSON.stringify(updatedNotifications));
        }
        
        // Also add to VFS
        const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
        newVfs['notifications.json'] = updatedNotifications;
        if (isClient) {
          localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
        }
        
        return { notifications: updatedNotifications, virtualFileSystem: newVfs };
      });
    },

    markNotificationAsRead: (id) => {
      set((state) => {
        const updatedNotifications = state.notifications.map((n) => 
          n.id === id ? { ...n, isRead: true } : n
        );
        if (isClient) {
          localStorage.setItem('wiki_notifications', JSON.stringify(updatedNotifications));
        }
        
        const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
        newVfs['notifications.json'] = updatedNotifications;
        if (isClient) {
          localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
        }

        return { notifications: updatedNotifications, virtualFileSystem: newVfs };
      });
    },

    markAllNotificationsAsRead: (userId) => {
      set((state) => {
        const updatedNotifications = state.notifications.map((n) => 
          n.userId === userId ? { ...n, isRead: true } : n
        );
        if (isClient) {
          localStorage.setItem('wiki_notifications', JSON.stringify(updatedNotifications));
        }
        
        const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
        newVfs['notifications.json'] = updatedNotifications;
        if (isClient) {
          localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
        }

        return { notifications: updatedNotifications, virtualFileSystem: newVfs };
      });
    },

    clearNotifications: (userId) => {
      set((state) => {
        const updatedNotifications = state.notifications.filter((n) => n.userId !== userId);
        if (isClient) {
          localStorage.setItem('wiki_notifications', JSON.stringify(updatedNotifications));
        }
        
        const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
        newVfs['notifications.json'] = updatedNotifications;
        if (isClient) {
          localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
        }

        return { notifications: updatedNotifications, virtualFileSystem: newVfs };
      });
    },

    login: async (username, password) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!data.success || !data.user) {
          return false;
        }
        if (isClient) {
          safeSetItem('wiki_current_user', JSON.stringify(data.user));
        }
        set({ currentUser: data.user });
        return true;
      } catch (err) {
        console.error('Login request failed:', err instanceof Error ? err.message : 'unknown error');
        return false;
      }
    },

    logout: () => {
      if (isClient) {
        localStorage.removeItem('wiki_current_user');
        localStorage.removeItem('wiki_impersonator_user');
      }
      set({ currentUser: null, impersonatorUser: null });
    },

    setCurrentUser: (user) => {
      if (isClient) {
        if (user) {
          localStorage.setItem('wiki_current_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('wiki_current_user');
        }
      }
      set({ currentUser: user });
    },

    impersonateUser: (targetUserId) => {
      set((state) => {
        const vfsUsers = state.virtualFileSystem['users.json'] || [];
        const targetUser = vfsUsers.find((u: User) => u.id === targetUserId);
        if (!targetUser) return {};
        
        const originalAdmin = state.currentUser;
        if (!originalAdmin) return {};
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('wiki_impersonator_user', JSON.stringify(originalAdmin));
          localStorage.setItem('wiki_current_user', JSON.stringify(targetUser));
        }
        
        return {
          currentUser: targetUser,
          impersonatorUser: originalAdmin
        };
      });
    },

    stopImpersonating: () => {
      set((state) => {
        const originalAdmin = state.impersonatorUser;
        if (!originalAdmin) return {};
        
        if (isClient) {
          localStorage.removeItem('wiki_impersonator_user');
          localStorage.setItem('wiki_current_user', JSON.stringify(originalAdmin));
        }
        
        return {
          currentUser: originalAdmin,
          impersonatorUser: null
        };
      });
    },

    addUser: (newUserPayload) => {
      let result: { success: boolean; error?: string } = { success: true };
      set((state) => {
        const exists = state.users.some(
          (u) => u.username.toLowerCase() === newUserPayload.username.toLowerCase()
        );
        if (exists) {
          result = { success: false, error: 'User already exists' };
          return {};
        }

        const newUser: User = {
          ...newUserPayload,
          id: `user-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          status: 'ACTIVE',
          requiresPasswordChange: false,
          profilePic: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
          sessionVersion: 1,
          email: `${newUserPayload.username}@enterprise.wiki`
        };

        const userGuideDoc: WikiDocument = {
          id: `user-guide-${newUser.id}`,
          title: '📘 User Guide: Getting Started with Wiki Workspace',
          lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ownerId: newUser.id,
          visibility: 'PRIVATE',
          collaborators: [],
          teamCollaborators: [],
          sharedWith: [{ userId: newUser.id, role: 'Admin' }],
          content: `<h1>Welcome to your Wiki Workspace, ${newUser.username}!</h1>
<p>This is your personal introduction page. Only you have access to this page, and you can edit or delete it as you see fit.</p>

<h2>🚀 What you can do as a Normal User:</h2>

<h3>1. Create Your Own Wikis</h3>
<p>Click on the <strong>+ New Document</strong> button in the left sidebar to create a new wiki document. By default, newly created documents are <strong>Private</strong> to you, but you can share them or assign them to a team.</p>

<h3>2. Workspace & Team Collaboration</h3>
<p>In the sidebar, you can see <strong>Workspace Teams</strong> that you are a member of. Inside each team folder, you can access, read, and edit the wiki documents belonging to that team.</p>

<h3>3. Share & Control Access</h3>
<p>Want to work with others on a private wiki? Click the <strong>Share</strong> button at the top of the editor. You can invite specific users as Viewers or Editors, or publish the wiki to the entire Workspace.</p>

<h3>4. Review Document History & Comments</h3>
<ul>
  <li>Click <strong>History</strong> to view previous versions of your document and restore them if needed.</li>
  <li>Click <strong>Comments</strong> to discuss content with other team members in real-time.</li>
</ul>

<h3>5. Export Documents</h3>
<p>Need your documentation offline? Click the <strong>Export</strong> button to download individual pages as Word (DOCX) or PDF format, or export multiple pages simultaneously using the bulk exporter.</p>

<p><em>Have fun documenting and collaborating! If you have any questions, contact your system administrator.</em></p>`
        };

        const updatedUsers = [...state.users, newUser];
        const updatedDocs = [userGuideDoc, ...state.documents];

        // Also update virtualFileSystem users list and pages
        const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
        newVfs['users.json'] = updatedUsers;
        if (!newVfs.pages) newVfs.pages = {};
        if (!newVfs.pages['workspace']) newVfs.pages['workspace'] = {};
        newVfs.pages['workspace'][`${userGuideDoc.id}.json`] = userGuideDoc;

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          safeSetItem('virtual_file_system', JSON.stringify(newVfs));
        }
        return { 
          users: updatedUsers, 
          documents: updatedDocs,
          virtualFileSystem: newVfs
        };
      });
      return result;
    },

    deleteUser: (id) => {
      let result = { success: true };
      set((state) => {
        // Prevent deleting self
        if (state.currentUser?.id === id) {
          result = { success: false };
          return {};
        }

        const updatedUsers = state.users.filter((u) => u.id !== id);
        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        // Clean up document collaborators
        const updatedDocs = state.documents.map((doc) => {
          const hasCollab = doc.collaborators.some(c => c.userId === id);
          if (hasCollab) {
            return {
              ...doc,
              collaborators: doc.collaborators.filter((c) => c.userId !== id),
            };
          }
          return doc;
        });

        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }

        return { users: updatedUsers, documents: updatedDocs };
      });
      return result;
    },

    createDocument: (docPayload) => {
      if (get().currentUser?.role === 'VIEWER' && docPayload.ownerId !== get().currentUser?.id) {
        throw new Error('Permission denied: Viewers cannot create documents.');
      }
      const newDoc: WikiDocument = {
        ...docPayload,
        id: docPayload.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        visibility: docPayload.visibility || 'PRIVATE',
        collaborators: docPayload.collaborators || [],
        teamCollaborators: docPayload.teamCollaborators || [],
        sharedWith: docPayload.sharedWith || (docPayload.ownerId ? [{ userId: docPayload.ownerId, role: 'Admin' as const }] : []),
        lastUpdated: docPayload.lastUpdated || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      set((state) => {
        const updatedDocs = [newDoc, ...state.documents];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });

      return newDoc;
    },

    updateDocument: (id, updates) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === id) {
            return {
              ...doc,
              ...updates,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          }
          return doc;
        });

        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    deleteDocument: (id) => {
      set((state) => {
        const updatedDocs = state.documents.filter((doc) => doc.id !== id);
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    softDeleteDocument: (id) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === id) {
            return { ...doc, isDeleted: true };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    restoreDocument: (id) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === id) {
            return { ...doc, isDeleted: false };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    setDocuments: (docs) => {
      if (isClient) {
        safeSetItem('wiki_documents_list2', JSON.stringify(docs));
      }
      set({ documents: docs });
    },

    shareDocument: (docId, userId, access) => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const exists = doc.collaborators.some((c) => c.userId === userId);
            const filtered = doc.collaborators.filter((c) => c.userId !== userId);
            const newCollab = [...filtered, { userId, access }];
            if (!exists) {
              newNotifs.push(createNotification(userId, 'ACCESS_GRANTED', `You were granted ${access} access to ${doc.title}`, doc.id));
            }
            return { ...doc, collaborators: newCollab };
          }
          return doc;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { documents: updatedDocs, notifications };
      });
    },

    revokeAccess: (docId, userId) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            return {
              ...doc,
              collaborators: doc.collaborators.filter((c) => c.userId !== userId),
            };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    updateAccessLevel: (docId, userId, access) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const newCollabs = doc.collaborators.map((c) => {
              if (c.userId === userId) {
                return { ...c, access };
              }
              return c;
            });
            return { ...doc, collaborators: newCollabs };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    toggleVisibility: (docId) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            return {
              ...doc,
              visibility: (doc.visibility === 'PRIVATE' ? 'WORKSPACE' : 'PRIVATE') as 'PRIVATE' | 'WORKSPACE',
            };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    setVisibility: (docId, visibility) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            return { ...doc, visibility };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    toggleSharedWith: (docId, userId, defaultRole = 'Viewer') => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const currentSharedWith = doc.sharedWith || [];
            const isShared = currentSharedWith.some((s) => s.userId === userId);
            const newSharedWith = isShared
              ? currentSharedWith.filter((s) => s.userId !== userId)
              : [...currentSharedWith, { userId, role: defaultRole }];
            if (!isShared) {
              newNotifs.push(createNotification(userId, 'ACCESS_GRANTED', `You were granted access to ${doc.title}`, doc.id));
            }
            return { ...doc, sharedWith: newSharedWith };
          }
          return doc;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { documents: updatedDocs, notifications };
      });
    },

    updateSharedUserRole: (docId, userId, role) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const currentSharedWith = doc.sharedWith || [];
            const newSharedWith = currentSharedWith.map((s) =>
              s.userId === userId ? { ...s, role } : s
            );
            return { ...doc, sharedWith: newSharedWith };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    updateUserRole: (userId, role) => {
      set((state) => {
        const updatedUsers = state.users.map((u) => {
          if (u.id === userId) {
            const updated = { ...u, role };
            return updated;
          }
          return u;
        });

        // Sync with currentUser if their own role changed
        let activeCurrentUser = state.currentUser;
        if (state.currentUser?.id === userId) {
          activeCurrentUser = { ...state.currentUser, role };
          if (isClient) {
            localStorage.setItem('wiki_current_user', JSON.stringify(activeCurrentUser));
          }
        }

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        return { 
          users: updatedUsers,
          currentUser: activeCurrentUser
        };
      });
    },

    updateUserStatus: (userId, status) => {
      set((state) => {
        const updatedUsers = state.users.map((u) => {
          if (u.id === userId) {
            return { ...u, status };
          }
          return u;
        });

        let activeCurrentUser = state.currentUser;
        if (state.currentUser?.id === userId) {
          activeCurrentUser = { ...state.currentUser, status };
          if (isClient) {
            localStorage.setItem('wiki_current_user', JSON.stringify(activeCurrentUser));
          }
        }

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        return {
          users: updatedUsers,
          currentUser: activeCurrentUser
        };
      });
    },

    updateUserProfile: (userId, updates) => {
      set((state) => {
        const updatedUsers = state.users.map((u) => {
          if (u.id === userId) {
            return { ...u, ...updates };
          }
          return u;
        });

        let activeCurrentUser = state.currentUser;
        if (state.currentUser?.id === userId) {
          activeCurrentUser = { ...state.currentUser, ...updates };
          if (isClient) {
            localStorage.setItem('wiki_current_user', JSON.stringify(activeCurrentUser));
          }
        }

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        return {
          users: updatedUsers,
          currentUser: activeCurrentUser
        };
      });
    },

    resetUserPassword: (userId, newPassword, forceChange) => {
      set((state) => {
        const updatedUsers = state.users.map((u) => {
          if (u.id === userId) {
            return { ...u, requiresPasswordChange: forceChange };
          }
          return u;
        });

        let activeCurrentUser = state.currentUser;
        if (state.currentUser?.id === userId) {
          activeCurrentUser = { ...state.currentUser, requiresPasswordChange: forceChange };
          if (isClient) {
            localStorage.setItem('wiki_current_user', JSON.stringify(activeCurrentUser));
          }
        }

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        return {
          users: updatedUsers,
          currentUser: activeCurrentUser
        };
      });
    },

    revokeUserSessions: (userId) => {
      set((state) => {
        const updatedUsers = state.users.map((u) => {
          if (u.id === userId) {
            return { ...u, sessionVersion: (u.sessionVersion || 1) + 1 };
          }
          return u;
        });

        let activeCurrentUser = state.currentUser;
        if (state.currentUser?.id === userId) {
          activeCurrentUser = { ...state.currentUser, sessionVersion: (state.currentUser.sessionVersion || 1) + 1 };
          if (isClient) {
            localStorage.setItem('wiki_current_user', JSON.stringify(activeCurrentUser));
          }
        }

        if (isClient) {
          localStorage.setItem('wiki_users_list2', JSON.stringify(updatedUsers));
        }

        return {
          users: updatedUsers,
          currentUser: activeCurrentUser
        };
      });
    },

    addAuditLog: (adminId, action, details, targetUserId) => {
      set((state) => {
        const adminUser = state.users.find(u => u.id === adminId);
        const adminName = adminUser ? adminUser.username : 'Unknown Admin';
        const newLog: AuditLog = {
          id: `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          adminId,
          adminName,
          action,
          targetUserId,
          details,
          timestamp: new Date().toLocaleString()
        };

        const updatedLogs = [newLog, ...state.auditLogs];
        if (isClient) {
          localStorage.setItem('wiki_audit_logs', JSON.stringify(updatedLogs));
        }

        return { auditLogs: updatedLogs };
      });
    },

    createTeam: (name, members) => {
      const newTeam: Team = {
        id: `team-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        name,
        members,
      };
      set((state) => {
        let newNotifs: Notification[] = [];
        members.forEach(m => {
          if (m.userId !== state.currentUser?.id) {
            newNotifs.push(createNotification(m.userId, 'ACCESS_GRANTED', `You were added to team ${name}`));
          }
        });
        const updatedTeams = [...state.teams, newTeam];
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          localStorage.setItem('wiki_teams_list', JSON.stringify(updatedTeams));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { teams: updatedTeams, notifications };
      });
      return newTeam;
    },

    deleteTeam: (id) => set((state) => {
      const updatedTeams = state.teams.map(team => 
        team.id === id 
          ? { ...team, isTrashed: true, trashedAt: new Date().toISOString() } 
          : team
      );
      if (isClient) {
        localStorage.setItem('wiki_teams_list', JSON.stringify(updatedTeams));
      }

      // Sync with Virtual File System (teams.json)
      const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
      newVfs['teams.json'] = updatedTeams;
      if (isClient) {
        localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
      }

      return { teams: updatedTeams, virtualFileSystem: newVfs };
    }),

    restoreTeam: (id) => set((state) => {
      const updatedTeams = state.teams.map(team => 
        team.id === id 
          ? { ...team, isTrashed: false, trashedAt: null } 
          : team
      );
      if (isClient) {
        localStorage.setItem('wiki_teams_list', JSON.stringify(updatedTeams));
      }

      // Sync with Virtual File System (teams.json)
      const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
      newVfs['teams.json'] = updatedTeams;
      if (isClient) {
        localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
      }

      return { teams: updatedTeams, virtualFileSystem: newVfs };
    }),

    permanentlyDeleteTeam: (id) => set((state) => {
      const updatedTeams = state.teams.filter(team => team.id !== id);
      if (isClient) {
        localStorage.setItem('wiki_teams_list', JSON.stringify(updatedTeams));
      }

      // Sync with Virtual File System (teams.json)
      const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
      newVfs['teams.json'] = updatedTeams;
      if (isClient) {
        localStorage.setItem('virtual_file_system', JSON.stringify(newVfs));
      }

      // Clean up documents teamCollaborators shared with this team
      const updatedDocs = state.documents.map((doc) => {
        const teamCollabs = doc.teamCollaborators || [];
        const hasCollab = teamCollabs.some(c => c.teamId === id);
        if (hasCollab) {
          return {
            ...doc,
            teamCollaborators: teamCollabs.filter((c) => c.teamId !== id),
          };
        }
        return doc;
      });

      if (isClient) {
        safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
      }

      return { teams: updatedTeams, documents: updatedDocs, virtualFileSystem: newVfs };
    }),

    updateTeamMembers: (id, members) => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const oldTeam = state.teams.find(t => t.id === id);
        
        if (oldTeam) {
          members.forEach(m => {
            const exists = oldTeam.members.some(om => om.userId === m.userId);
            if (!exists && m.userId !== state.currentUser?.id) {
              newNotifs.push(createNotification(m.userId, 'ACCESS_GRANTED', `You were added to team ${oldTeam.name}`));
            }
          });
        }
        
        const updatedTeams = state.teams.map((t) => {
          if (t.id === id) {
            return { ...t, members };
          }
          return t;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          localStorage.setItem('wiki_teams_list', JSON.stringify(updatedTeams));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { teams: updatedTeams, notifications };
      });
    },

    shareDocumentWithTeam: (docId, teamId, access) => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const teamCollabs = doc.teamCollaborators || [];
            const exists = teamCollabs.some((c) => c.teamId === teamId);
            const filtered = teamCollabs.filter((c) => c.teamId !== teamId);
            const newTeamCollab = [...filtered, { teamId, access }];
            if (!exists) {
              const team = state.teams.find(t => t.id === teamId);
              team?.members.forEach(m => {
                if (m.userId !== state.currentUser?.id) {
                  newNotifs.push(createNotification(m.userId, 'ACCESS_GRANTED', `Team ${team.name} was granted access to ${doc.title}`, doc.id));
                }
              });
            }
            return { ...doc, teamCollaborators: newTeamCollab };
          }
          return doc;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { documents: updatedDocs, notifications };
      });
    },

    revokeTeamAccess: (docId, teamId) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const teamCollabs = doc.teamCollaborators || [];
            return {
              ...doc,
              teamCollaborators: teamCollabs.filter((c) => c.teamId !== teamId),
            };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    updateTeamAccessLevel: (docId, teamId, access) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const teamCollabs = doc.teamCollaborators || [];
            const newTeamCollabs = teamCollabs.map((c) => {
              if (c.teamId === teamId) {
                return { ...c, access };
              }
              return c;
            });
            return { ...doc, teamCollaborators: newTeamCollabs };
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    saveVersion: (docId, content, authorId, name) => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const history = doc.history || [];
            const newVersion = {
              versionId: `v-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              timestamp: new Date().toISOString(),
              content,
              authorId,
              name: name || `Version ${new Date().toLocaleTimeString()}`
            };
            
            const usersWithAccess = state.users.filter(u => u.id !== authorId && userHasDocAccess(doc, u.id, state));
            usersWithAccess.forEach(u => {
              newNotifs.push(createNotification(u.id, 'VERSION_PUBLISHED', `A new version was published in ${doc.title}`, doc.id));
            });
            
            const mentionsMatch = Array.from(content.matchAll(/@([a-zA-Z0-9_.-]+)/g)).map(m => m[1]);
            const mentionedUsers = state.users.filter(u => mentionsMatch.includes(u.username) && u.id !== authorId && userHasDocAccess(doc, u.id, state));
            mentionedUsers.forEach(u => {
              newNotifs.push(createNotification(u.id, 'MENTION', `You were mentioned in ${doc.title}`, doc.id));
            });

            return { 
              ...doc, 
              content,
              history: [newVersion, ...history],
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          }
          return doc;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { documents: updatedDocs, notifications };
      });
    },

    restoreVersion: (docId, versionId) => {
      set((state) => {
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const version = doc.history?.find((v) => v.versionId === versionId);
            if (version) {
              return { ...doc, content: version.content, lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            }
          }
          return doc;
        });
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
        }
        return { documents: updatedDocs };
      });
    },

    addComment: (docId, text, authorId, targetText) => {
      set((state) => {
        let newNotifs: Notification[] = [];
        const updatedDocs = state.documents.map((doc) => {
          if (doc.id === docId) {
            const comments = doc.comments || [];
            const newComment = {
              commentId: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              text,
              authorId,
              targetText,
              timestamp: new Date().toISOString()
            };
            
            const usersWithAccess = state.users.filter(u => u.id !== authorId && userHasDocAccess(doc, u.id, state));
            usersWithAccess.forEach(u => {
              newNotifs.push(createNotification(u.id, 'COMMENT_ADDED', `A comment was added to ${doc.title}`, doc.id));
            });

            const mentionsMatch = Array.from(text.matchAll(/@([a-zA-Z0-9_.-]+)/g)).map(m => m[1]);
            const mentionedUsers = state.users.filter(u => mentionsMatch.includes(u.username) && u.id !== authorId && userHasDocAccess(doc, u.id, state));
            mentionedUsers.forEach(u => {
              newNotifs.push(createNotification(u.id, 'MENTION', `You were mentioned in a comment on ${doc.title}`, doc.id));
            });

            return { ...doc, comments: [...comments, newComment] };
          }
          return doc;
        });
        const notifications = [...newNotifs, ...state.notifications];
        if (isClient) {
          safeSetItem('wiki_documents_list2', JSON.stringify(updatedDocs));
          localStorage.setItem('wiki_notifications', JSON.stringify(notifications));
        }
        return { documents: updatedDocs, notifications };
      });
    },
    loadFromServer: async () => {
      if (!isClient) return;
      try {
        const res = await fetch('/api/vfs');
        const json = await res.json();
        if (json.exists && json.data) {
          originalSet({
            users: json.data.users || [],
            documents: json.data.documents || [],
            teams: json.data.teams || [],
            auditLogs: json.data.auditLogs || [],
            virtualFileSystem: json.data.virtualFileSystem || get().virtualFileSystem
          });
        } else {
          saveToServer();
        }
      } catch (err) {
        console.error('Failed to load database from server:', err);
      }
    },
  };
});

// eslint-disable-next-line react-hooks/rules-of-hooks
export function readFile(path: string) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWikiStore(state => {
    const parts = path.split('/');
    let current: any = state.virtualFileSystem;
    for (const p of parts) {
      if (current === undefined) return null;
      current = current[p];
    }
    return current;
  });
}

export function writeFile(path: string, content: any) {
  useWikiStore.setState(state => {
    const parts = path.split('/');
    const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
    let current = newVfs;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = content;
    
    if (typeof window !== 'undefined') {
      safeSetItem('virtual_file_system', JSON.stringify(newVfs));
    }
    
    return { virtualFileSystem: newVfs };
  });
}

export function addAuditLogVFS(adminId: string, action: string, details: string, targetUserId?: string, metadata?: any) {
  useWikiStore.setState(state => {
    const adminUser = state.users.find(u => u.id === adminId);
    const adminName = adminUser ? adminUser.username : 'Unknown User';
    
    const parts = 'audit-logs.json'.split('/');
    let currentVfs: any = state.virtualFileSystem;
    let auditLogsJson: any[] = [];
    try {
      let current = currentVfs;
      for (let i = 0; i < parts.length; i++) {
        current = current?.[parts[i]];
      }
      if (Array.isArray(current)) {
        auditLogsJson = current;
      }
    } catch (e) {
      console.error(e);
    }

    const newLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      adminId,
      adminName,
      action,
      details,
      targetUserId,
      timestamp: new Date().toISOString(),
      metadata
    };

    const updatedLogs = [newLog, ...auditLogsJson];
    
    const newVfs = JSON.parse(JSON.stringify(state.virtualFileSystem));
    newVfs['audit-logs.json'] = updatedLogs;

    if (typeof window !== 'undefined') {
      safeSetItem('virtual_file_system', JSON.stringify(newVfs));
    }

    return { 
      virtualFileSystem: newVfs,
      auditLogs: [newLog, ...state.auditLogs]
    };
  });
}

if (typeof window !== 'undefined') {
  idbGet('wiki_documents_list2').then((val) => {
    if (val) {
      try {
        useWikiStore.setState({ documents: JSON.parse(val as string) });
      } catch (e) {
        console.error("Failed to parse documents from idb", e);
      }
    }
  });
  idbGet('virtual_file_system').then((val) => {
    if (val) {
      try {
        const vfs = JSON.parse(val as string);
        let hasChanges = false;
        if (vfs && Array.isArray(vfs['teams.json'])) {
          vfs['teams.json'] = vfs['teams.json'].map((t: any) => {
            if (t.name === 'Leo team' || t.name === 'Leo Team' || t.name.trim().toLowerCase() === 'leo team') {
              hasChanges = true;
              return { ...t, name: 'Payit123' };
            }
            return t;
          });
        }
        if (hasChanges) {
          idbSet('virtual_file_system', JSON.stringify(vfs)).catch(console.error);
        }
        useWikiStore.setState({ virtualFileSystem: vfs });
      } catch (e) {
        console.error("Failed to parse vfs from idb", e);
      }
    }
  });
}
