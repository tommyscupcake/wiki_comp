'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWikiStore, User, AuditLog, readFile, writeFile, addAuditLogVFS } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  Key,
  Check,
  X,
  User as UserIcon,
  FileSpreadsheet,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  LogOut,
  Mail,
  Image as ImageIcon,
  UserCheck,
  Search,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';

const STANDARD_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
];

export default function AdminUsersPage() {
  return <AdminUsersPageContent isTabbed={false} />;
}

export function AdminUsersPageContent({ isTabbed = false }: { isTabbed?: boolean }) {
  const router = useRouter();
  const {
    impersonateUser
  } = useWikiStore();

  const users = readFile('users.json') || [];
  
  const sessionUser = useWikiStore(state => state.currentUser);
  const currentUser = readFile('users.json')?.find((u: any) => u.id === useWikiStore.getState().currentUser?.id) || sessionUser;

  const handleAddAuditLog = (adminId: string, action: string, details: string, targetUserId?: string, metadata?: any) => {
    addAuditLogVFS(adminId, action, details, targetUserId, metadata);
  };

  const handleAddUser = async (user: Omit<User, 'id' | 'status' | 'requiresPasswordChange' | 'sessionVersion'> & { password: string }) => {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!data.success || !data.user) {
      return { success: false, error: data.error || 'Failed to create user' };
    }
    writeFile('users.json', [...users, data.user]);
    return { success: true };
  };

  const handleDeleteUser = async (id: string) => {
    const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.filter((u: User) => u.id !== id));
    return { success: true };
  };

  const handleUpdateUserRole = async (userId: string, role: 'ADMIN' | 'CREATOR' | 'VIEWER') => {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.map((u: User) => u.id === userId ? { ...u, role } : u));
    return { success: true };
  };

  const handleUpdateUserStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.map((u: User) => u.id === userId ? { ...u, status } : u));
    return { success: true };
  };

  const handleUpdateUserProfile = async (userId: string, updates: any) => {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.map((u: User) => u.id === userId ? { ...u, ...updates } : u));
    return { success: true };
  };

  const handleResetUserPassword = async (userId: string, newPassword: string | undefined, forceChange: boolean) => {
    const res = await fetch(`/api/auth/users/${userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword, forceChange }),
    });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.map((u: User) => u.id === userId ? { ...u, requiresPasswordChange: forceChange } : u));
    return { success: true };
  };

  const handleRevokeUserSessions = async (userId: string) => {
    const res = await fetch(`/api/auth/users/${userId}/revoke-sessions`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    writeFile('users.json', users.map((u: User) => u.id === userId ? { ...u, sessionVersion: data.sessionVersion } : u));
    return { success: true };
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'CREATOR' | 'VIEWER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ALL');

  // Selected users for Bulk Actions
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Create User modal form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'CREATOR' | 'VIEWER'>('VIEWER');
  const [createEmail, setCreateEmail] = useState('');
  const [createProfilePic, setCreateProfilePic] = useState(STANDARD_AVATARS[1]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'CREATOR' | 'VIEWER'>('VIEWER');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>('ACTIVE');
  const [editProfilePic, setEditProfilePic] = useState('');
  const [manualResetPassword, setManualResetPassword] = useState('');
  const [forcePasswordResetNext, setForcePasswordResetNext] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security check: Only allow ADMINs
  useEffect(() => {
    if (!isTabbed && currentUser && currentUser.role !== 'ADMIN') {
      alert('403 Unauthorized: Admin role is required to access this resource.');
      router.replace('/');
    }
  }, [currentUser, router, isTabbed]);

  // Log directory access
  useEffect(() => {
    if (currentUser && currentUser.role === 'ADMIN') {
      handleAddAuditLog(currentUser.id, 'ACCESS_CONSOLE', 'Accessed the User Management Console directory.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast notifier
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 1. Create User Flow
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setCreateError(null);

    if (!username.trim() || !password.trim()) {
      setCreateError('Username and Password Key are required fields.');
      return;
    }

    const payload = {
      username: username.trim(),
      password: password.trim(),
      role,
      email: createEmail.trim() || `${username.trim()}@enterprise.wiki`,
      profilePic: createProfilePic
    };

    const res = await handleAddUser(payload);

    if (res.success) {
      // Need to find it from the updated store, or just use the generated ID if we had it, but here we can just log it
      handleAddAuditLog(
        currentUser.id,
        'USER_CREATE',
        `Registered new account "${payload.username}" as ${payload.role}.`,
        undefined,
        {
          userName: payload.username,
          userEmail: payload.email,
          role: payload.role
        }
      );

      setUsername('');
      setPassword('');
      setCreateEmail('');
      setRole('VIEWER');
      setCreateProfilePic(STANDARD_AVATARS[1]);
      setIsCreateModalOpen(false);
      showToast(`User "${payload.username}" created successfully`);
    } else {
      setCreateError(res.error || 'Failed to register account');
    }
  };

  // 2. Open Edit Dialog
  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditEmail(user.email || '');
    setEditRole(user.role);
    setEditStatus(user.status || 'ACTIVE');
    setEditProfilePic(user.profilePic || STANDARD_AVATARS[0]);
    setManualResetPassword('');
    setForcePasswordResetNext(user.requiresPasswordChange || false);
    setEditError(null);
  };

  // 3. Save Edit Changes
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!editingUser) return;
    setEditError(null);

    if (!editUsername.trim()) {
      setEditError('Username cannot be empty.');
      return;
    }

    // Verify username does not clash with another account
    const usernameClash = users.some((u: any) => u.id !== editingUser.id && u.username.toLowerCase() === editUsername.trim().toLowerCase());
    if (usernameClash) {
      setEditError('Another user is already registered with this username.');
      return;
    }

    // Update Profile
    await handleUpdateUserProfile(editingUser.id, {
      username: editUsername.trim(),
      email: editEmail.trim() || `${editUsername.trim()}@enterprise.wiki`,
      role: editRole,
      profilePic: editProfilePic
    });

    // Update Status
    if (editingUser.id !== currentUser.id) {
      await handleUpdateUserStatus(editingUser.id, editStatus);
    }

    // Smart Passwords Manual reset / force change logic
    if (manualResetPassword.trim()) {
      await handleResetUserPassword(editingUser.id, manualResetPassword.trim(), forcePasswordResetNext);
    } else if (forcePasswordResetNext !== editingUser.requiresPasswordChange) {
      // Only the force-change flag changed; leave the stored password hash untouched
      await handleResetUserPassword(editingUser.id, undefined, forcePasswordResetNext);
    }

    // Write audit logs
    handleAddAuditLog(
      currentUser.id,
      'USER_UPDATE',
      `Modified configuration profile for "${editUsername.trim()}". Status: ${editStatus}, Role: ${editRole}, Force Password Reset: ${forcePasswordResetNext ? 'YES' : 'NO'}.`,
      editingUser.id
    );

    setEditingUser(null);
    showToast(`User settings saved successfully`);
  };

  // 4. Session Revocation (individual)
  const handleRevokeSessionIndividual = async (userId: string, username: string) => {
    if (!currentUser) return;
    if (confirm(`Are you sure you want to terminate all active login sessions for "${username}"? They will be logged out immediately.`)) {
      const res = await handleRevokeUserSessions(userId);
      if (!res.success) {
        showToast(res.error || `Failed to revoke sessions for "${username}"`);
        return;
      }
      handleAddAuditLog(currentUser.id, 'SESSION_REVOKE', `Revoked all active sessions for account "${username}".`, userId);
      showToast(`Sessions revoked for "${username}"`);
      if (editingUser && editingUser.id === userId) {
        setEditingUser(prev => prev ? { ...prev, sessionVersion: (prev.sessionVersion || 1) + 1 } : null);
      }
    }
  };

  // 5. Impersonation / "Login As"
  const handleImpersonateClick = (targetUser: User) => {
    if (!currentUser) return;
    if (targetUser.id === currentUser.id) {
      alert('You cannot impersonate yourself.');
      return;
    }

    if (targetUser.status === 'SUSPENDED' || targetUser.status === 'BANNED') {
      alert('Cannot impersonate inactive/suspended accounts.');
      return;
    }

    handleAddAuditLog(
      currentUser.id,
      'IMPERSONATION_START',
      `Started impersonating user session "${targetUser.username}".`,
      targetUser.id
    );

    impersonateUser(targetUser.id);
    router.push('/');
  };

  // 6. Delete User Individual
  const handleDeleteIndividual = async (id: string, name: string) => {
    if (!currentUser) return;
    if (id === currentUser.id) {
      alert('You cannot delete your own admin account.');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete user "${name}"? This action cannot be undone.`)) {
      const res = await handleDeleteUser(id);
      if (res.success) {
        handleAddAuditLog(currentUser.id, 'USER_DELETE', `Permanently deleted user account "${name}".`, id);
        showToast(`User "${name}" deleted successfully`);
        setSelectedUserIds(prev => prev.filter((uid: string) => uid !== id));
      } else {
        showToast(res.error || `Failed to delete user "${name}"`);
      }
    }
  };

  // 7. Bulk Actions Logic
  const handleToggleSelectAll = () => {
    if (!currentUser) return;
    const listToSelect = filteredUsers.filter((u: any) => u.id !== currentUser.id);
    const allSelected = listToSelect.every((u: any) => selectedUserIds.includes(u.id));

    if (allSelected) {
      // Deselect all filtered
      setSelectedUserIds(prev => prev.filter((id: string) => !listToSelect.some((u: any) => u.id === id)));
    } else {
      // Add all filtered
      const newSelections = [...selectedUserIds];
      listToSelect.forEach((u: any) => {
        if (!newSelections.includes(u.id)) {
          newSelections.push(u.id);
        }
      });
      setSelectedUserIds(newSelections);
    }
  };

  const handleToggleSelectUser = (id: string) => {
    if (!currentUser || id === currentUser.id) return;
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter((uid: string) => uid !== id) : [...prev, id]
    );
  };

  const executeBulkAction = async (actionType: 'DELETE' | 'SUSPEND' | 'BAN' | 'REVOKE_SESSIONS' | 'MAKE_ADMIN' | 'MAKE_CREATOR' | 'MAKE_VIEWER') => {
    if (!currentUser) return;
    if (selectedUserIds.length === 0) return;

    const count = selectedUserIds.length;
    let message = '';
    switch (actionType) {
      case 'DELETE':
        message = `Are you sure you want to permanently delete the ${count} selected accounts?`;
        break;
      case 'SUSPEND':
        message = `Are you sure you want to suspend the ${count} selected accounts?`;
        break;
      case 'BAN':
        message = `Are you sure you want to ban the ${count} selected accounts?`;
        break;
      case 'REVOKE_SESSIONS':
        message = `Are you sure you want to terminate all active sessions for the ${count} selected accounts?`;
        break;
      default:
        message = `Apply role update to the ${count} selected accounts?`;
    }

    if (!confirm(message)) return;

    let failures = 0;
    for (const id of selectedUserIds) {
      const u = users.find((x: any) => x.id === id);
      if (!u || u.id === currentUser.id) continue;

      let res: { success: boolean; error?: string } = { success: true };
      if (actionType === 'DELETE') {
        res = await handleDeleteUser(id);
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_DELETE', `Bulk deleted user account "${u.username}".`, id);
      } else if (actionType === 'SUSPEND') {
        res = await handleUpdateUserStatus(id, 'SUSPENDED');
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_UPDATE', `Bulk suspended user account "${u.username}".`, id);
      } else if (actionType === 'BAN') {
        res = await handleUpdateUserStatus(id, 'BANNED');
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_UPDATE', `Bulk banned user account "${u.username}".`, id);
      } else if (actionType === 'REVOKE_SESSIONS') {
        res = await handleRevokeUserSessions(id);
        if (res.success) handleAddAuditLog(currentUser.id, 'SESSION_REVOKE', `Bulk revoked active sessions for "${u.username}".`, id);
      } else if (actionType === 'MAKE_ADMIN') {
        res = await handleUpdateUserRole(id, 'ADMIN');
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_UPDATE', `Bulk promoted "${u.username}" to ADMIN.`, id);
      } else if (actionType === 'MAKE_CREATOR') {
        res = await handleUpdateUserRole(id, 'CREATOR');
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_UPDATE', `Bulk updated "${u.username}" to CREATOR.`, id);
      } else if (actionType === 'MAKE_VIEWER') {
        res = await handleUpdateUserRole(id, 'VIEWER');
        if (res.success) handleAddAuditLog(currentUser.id, 'USER_UPDATE', `Bulk updated "${u.username}" to VIEWER.`, id);
      }
      if (!res.success) failures++;
    }

    setSelectedUserIds([]);
    showToast(failures === 0 ? `Bulk action applied to ${count} accounts.` : `Bulk action applied with ${failures} failure(s) out of ${count}.`);
  };

  // 8. CSV Export
  const handleExportCSV = () => {
    if (!currentUser) return;
    const headers = ['User ID', 'Username', 'Email', 'Role', 'Status', 'Requires Password Change', 'Session Version'];
    const rows = users.map((u: any) => [
      u.id,
      u.username,
      u.email || '',
      u.role,
      u.status || 'ACTIVE',
      u.requiresPasswordChange ? 'YES' : 'NO',
      u.sessionVersion || 1
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...rows.map((e: any) => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wiki_users_directory_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    handleAddAuditLog(currentUser.id, 'EXPORT_USERS_CSV', `Exported registered accounts directory as CSV file.`, currentUser.id);
    showToast('Exported users database successfully');
  };

  // Filter and search logic
  const filteredUsers = users.filter((u: any) => {
    const matchQuery =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || (u.status || 'ACTIVE') === statusFilter;

    return matchQuery && matchRole && matchStatus;
  });

  if (!isTabbed && (!currentUser || currentUser.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center p-6 bg-slate-900 border border-slate-850 rounded-xl max-w-sm">
          <ShieldAlert className="mx-auto text-red-500 mb-3" size={32} />
          <h1 className="text-slate-200 font-bold mb-1">Access Restricted</h1>
          <p className="text-xs text-slate-500">Redirecting to workspace...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => (
    <>
      {/* Toast alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl shadow-lg flex items-center gap-2"
          >
            <Check size={14} className="text-emerald-500 animate-bounce" />
            <span className="font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${isTabbed ? '' : 'max-w-6xl mx-auto'} space-y-6`}>
        {/* Navigation / Header */}
        {!isTabbed ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-1.5 hover:bg-slate-900 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                title="Back to Workspace"
                id="back-to-workspace"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                  Enterprise Management Console
                  <span className="text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">
                    Superadmin
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Configure directory state, Smart Passwords, Soft Deletes, Session state, and view secure audit trails.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg shadow cursor-pointer transition-all"
              >
                <FileSpreadsheet size={14} className="text-slate-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-blue-500/15 cursor-pointer transition-all"
              >
                <UserPlus size={14} />
                <span>Register User</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pb-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg shadow cursor-pointer transition-all"
            >
              <FileSpreadsheet size={14} className="text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-blue-500/15 cursor-pointer transition-all"
            >
              <UserPlus size={14} />
              <span>Register User</span>
            </button>
          </div>
        )}

        {/* Directory Tab View */}
        <div className="space-y-4">
          {/* Filtering Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                <input
                  type="text"
                  placeholder="Search accounts by name, email, or id..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-300 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="CREATOR">CREATOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-300 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
              {selectedUserIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare size={16} className="text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      {selectedUserIds.length} account{selectedUserIds.length > 1 ? 's' : ''} selected
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => executeBulkAction('REVOKE_SESSIONS')}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-indigo-500/20 text-slate-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Term Sessions
                    </button>
                    <button
                      onClick={() => executeBulkAction('MAKE_ADMIN')}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-indigo-500/20 text-slate-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Set Admin
                    </button>
                    <button
                      onClick={() => executeBulkAction('MAKE_CREATOR')}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-indigo-500/20 text-slate-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Set Creator
                    </button>
                    <button
                      onClick={() => executeBulkAction('MAKE_VIEWER')}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-indigo-500/20 text-slate-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Set Viewer
                    </button>
                    <button
                      onClick={() => executeBulkAction('SUSPEND')}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Suspend
                    </button>
                    <button
                      onClick={() => executeBulkAction('BAN')}
                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-mono uppercase rounded transition-all cursor-pointer"
                    >
                      Ban
                    </button>
                    <button
                      onClick={() => executeBulkAction('DELETE')}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono uppercase rounded transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={10} />
                      <span>Delete</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Registered Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-mono text-[9px] uppercase tracking-wider bg-slate-950/35 select-none">
                      <th className="py-3 px-4 w-10">
                        <button
                          onClick={handleToggleSelectAll}
                          className="text-slate-500 hover:text-slate-300 transition-colors"
                          title="Select All / None"
                        >
                          {filteredUsers.filter((u: any) => u.id !== currentUser.id).every((u: any) => selectedUserIds.includes(u.id)) ? (
                            <CheckSquare size={14} className="text-blue-400" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">User Profile</th>
                      <th className="py-3 px-4 font-semibold">Security Level (Role)</th>
                      <th className="py-3 px-4 font-semibold">Lifecycle Status</th>
                      <th className="py-3 px-4 font-semibold">Smart Passwords</th>
                      <th className="py-3 px-4 font-semibold">Session Version</th>
                      <th className="py-3 px-4 font-semibold text-right">Interactive Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                          No matching registered user directory accounts found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user: any) => (
                        <tr key={user.id} className="hover:bg-slate-950/40 transition-colors">
                          {/* Selection Checkbox */}
                          <td className="py-3 px-4">
                            {user.id !== currentUser.id ? (
                              <button
                                onClick={() => handleToggleSelectUser(user.id)}
                                className="text-slate-500 hover:text-indigo-400 transition-colors"
                              >
                                {selectedUserIds.includes(user.id) ? (
                                  <CheckSquare size={14} className="text-indigo-400" />
                                ) : (
                                  <Square size={14} />
                                )}
                              </button>
                            ) : (
                              <div className="h-3 w-3 bg-slate-800 rounded-sm" title="Locked Self" />
                            )}
                          </td>

                          {/* Profile */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <img
                                src={user.profilePic || STANDARD_AVATARS[0]}
                                alt={user.username}
                                className="h-8 w-8 rounded-full border border-slate-800 object-cover bg-slate-950"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-200 text-xs">@{user.username}</span>
                                  {user.id === currentUser.id && (
                                    <span className="text-[8px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded uppercase tracking-wider">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block">{user.email || `${user.username}@enterprise.wiki`}</span>
                                <span className="text-[9px] font-mono text-slate-600 block">{user.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono border ${
                                user.role === 'ADMIN'
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                  : user.role === 'CREATOR'
                                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              }`}
                            >
                              <Shield size={9} />
                              {user.role}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono border ${
                                (user.status || 'ACTIVE') === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : (user.status || 'ACTIVE') === 'SUSPENDED'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-300 border-red-500/20'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                (user.status || 'ACTIVE') === 'ACTIVE'
                                  ? 'bg-emerald-400'
                                  : (user.status || 'ACTIVE') === 'SUSPENDED'
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                              }`} />
                              {user.status || 'ACTIVE'}
                            </span>
                          </td>

                          {/* Smart Passwords Indicator */}
                          <td className="py-3 px-4 font-mono text-[10px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Key size={9} className="text-slate-500" />
                                ••••••••
                              </span>
                              {user.requiresPasswordChange && (
                                <span className="text-[8px] font-semibold text-amber-400 bg-amber-400/5 px-1 py-0.2 rounded border border-amber-400/10 uppercase tracking-wider w-max">
                                  Force Reset Pending
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Session Version */}
                          <td className="py-3 px-4 font-mono text-slate-400 text-[10px]">
                            v{user.sessionVersion || 1}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Impersonate */}
                              {user.id !== currentUser.id && (
                                <button
                                  onClick={() => handleImpersonateClick(user)}
                                  disabled={user.status === 'SUSPENDED' || user.status === 'BANNED'}
                                  className="px-2 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded text-[10px] font-semibold disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-mono"
                                  title={`Log in as ${user.username}`}
                                >
                                  LOGIN AS
                                </button>
                              )}

                              {/* Edit Modal trigger */}
                              <button
                                onClick={() => handleOpenEditModal(user)}
                                className="px-2 py-1 bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded text-[10px] font-semibold transition-all cursor-pointer font-mono"
                              >
                                EDIT
                              </button>

                              {/* Delete */}
                              {user.id !== currentUser.id && (
                                <button
                                  onClick={() => handleDeleteIndividual(user.id, user.username)}
                                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded transition-all cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

      </div>

      {/* CREATE USER DIALOG MODAL */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-10 p-6 relative"
            >
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-300 mb-5 flex items-center gap-1.5">
                <UserPlus size={15} className="text-blue-400" />
                Register New User
              </h3>

              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                {createError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-1.5">
                    <ShieldAlert size={14} className="flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. john_doe"
                      className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                      Password Key
                    </label>
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. keypass123"
                      className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="john@enterprise.wiki (Optional)"
                    className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 placeholder-slate-650 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                    Security Level (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'ADMIN' | 'CREATOR' | 'VIEWER')}
                    className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="VIEWER">VIEWER (Read Only)</option>
                    <option value="CREATOR">CREATOR (Produce & Edit)</option>
                    <option value="ADMIN">ADMIN (Full Control Access)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                    Select Profile Pic URL
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {STANDARD_AVATARS.map((av, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCreateProfilePic(av)}
                        className={`p-0.5 rounded-full border-2 transition-all overflow-hidden ${
                          createProfilePic === av ? 'border-blue-500 bg-blue-500/15' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <img src={av} alt="Avatar Selection" className="h-7 w-7 rounded-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded shadow-md transition-all cursor-pointer"
                  >
                    Register User
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER CONFIGURE MODAL (SLIDE-OUT DRAWER / MODAL) */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-10 p-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setEditingUser(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400 mb-5 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                <SlidersHorizontal size={14} className="text-indigo-400" />
                Configure User Directory Account: @{editingUser.username}
              </h3>

              <form onSubmit={handleSaveEditUser} className="space-y-5">
                {editError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-1.5">
                    <ShieldAlert size={14} className="flex-shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Profile Settings section */}
                <div className="space-y-3.5 bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                  <h4 className="text-[10px] font-bold font-mono uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <UserIcon size={11} /> Profile Details
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                        Security Role
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as any)}
                        className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-300 focus:outline-none cursor-pointer font-medium"
                      >
                        <option value="VIEWER">VIEWER (Read Only)</option>
                        <option value="CREATOR">CREATOR (Produce & Edit)</option>
                        <option value="ADMIN">ADMIN (Full Access)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                        Status (Soft Deletes)
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        disabled={editingUser.id === currentUser.id}
                        className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-300 focus:outline-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none font-semibold"
                      >
                        <option value="ACTIVE" className="text-emerald-400">ACTIVE</option>
                        <option value="SUSPENDED" className="text-amber-400">SUSPENDED</option>
                        <option value="BANNED" className="text-red-400">BANNED</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                      Edit Profile Picture URL
                    </label>
                    <input
                      type="text"
                      value={editProfilePic}
                      onChange={(e) => setEditProfilePic(e.target.value)}
                      className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 focus:outline-none transition-all font-mono"
                    />
                    <div className="flex items-center gap-1.5 mt-1">
                      {STANDARD_AVATARS.map((av, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditProfilePic(av)}
                          className={`h-6 w-6 rounded-full overflow-hidden border transition-all ${
                            editProfilePic === av ? 'border-indigo-400 scale-105' : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <img src={av} alt="Avatar option" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Smart Password reset controls */}
                <div className="space-y-3 bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                  <h4 className="text-[10px] font-bold font-mono uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <Key size={11} /> Smart Passwords Panel
                  </h4>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                        Set New Password Key
                      </label>
                      <input
                        type="text"
                        value={manualResetPassword}
                        onChange={(e) => setManualResetPassword(e.target.value)}
                        placeholder="Leave blank to preserve current password"
                        className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded text-xs text-slate-100 placeholder-slate-650 focus:outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                      <div>
                        <span className="text-[11px] font-bold text-slate-300 block">Force Password Change</span>
                        <span className="text-[9px] text-slate-500">Require user to configure a new password on their next login session.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForcePasswordResetNext(!forcePasswordResetNext)}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          forcePasswordResetNext ? 'bg-blue-600' : 'bg-slate-800'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                            forcePasswordResetNext ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced Operations: Session revoke */}
                <div className="space-y-3 bg-slate-950/45 p-3 rounded-xl border border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-[10px] font-bold font-mono uppercase tracking-wide text-slate-500 flex items-center gap-1">
                      <RefreshCw size={11} /> Session Control
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Terminates all active login web sessions. Current Version: <span className="font-mono text-indigo-400 font-bold">v{editingUser.sessionVersion || 1}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeSessionIndividual(editingUser.id, editingUser.username)}
                    className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 hover:text-rose-200 border border-rose-500/20 rounded text-[11px] font-semibold transition-all cursor-pointer font-mono uppercase"
                  >
                    Revoke Sessions
                  </button>
                </div>

                {/* Actions Row */}
                <div className="pt-3 border-t border-slate-850 flex items-center justify-between gap-2">
                  {editingUser.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const uid = editingUser.id;
                        const name = editingUser.username;
                        setEditingUser(null);
                        handleDeleteIndividual(uid, name);
                      }}
                      className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded text-xs font-semibold transition-all cursor-pointer"
                    >
                      Delete Account
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded shadow-md transition-all cursor-pointer"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (isTabbed) {
    return (
      <div className="text-slate-100 font-sans">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {renderContent()}
    </div>
  );
}
