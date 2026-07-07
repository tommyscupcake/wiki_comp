'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWikiStore, User, WikiDocument, readFile } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  FileText,
  AlertTriangle,
  Check,
  Shield,
  Search,
} from 'lucide-react';

export default function AdminTrashPage() {
  return <AdminTrashPageContent isTabbed={false} />;
}

export function AdminTrashPageContent({ isTabbed = false }: { isTabbed?: boolean }) {
  const router = useRouter();

  // Load session user and document list from Zustand store
  const sessionUser = useWikiStore((state) => state.currentUser);
  const documents = useWikiStore((state) => state.documents);
  const softDeleteDocument = useWikiStore((state) => state.softDeleteDocument);
  const restoreDocument = useWikiStore((state) => state.restoreDocument);
  const deleteDocument = useWikiStore((state) => state.deleteDocument);
  
  // Teams and actions from store
  const teams = useWikiStore((state) => state.teams);
  const restoreTeam = useWikiStore((state) => state.restoreTeam);
  const permanentlyDeleteTeam = useWikiStore((state) => state.permanentlyDeleteTeam);

  // Read raw users list for owner name resolution
  const rawUsers = readFile('users.json');
  const users = useMemo(() => rawUsers || [], [rawUsers]);
  const currentUser = useMemo(() => {
    return users.find((u: any) => u.id === sessionUser?.id) || sessionUser;
  }, [users, sessionUser]);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Strictly enforce admin role check
  useEffect(() => {
    if (!isTabbed && currentUser && currentUser.role !== 'ADMIN') {
      alert('403 Forbidden: Access to Admin Trash is restricted to Administrators.');
      router.replace('/');
    }
  }, [currentUser, router, isTabbed]);

  // Filter for deleted documents
  const trashedDocuments = useMemo(() => {
    return documents.filter((doc) => doc.isDeleted === true);
  }, [documents]);

  // Filter for deleted teams
  const trashedTeams = useMemo(() => {
    return (teams || []).filter((team) => team.isTrashed === true);
  }, [teams]);

  // Filter based on search query
  const filteredTrash = useMemo(() => {
    if (!searchQuery.trim()) return trashedDocuments;
    const query = searchQuery.toLowerCase();
    return trashedDocuments.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query)
    );
  }, [trashedDocuments, searchQuery]);

  // Handle document restoration
  const handleRestore = (id: string, title: string) => {
    restoreDocument(id);
    showToast(`Successfully restored "${title}" to workspace!`);
  };

  // Handle permanent deletion (hard delete)
  const handlePermanentDelete = (id: string, title: string) => {
    const isConfirmed = window.confirm(
      `CRITICAL WARNING: Are you sure you want to permanently delete "${title}"?\nThis action is completely irreversible!`
    );
    if (isConfirmed) {
      deleteDocument(id);
      showToast(`Permanently deleted "${title}".`);
    }
  };

  // Get owner username helper
  const getOwnerName = (ownerId: string) => {
    const foundUser = users.find((u: any) => u.id === ownerId);
    return foundUser ? foundUser.username : 'Unknown Owner';
  };

  if (!isTabbed && (!currentUser || currentUser.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center font-sans text-slate-400">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-rose-500 animate-pulse" />
          <span>Checking admin credentials...</span>
        </div>
      </div>
    );
  }

  const renderContent = () => (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl shadow-lg flex items-center gap-2 font-medium"
          >
            <Check size={14} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${isTabbed ? '' : 'max-w-5xl mx-auto'} space-y-6`}>
        {/* Navigation & Title */}
        {!isTabbed ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-all cursor-pointer shadow-sm"
                title="Return to Workspace"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-rose-500" />
                  <span className="text-[10px] font-mono tracking-wider text-rose-400 uppercase font-bold">Admin Panel</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Trash2 size={22} className="text-rose-500" /> Trash Control Bin
                </h1>
              </div>
            </div>

            <div className="text-slate-400 text-xs md:text-right">
              <p className="font-mono">Total Trashed: <span className="font-bold text-rose-400">{trashedDocuments.length + trashedTeams.length}</span></p>
              <p className="text-[10px] text-slate-500">Restore items back to active workspace or shred them permanently.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-4">
            <div>
              <p className="text-xs text-slate-400">
                Restore soft-deleted wiki documents and teams back to active status, or shred them permanently.
              </p>
            </div>
            <div className="text-slate-400 text-xs md:text-right font-mono">
              Total Trashed: <span className="font-bold text-rose-400">{trashedDocuments.length + trashedTeams.length}</span>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        {(trashedDocuments.length > 0 || trashedTeams.length > 0) && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
            <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold uppercase tracking-wider text-rose-400 text-[10px] block mb-0.5">Critical Notice</span>
              Shredding/Permanently deleting documents or teams will completely destroy them from memory and the local database storage. Restored items will immediately return to their active state.
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search trashed wiki pages by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Trash Content */}
        {trashedDocuments.length === 0 && trashedTeams.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-600">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-300 text-sm">No items found in Trash</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Wiki pages or teams soft-deleted will appear here for temporary custody.
                </p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Go Back to Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Soft-Deleted Wiki Documents Section */}
            {(trashedDocuments.length > 0 || searchQuery) && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📄 Soft-Deleted Documents</span>
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                    {trashedDocuments.length}
                  </span>
                </h2>
                
                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search trashed wiki pages by title or content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                  {filteredTrash.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-xs">
                      No documents match your search query.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-900 text-[10px] font-mono uppercase text-slate-500 tracking-wider bg-slate-950/20">
                            <th className="p-4 font-bold">Document Title</th>
                            <th className="p-4 font-bold">Original Owner</th>
                            <th className="p-4 font-bold">Last Active</th>
                            <th className="p-4 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-xs">
                          {filteredTrash.map((doc) => (
                            <tr
                              key={doc.id}
                              className="hover:bg-slate-900/20 transition-colors"
                            >
                              <td className="p-4 font-medium text-slate-200">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                                    <FileText size={14} />
                                  </div>
                                  <div className="truncate max-w-[240px] md:max-w-xs">
                                    <span className="font-bold text-slate-100 block truncate">{doc.title}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">ID: {doc.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400">
                                    {getOwnerName(doc.ownerId)[0]?.toUpperCase()}
                                  </div>
                                  <span>{getOwnerName(doc.ownerId)}</span>
                                </div>
                              </td>
                              <td className="p-4 text-slate-400 font-mono text-[11px]">
                                {doc.lastUpdated}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleRestore(doc.id, doc.title)}
                                    className="p-1.5 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                                    title="Restore to Workspace"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Restore</span>
                                  </button>
                                  <button
                                    onClick={() => handlePermanentDelete(doc.id, doc.title)}
                                    className="p-1.5 text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                                    title="Destroy Permanently"
                                  >
                                    <Trash2 size={12} />
                                    <span>Shred</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Soft-Deleted Teams Section */}
            {trashedTeams.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👥 Soft-Deleted Teams</span>
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                    {trashedTeams.length}
                  </span>
                </h2>
                
                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 text-[10px] font-mono uppercase text-slate-500 tracking-wider bg-slate-950/20">
                          <th className="p-4 font-bold">Team Name</th>
                          <th className="p-4 font-bold">Members Count</th>
                          <th className="p-4 font-bold">Deleted At</th>
                          <th className="p-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-xs">
                        {trashedTeams.map((team) => (
                          <tr
                            key={team.id}
                            className="hover:bg-slate-900/20 transition-colors"
                          >
                            <td className="p-4 font-medium text-slate-200">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-bold font-mono">
                                  T
                                </div>
                                <div className="truncate max-w-[240px] md:max-w-xs">
                                  <span className="font-bold text-slate-100 block truncate">{team.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {team.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-300 font-mono">
                              {team.members?.length || 0} members
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-[11px]">
                              {team.trashedAt ? new Date(team.trashedAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    const res = await fetch(`/api/teams/${team.id}/restore`, { method: 'POST' });
                                    const response = await res.json();
                                    if (response.success) {
                                      restoreTeam(team.id);
                                      showToast(`Successfully restored team "${team.name}"!`);
                                    } else {
                                      showToast(response.error || `Failed to restore team "${team.name}" from database.`);
                                    }
                                  }}
                                  className="p-1.5 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                                  title="Restore Team"
                                >
                                  <RotateCcw size={12} />
                                  <span>Restore</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const isConfirmed = window.confirm(
                                      `CRITICAL WARNING: Are you sure you want to permanently delete the team "${team.name}"?\nThis action is completely irreversible and will clean up all collaborator assignments!`
                                    );
                                    if (isConfirmed) {
                                      permanentlyDeleteTeam(team.id);
                                      showToast(`Permanently deleted team "${team.name}".`);
                                    }
                                  }}
                                  className="p-1.5 text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-all flex items-center gap-1 font-semibold text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                                  title="Delete Forever"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete Forever</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
