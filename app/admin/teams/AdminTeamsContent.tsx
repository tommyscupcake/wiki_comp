'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWikiStore, User, Team, readFile, writeFile, addAuditLogVFS } from '@/lib/store';
import { getAccessibleTeams } from '@/lib/acl';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  Check,
  X,
  Search,
  Plus,
  ArrowRight,
  UserMinus,
  Settings,
} from 'lucide-react';

export default function AdminTeamsPage() {
  return <AdminTeamsPageContent isTabbed={false} />;
}

export function AdminTeamsPageContent({ isTabbed = false }: { isTabbed?: boolean }) {
  const router = useRouter();
  
  const sessionUser = useWikiStore(state => state.currentUser);
  const deleteTeam = useWikiStore(state => state.deleteTeam);
  const rawUsers = readFile('users.json');
  const rawTeams = readFile('teams.json');
  
  const currentUser = rawUsers?.find((u: any) => u.id === sessionUser?.id) || sessionUser;
  
  const users = useMemo(() => rawUsers || [], [rawUsers]);
  const teams = useMemo(() => rawTeams || [], [rawTeams]);
 
  const handleAddAuditLog = (adminId: string, action: string, details: string, targetUserId?: string, metadata?: any) => {
    addAuditLogVFS(adminId, action, details, targetUserId, metadata);
  };

  const handleCreateTeam = (name: string, members: any[]) => {
    const id = `team-${new Date().getTime()}`;
    const newTeam = { id, name, members };
    writeFile('teams.json', [...teams, newTeam]);

    if (currentUser) {
      handleAddAuditLog(
        currentUser.id,
        'TEAM_CREATE',
        `Created team: ${name}`,
        undefined,
        {
          teamName: name,
          creator: currentUser.username
        }
      );
    }
  };

  const handleDeleteTeam = async (id: string) => {
    const res = await fetch(`/api/teams/${id}/trash`, { method: 'POST' });
    const response = await res.json();
    if (response.success) {
      deleteTeam(id);
    } else {
      setError(response.error || 'Failed to trash team in database.');
    }
  };

  const handleUpdateTeamMembers = (id: string, members: any[]) => {
    writeFile('teams.json', teams.map((t: any) => t.id === id ? { ...t, members } : t));
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedTeamToManage, setSelectedTeamToManage] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  // Creation State
  const [newTeamName, setNewTeamName] = useState('');
  const [creationMembers, setCreationMembers] = useState<{ userId: string; teamRole: 'MODERATOR' | 'EDITOR' | 'VIEWER' }[]>([]);
  const [creationSearch, setCreationSearch] = useState('');

  // Editing State
  const [editSearch, setEditSearch] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const activeTeams = useMemo(() => {
    return teams.filter((team: any) => !team.isTrashed);
  }, [teams]);

  const accessibleTeams = useMemo(() => {
    return getAccessibleTeams(activeTeams, currentUser);
  }, [activeTeams, currentUser]);

  const isEligible = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || accessibleTeams.length > 0;
  }, [currentUser, accessibleTeams]);

  // creation user query filtering
  const filteredUsersForCreation = useMemo(() => {
    if (!creationSearch.trim()) return [];
    return users.filter(
      (u: any) =>
        u.username.toLowerCase().includes(creationSearch.toLowerCase()) &&
        !creationMembers.some((m) => m.userId === u.id)
    );
  }, [users, creationSearch, creationMembers]);

  // Security Check
  useEffect(() => {
    if (!isTabbed && currentUser && currentUser.role !== 'ADMIN' && accessibleTeams.length === 0) {
      alert('403 Unauthorized: Access to Team Management is restricted to Team Members and Admins.');
      router.replace('/');
    }
  }, [currentUser, accessibleTeams, router, isTabbed]);

  if (!isTabbed && (!currentUser || !isEligible)) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center p-6 bg-slate-900 border border-slate-855 rounded-xl max-w-sm">
          <ShieldAlert className="mx-auto text-red-500 mb-3" size={32} />
          <h1 className="text-slate-200 font-bold mb-1">Access Restricted</h1>
          <p className="text-xs text-slate-500">Redirecting to workspace...</p>
        </div>
      </div>
    );
  }

  // editing user search filtering
  const getFilteredUsersForEdit = (team: Team) => {
    if (!editSearch.trim()) return [];
    return users.filter(
      (u: any) =>
        u.username.toLowerCase().includes(editSearch.toLowerCase()) &&
        !(team.members || []).some((m) => m.userId === u.id)
    );
  };

  const handleCreateTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newTeamName.trim()) {
      setError('Team name is required');
      return;
    }

    const tExists = teams.some((t: any) => t.name.toLowerCase() === newTeamName.trim().toLowerCase());
    if (tExists) {
      setError('A team with this name already exists');
      return;
    }

    // Always include the current user as moderator if not already in members
    let finalMembers = [...creationMembers];
    if (currentUser.role !== 'ADMIN' && !finalMembers.some((m) => m.userId === currentUser.id)) {
      finalMembers.push({ userId: currentUser.id, teamRole: 'MODERATOR' });
    }

    handleCreateTeam(newTeamName.trim(), finalMembers);
    setNewTeamName('');
    setCreationMembers([]);
    setCreationSearch('');
    setIsCreateModalOpen(false);
    showToast('Team created successfully');
  };

  const handleDeleteTeamClick = (team: Team) => {
    if (currentUser.role !== 'ADMIN') {
      alert('Only administrators can delete entire teams.');
      return;
    }
    setTeamToDelete(team);
  };

  const executeDeleteTeam = async () => {
    if (!teamToDelete) return;
    await handleDeleteTeam(teamToDelete.id);
    showToast(`Team "${teamToDelete.name}" deleted successfully`);
    setTeamToDelete(null);
  };

  // Manage existing team member updates
  const openManageModal = (team: Team) => {
    setSelectedTeamToManage(team);
    setEditSearch('');
    setIsManageModalOpen(true);
  };

  const handleAddMemberToEdit = (uId: string, role: 'MODERATOR' | 'EDITOR' | 'VIEWER') => {
    if (!selectedTeamToManage) return;
    const currentList = selectedTeamToManage.members || [];
    if (currentList.some((m) => m.userId === uId)) return;

    const newList = [...currentList, { userId: uId, teamRole: role }];
    handleUpdateTeamMembers(selectedTeamToManage.id, newList);
    setSelectedTeamToManage({
      ...selectedTeamToManage,
      members: newList,
    });
    setEditSearch('');
    showToast('Member added to team');
  };

  const handleRemoveMemberFromEdit = (uId: string) => {
    if (!selectedTeamToManage) return;
    
    // Prevent self lock-out for non-admins
    if (currentUser.role !== 'ADMIN' && uId === currentUser.id) {
      alert('You cannot remove yourself from the team.');
      return;
    }

    const currentList = selectedTeamToManage.members || [];
    const newList = currentList.filter((m) => m.userId !== uId);

    handleUpdateTeamMembers(selectedTeamToManage.id, newList);
    setSelectedTeamToManage({
      ...selectedTeamToManage,
      members: newList,
    });
    showToast('Member removed from team');
  };

  const handleUpdateMemberRoleEdit = (uId: string, role: 'MODERATOR' | 'EDITOR' | 'VIEWER') => {
    if (!selectedTeamToManage) return;

    const currentList = selectedTeamToManage.members || [];
    const newList = currentList.map((m) => {
      if (m.userId === uId) {
        return { ...m, teamRole: role };
      }
      return m;
    });

    handleUpdateTeamMembers(selectedTeamToManage.id, newList);
    setSelectedTeamToManage({
      ...selectedTeamToManage,
      members: newList,
    });
    showToast('Team role updated');
  };

  const getUserNameById = (id: string) => {
    const u = users.find((user: any) => user.id === id);
    return u ? u.username : 'Unknown Account';
  };

  const renderContent = () => (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs rounded-xl shadow-lg flex items-center gap-2"
          >
            <Check size={14} />
            <span className="font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                id="back-to-workspace-admin"
                onClick={() => router.push('/')}
                className="p-1.5 hover:bg-slate-900 rounded-lg border border-slate-880 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                title="Back to Workspace"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100">
                  Team Management Console
                </h1>
                <p className="text-xs text-slate-500">
                  {currentUser.role === 'ADMIN'
                    ? 'Global team provisioning, membership alignment, and ACL permissions control'
                    : 'Manage teammates, roles, and settings for the teams you moderate'}
                </p>
              </div>
            </div>

            {currentUser.role === 'ADMIN' && (
              <button
                id="open-create-team-modal"
                onClick={() => {
                  setNewTeamName('');
                  setCreationMembers([]);
                  setCreationSearch('');
                  setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-indigo-500/15 cursor-pointer transition-all"
              >
                <UserPlus size={14} />
                <span>Create Team</span>
              </button>
            )}
          </div>
        </div>

        {/* Directory Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-850 bg-slate-950/45 flex items-center justify-between">
            <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">
              {currentUser.role === 'ADMIN' ? `ALL ACTIVE TEAMS (${activeTeams.length})` : `My Teams (${accessibleTeams.length})`}
            </span>
            <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
              Zustand ACL State
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-mono text-[10px] uppercase tracking-wider bg-slate-950/20">
                  <th className="py-3 px-5">Team Identifier & Name</th>
                  <th className="py-3 px-5">Teammate Distribution</th>
                  <th className="py-3 px-5">Active Role Allocation</th>
                  <th className="py-3 px-5 text-right">Console Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {accessibleTeams.map((team) => {
                  const mods = (team.members || []).filter((m) => m.teamRole === 'MODERATOR');
                  const editors = (team.members || []).filter((m) => m.teamRole === 'EDITOR');
                  const viewers = (team.members || []).filter((m) => m.teamRole === 'VIEWER');

                  return (
                    <tr
                      key={team.id}
                      className="hover:bg-slate-950/20 transition-colors"
                    >
                      {/* Name & ID */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400">
                            <Users size={16} />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200 block text-xs">
                              {team.name}
                            </span>
                            <span className="text-[9px] text-slate-550 font-mono">
                              {team.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Members Count breakdown */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">
                            {team.members?.length || 0} Total
                          </span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 font-medium px-1.5 py-0.5 rounded font-mono">
                            {mods.length} Mods
                          </span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 font-medium px-1.5 py-0.5 rounded font-mono">
                            {editors.length} Editors
                          </span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 font-medium px-1.5 py-0.5 rounded font-mono">
                            {viewers.length} Viewers
                          </span>
                        </div>
                      </td>

                      {/* Display a small list of member names */}
                      <td className="py-4 px-5 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(team.members || []).slice(0, 4).map((m) => (
                            <span
                              key={m.userId}
                              className="text-[9px] text-slate-350 bg-slate-950/40 border border-slate-850 px-1.5 py-0.5 rounded"
                              title={`${getUserNameById(m.userId)} (${m.teamRole})`}
                            >
                              {getUserNameById(m.userId)}{' '}
                              <span className="text-[7.5px] text-slate-500 uppercase font-mono">
                                {m.teamRole[0]}
                              </span>
                            </span>
                          ))}
                          {team.members.length > 4 && (
                            <span className="text-[9px] text-indigo-400 font-bold px-1.5 py-0.5">
                              +{team.members.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Console Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openManageModal(team)}
                            className="p-1 px-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Settings size={12} />
                            <span>Teammates</span>
                          </button>

                          {currentUser.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDeleteTeamClick(team)}
                              className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-450 border border-transparent hover:border-rose-500/15 rounded-lg transition-all cursor-pointer"
                              title="Delete Team"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {accessibleTeams.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-slate-500"
                    >
                      <Users className="mx-auto text-slate-600 mb-2" size={32} />
                      <p className="text-sm font-semibold text-slate-400">No Teams Configured</p>
                      <p className="text-xs text-slate-650">Create your first workspace team matching your business domains</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE TEAM MODAL (Admins Only) */}
      <AnimatePresence>
        {isCreateModalOpen && currentUser.role === 'ADMIN' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-850 bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                    <UserPlus size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-100">
                      Create Workspace Team
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Provision a new collaborative team structure
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateTeamSubmit} className="flex flex-col">
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {error && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-505/20 text-rose-450 text-xs rounded-lg font-semibold flex items-center gap-2">
                      <ShieldAlert size={14} />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Team Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold tracking-wider text-slate-450 uppercase font-mono block">
                      Team Name
                    </label>
                    <input
                      id="create-team-name-input"
                      type="text"
                      required
                      placeholder="e.g. Payit123, Frontline Product"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-200 placeholder-slate-700 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Member additions */}
                  <div className="space-y-2 border-t border-slate-850 pt-3">
                    <label className="text-[10px] font-bold tracking-wider text-slate-455 uppercase font-mono block">
                      Add Initial Members
                    </label>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 text-slate-600" size={14} />
                      <input
                        type="text"
                        placeholder="Type to search global users..."
                        value={creationSearch}
                        onChange={(e) => setCreationSearch(e.target.value)}
                        className="w-full py-1.5 pl-8 pr-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-200 placeholder-slate-700 focus:outline-none transition-all"
                      />
                    </div>

                    {/* Filtered suggestions */}
                    {filteredUsersForCreation.length > 0 && (
                      <div className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg max-h-32 overflow-y-auto space-y-1">
                        {filteredUsersForCreation.map((u: any) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-slate-900 text-xs"
                          >
                            <span className="text-slate-300">👤 {u.username}</span>
                            <div className="flex items-center gap-1">
                              <select
                                id={`creation-role-${u.id}`}
                                defaultValue="EDITOR"
                                className="p-0.5 bg-slate-950 border border-slate-800 text-slate-350 text-[10px] font-mono rounded cursor-pointer"
                              >
                                <option value="VIEWER">Viewer</option>
                                <option value="EDITOR">Editor</option>
                                <option value="MODERATOR">Moderator</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const selectEl = document.getElementById(`creation-role-${u.id}`) as HTMLSelectElement;
                                  const r = selectEl ? (selectEl.value as any) : 'EDITOR';
                                  setCreationMembers([...creationMembers, { userId: u.id, teamRole: r }]);
                                  setCreationSearch('');
                                }}
                                className="p-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active proposed list */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase font-mono block">
                      Proposed Member List ({creationMembers.length})
                    </span>
                    <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-855 max-h-40 overflow-y-auto font-sans">
                      {creationMembers.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between text-xs py-1 border-b border-slate-880/20 last:border-none"
                        >
                          <span className="text-slate-300">👤 {getUserNameById(m.userId)}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-300 px-1 py-0.2 rounded">
                              {m.teamRole}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCreationMembers(creationMembers.filter((item) => item.userId !== m.userId))}
                              className="text-red-500 hover:text-red-400 p-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {creationMembers.length === 0 && (
                        <span className="text-[10px] text-slate-600 font-mono block text-center py-2">
                          No members added yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-950/25 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-1.5 px-3 hover:bg-slate-800 text-slate-400 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-create-team-btn"
                    type="submit"
                    className="p-1.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow"
                  >
                    Done
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANAGE TEAMMATES MODAL (Admins + Moderators) */}
      <AnimatePresence>
        {isManageModalOpen && selectedTeamToManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManageModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-850 bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                    <Users size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-100">
                      Manage {selectedTeamToManage.name}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Invite teammates and configure operational roles
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Search to invite a new user */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-wider text-slate-450 uppercase font-mono block">
                    Invite Teammate
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 text-slate-600" size={14} />
                    <input
                      type="text"
                      placeholder="Type username to search directory..."
                      value={editSearch}
                      onChange={(e) => setEditSearch(e.target.value)}
                      className="w-full py-1.5 pl-8 pr-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-slate-200 placeholder-slate-700 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Suggestions list */}
                  {getFilteredUsersForEdit(selectedTeamToManage).length > 0 && (
                    <div className="p-1 border border-slate-850 bg-slate-950 rounded-lg max-h-32 overflow-y-auto space-y-1">
                      {getFilteredUsersForEdit(selectedTeamToManage).map((u: any) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-slate-900 text-xs"
                        >
                          <span className="text-slate-300">👤 {u.username}</span>
                          <div className="flex items-center gap-1">
                            <select
                              id={`edit-role-select-${u.id}`}
                              defaultValue="EDITOR"
                              className="p-0.5 bg-slate-950 border border-slate-800 text-slate-350 text-[10px] font-mono rounded cursor-pointer focus:outline-none"
                            >
                              <option value="VIEWER">Viewer</option>
                              <option value="EDITOR">Editor</option>
                              <option value="MODERATOR">Moderator</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const selectEl = document.getElementById(`edit-role-select-${u.id}`) as HTMLSelectElement;
                                const r = selectEl ? (selectEl.value as any) : 'EDITOR';
                                handleAddMemberToEdit(u.id, r);
                              }}
                              className="p-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded transition-colors"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Teammate Directory list */}
                <div className="space-y-2 border-t border-slate-850 pt-3">
                  <span className="text-[10px] font-bold tracking-wider text-slate-450 uppercase font-mono block">
                    Active Teammates ({selectedTeamToManage.members?.length || 0})
                  </span>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-800">
                    {(selectedTeamToManage.members || []).map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-855 hover:bg-slate-950/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-200 block font-medium">
                            👤 {getUserNameById(m.userId)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={m.teamRole}
                            onChange={(e) => handleUpdateMemberRoleEdit(m.userId, e.target.value as any)}
                            className="p-0.5 px-1.5 bg-slate-950 border border-slate-800 text-slate-350 text-[10px] font-mono rounded cursor-pointer"
                          >
                            <option value="VIEWER">👀 Team Viewer</option>
                            <option value="EDITOR">✍️ Team Editor</option>
                            <option value="MODERATOR">👑 Moderator</option>
                          </select>

                          <button
                            onClick={() => handleRemoveMemberFromEdit(m.userId)}
                            className="p-1 hover:bg-red-500/10 border border-transparent hover:border-red-500/15 text-slate-500 hover:text-red-400 rounded transition-all cursor-pointer"
                            title="Remove Member"
                          >
                            <UserMinus size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {(!selectedTeamToManage.members || selectedTeamToManage.members.length === 0) && (
                      <span className="text-[10px] text-slate-600 font-mono block text-center py-4">
                        No team members configured yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-slate-850 bg-slate-950/25 flex items-center justify-end">
                <button
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {teamToDelete && (
          <DeleteConfirmationModal
            team={teamToDelete}
            onCancel={() => setTeamToDelete(null)}
            onConfirm={executeDeleteTeam}
          />
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

function DeleteConfirmationModal({ team, onCancel, onConfirm }: { team: Team, onCancel: () => void, onConfirm: () => void }) {
  if (!team) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10 flex flex-col font-sans"
      >
        <div className="px-5 py-4 border-b border-slate-850 bg-slate-950/20 flex items-center justify-between">
           <h2 className="text-sm font-bold text-slate-200 uppercase tracking-tight">Confirm Deletion</h2>
           <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
           <p className="text-sm text-slate-300 leading-relaxed">
             Are you sure you want to delete <span className="font-bold text-rose-400">[{team.name}]</span>? This action cannot be undone.
           </p>
           <div className="flex items-center justify-end gap-3 mt-2">
             <button onClick={onCancel} className="px-4 py-2 border border-slate-800 text-xs font-semibold text-slate-300 bg-slate-950 hover:bg-slate-850 rounded-lg transition-colors cursor-pointer">
               Cancel
             </button>
             <button onClick={onConfirm} className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-red-500/20">
               <Trash2 size={13} strokeWidth={2.5} /> Confirm
             </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
