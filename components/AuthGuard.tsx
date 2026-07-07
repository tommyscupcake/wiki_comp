'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWikiStore, readFile, writeFile } from '@/lib/store';
import { Loader2, ShieldAlert, Lock, ArrowRight, LogOut, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { impersonatorUser, logout, stopImpersonating } = useWikiStore();
  const [mounted, setMounted] = useState(false);

  const users = readFile('users.json') || [];
  const auditLogs = readFile('audit-logs.json') || [];
  const currentUser = useWikiStore(state => state.currentUser);

  const handleResetUserPassword = (userId: string, newPass: string, forceChange: boolean) => {
    writeFile('users.json', users.map((u: any) => u.id === userId ? { ...u, password: newPass, requiresPasswordChange: forceChange } : u));
  };
  
  const handleAddAuditLog = (adminId: string, action: string, details: string, targetUserId?: string) => {
    const newLog = {
      id: `log-${Date.now()}`,
      adminId,
      adminName: currentUser?.username || 'Unknown Admin',
      action,
      details,
      targetUserId,
      timestamp: new Date().toISOString()
    };
    writeFile('audit-logs.json', [newLog, ...auditLogs]);
  };

  // Password change local state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const isLoginPage = pathname === '/login';

  // Find latest user info from users list in the store
  const dbUser = currentUser ? users.find((u: any) => u.id === currentUser.id) : null;

  // 1. Session Revocation check
  const isSessionRevoked = currentUser && dbUser && (dbUser.sessionVersion || 1) > (currentUser.sessionVersion || 1);

  // 2. Status Suspended or Banned check
  const isSuspendedOrBanned = currentUser && dbUser && (dbUser.status === 'SUSPENDED' || dbUser.status === 'BANNED');

  // 3. Force password change check
  const requiresPasswordChange = currentUser && dbUser && dbUser.requiresPasswordChange;

  const hasUser = !!currentUser;
  const isAuthorized = isLoginPage || (hasUser && !isSuspendedOrBanned && !isSessionRevoked);

  useEffect(() => {
    const loadData = async () => {
      try {
        await useWikiStore.getState().loadFromServer();
      } catch (e) {
        console.error('Failed to load server state:', e);
      } finally {
        setMounted(true);
      }
    };
    loadData();
  }, []);

  // Handle auto logout on session revocation
  useEffect(() => {
    if (mounted && isSessionRevoked) {
      alert('Your session has been terminated by an administrator. Please log in again.');
      logout();
      router.replace('/login');
    }
  }, [mounted, isSessionRevoked, logout, router]);

  // Handle redirect if not logged in
  useEffect(() => {
    if (mounted && !isLoginPage && !hasUser) {
      router.replace('/login');
    }
  }, [mounted, hasUser, isLoginPage, router]);

  // Handle password reset submission
  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!newPassword) {
      setPasswordError('Password cannot be empty.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (currentUser) {
      // Perform reset and clear flag
      handleResetUserPassword(currentUser.id, newPassword, false);
      
      // Log audit
      handleAddAuditLog(
        currentUser.id,
        'PASSWORD_FORCE_RESET',
        `User "${currentUser.username}" completed required password change.`,
        currentUser.id
      );

      setPasswordSuccess(true);
      setTimeout(() => {
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess(false);
      }, 1500);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 font-sans">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
        <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Initializing Session...</span>
      </div>
    );
  }

  // Render Suspended / Banned Screen
  if (currentUser && isSuspendedOrBanned) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-6"
        >
          <div className="mx-auto h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
            <ShieldAlert size={32} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Account {dbUser?.status === 'BANNED' ? 'Banned' : 'Suspended'}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your account has been placed under {dbUser?.status === 'BANNED' ? 'permanent ban' : 'temporary suspension'} by the system administrator. You can no longer access this workspace.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="w-full py-2 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-xs font-medium rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out & Exit</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render Force Password Reset Screen
  if (currentUser && requiresPasswordChange) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Lock size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">Password Change Required</h1>
              <p className="text-[11px] text-slate-500">Security protection policy mandate</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            An administrator has required you to update your password before accessing the enterprise wiki workspace. Please configure a new secure password.
          </p>

          <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
            {passwordError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                <ShieldAlert size={14} className="flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
                <Check size={14} className="flex-shrink-0" />
                <span>Password changed! Updating workspace...</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                New Secure Password
              </label>
              <input
                type="password"
                required
                disabled={passwordSuccess}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full py-2 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono block">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                disabled={passwordSuccess}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full py-2 px-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordSuccess}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-blue-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{passwordSuccess ? 'Updating Security...' : 'Save & Enter Workspace'}</span>
                {!passwordSuccess && <ArrowRight size={13} />}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // Render loading state if not logged in and not on login page
  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 font-sans">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
        <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Authorizing...</span>
      </div>
    );
  }

  return (
    <>
      {impersonatorUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 px-4 py-2 text-xs font-medium flex items-center justify-between gap-4 select-none z-50 relative animate-slide-down">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Impersonation Active: You are logged in as <strong className="text-white font-bold">@{currentUser?.username}</strong> (Original Admin: <strong className="text-slate-400">@{impersonatorUser.username}</strong>)
            </span>
          </div>
          <button
            onClick={() => {
              stopImpersonating();
              router.push('/admin/users');
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] transition-all cursor-pointer uppercase tracking-wider"
          >
            Exit Impersonation
          </button>
        </div>
      )}
      {children}
    </>
  );
}
