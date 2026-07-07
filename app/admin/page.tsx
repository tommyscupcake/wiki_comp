'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWikiStore, readFile } from '@/lib/store';
import { ArrowLeft, Shield, Users, Trash2, ShieldAlert, FileText } from 'lucide-react';
import { getAccessibleTeams } from '@/lib/acl';
import { AdminUsersPageContent } from './users/AdminUsersContent';
import { AdminTeamsPageContent } from './teams/AdminTeamsContent';
import { AdminTrashPageContent } from './trash/AdminTrashContent';
import { AdminLogsPageContent } from './logs/AdminLogsContent';

export default function UnifiedAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'logs' | 'trash'>('users');

  const sessionUser = useWikiStore((state) => state.currentUser);
  const rawUsersData = readFile('users.json');
  const rawTeamsData = readFile('teams.json');

  const rawUsers = useMemo(() => rawUsersData || [], [rawUsersData]);
  const rawTeams = useMemo(() => rawTeamsData || [], [rawTeamsData]);

  const currentUser = useMemo(() => {
    return rawUsers.find((u: any) => u.id === sessionUser?.id) || sessionUser;
  }, [rawUsers, sessionUser]);

  const accessibleTeams = useMemo(() => {
    return getAccessibleTeams(rawTeams, currentUser);
  }, [rawTeams, currentUser]);

  const isEligible = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || accessibleTeams.length > 0;
  }, [currentUser, accessibleTeams]);

  // Security check: Only allow users with Admin role or eligible team moderators
  useEffect(() => {
    if (!currentUser || !isEligible) {
      alert('403 Unauthorized: Access to Admin Panel is restricted.');
      router.replace('/');
    }
  }, [currentUser, isEligible, router]);

  if (!currentUser || !isEligible) {
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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-1.5 hover:bg-slate-900 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title="Back to Workspace"
              id="back-to-workspace-admin"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                ⚙️ Admin Panel
                <span className="text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">
                  {currentUser.role === 'ADMIN' ? 'Superadmin' : 'Moderator'}
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Manage users, teams, and view/restore deleted workspace documents in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Shield size={14} />
            Users
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'teams'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users size={14} />
            Teams
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <FileText size={14} />
            Logs
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`px-4 py-2 border-b-2 text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'trash'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Trash2 size={14} />
            Trash
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="mt-4 w-full">
          {activeTab === 'users' && <AdminUsersPageContent isTabbed={true} />}
          {activeTab === 'teams' && <AdminTeamsPageContent isTabbed={true} />}
          {activeTab === 'logs' && <AdminLogsPageContent isTabbed={true} />}
          {activeTab === 'trash' && <AdminTrashPageContent isTabbed={true} />}
        </div>
      </div>
    </div>
  );
}
