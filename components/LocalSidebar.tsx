'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Folder, FileText, ChevronRight, ChevronDown, Trash2, Users, Share2, Globe, Lock } from 'lucide-react';
import CreateDocumentModal from './CreateDocumentModal';
import { useWikiStore, readFile } from '@/lib/store';
import { getAccessibleTeams } from '@/lib/acl';

export default function LocalSidebar({ 
  activePageId, 
  setActivePageId,
  onDeletePage,
  searchQuery = '',
  sortBy = 'updated'
}: { 
  activePageId: string, 
  setActivePageId: (id: string) => void,
  onDeletePage: (id: string, e: React.MouseEvent) => void,
  searchQuery?: string,
  sortBy?: 'updated' | 'alpha'
}) {
  const storeCurrentUser = useWikiStore(state => state.currentUser);

  const users = readFile('users.json') || [];
  const teams = readFile('teams.json') || [];

  const currentUser = useMemo(() => {
    return users.find((u: any) => u.id === storeCurrentUser?.id) || storeCurrentUser;
  }, [users, storeCurrentUser]);
  
  const documents = useWikiStore(state => state.documents);

  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openTeams, setOpenTeams] = useState<string[]>([]);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);
  const [openWorkspaces, setOpenWorkspaces] = useState<Record<string, boolean>>({});
  
  // Tabs: 'my' (My Workspaces + Teams), 'shared' (Workspaces shared with me), 'all' (All users workspaces)
  const [activeTab, setActiveTab] = useState<'my' | 'shared' | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wiki_active_sidebar_tab');
      return (saved as 'my' | 'shared' | 'all') || 'my';
    }
    return 'my';
  });

  useEffect(() => {
    localStorage.setItem('wiki_active_sidebar_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'all' && currentUser?.role !== 'ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('my');
    }
  }, [currentUser?.role, activeTab]);

  const isWorkspaceOpen = (ownerId: string) => {
    return openWorkspaces[ownerId] === true;
  };

  const toggleWorkspace = (ownerId: string) => {
    setOpenWorkspaces(prev => ({
      ...prev,
      [ownerId]: !isWorkspaceOpen(ownerId)
    }));
  };

  const accessibleTeams = useMemo(() => {
    return getAccessibleTeams(teams, currentUser);
  }, [teams, currentUser]);

  // Apply Search & Sort helper to any list of documents
  const filterAndSortPages = React.useCallback((pagesList: any[]) => {
    let result = [...pagesList];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.content?.toLowerCase().includes(query)
      );
    }
    if (sortBy === 'alpha') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      result.sort((a, b) => {
        const dateA = a.lastUpdated || '';
        const dateB = b.lastUpdated || '';
        return dateB.localeCompare(dateA);
      });
    }
    return result;
  }, [searchQuery, sortBy]);

  // Tab 1: My own personal pages (filtered and sorted)
  const filteredMyPages = useMemo(() => {
    const myPages = documents.filter((p: any) => 
      !p.isDeleted &&
      (!p.teamCollaborators || p.teamCollaborators.length === 0) &&
      p.ownerId === currentUser?.id
    );
    return filterAndSortPages(myPages);
  }, [documents, currentUser, filterAndSortPages]);

  // Shared personal pages explicitly shared with the current user
  const filteredSharedPages = useMemo(() => {
    const sharedPages = documents.filter((p: any) => 
      !p.isDeleted &&
      (!p.teamCollaborators || p.teamCollaborators.length === 0) &&
      p.ownerId !== currentUser?.id &&
      p.sharedWith && p.sharedWith.some((s: any) => s.userId === (currentUser?.id || ''))
    );
    return filterAndSortPages(sharedPages);
  }, [documents, currentUser, filterAndSortPages]);

  // Tab 2: Grouped shared pages map
  const sharedByOwnerMap = useMemo(() => {
    const map: Record<string, { owner: any; pages: any[] }> = {};
    filteredSharedPages.forEach((p: any) => {
      const ownerId = p.ownerId;
      if (!map[ownerId]) {
        const owner = users.find((u: any) => u.id === ownerId) || {
          id: ownerId,
          username: ownerId,
          email: `${ownerId}@enterprise.wiki`
        };
        map[ownerId] = { owner, pages: [] };
      }
      map[ownerId].pages.push(p);
    });
    return map;
  }, [filteredSharedPages, users]);

  // Tab 3: Grouped list of all other users' workspaces (ADMIN ONLY)
  // These are collapsed by default since isWorkspaceOpen() defaults to false
  const allUsersWorkspacesMap = useMemo(() => {
    const map: Record<string, { owner: any; pages: any[] }> = {};
    if (currentUser?.role !== 'ADMIN') return map;

    // Pre-populate workspaces for all users except the admin itself
    users.forEach((u: any) => {
      if (u.id !== currentUser.id) {
        map[u.id] = { owner: u, pages: [] };
      }
    });

    // Find all other users' personal pages (even if not explicitly shared)
    const otherPages = documents.filter((p: any) => 
      !p.isDeleted &&
      (!p.teamCollaborators || p.teamCollaborators.length === 0) &&
      p.ownerId !== currentUser?.id
    );

    const filteredOtherPages = filterAndSortPages(otherPages);

    filteredOtherPages.forEach((p: any) => {
      const ownerId = p.ownerId;
      if (!map[ownerId]) {
        const owner = users.find((u: any) => u.id === ownerId) || {
          id: ownerId,
          username: ownerId,
          email: `${ownerId}@enterprise.wiki`
        };
        map[ownerId] = { owner, pages: [] };
      }
      if (!map[ownerId].pages.some((doc: any) => doc.id === p.id)) {
        map[ownerId].pages.push(p);
      }
    });
    return map;
  }, [documents, users, currentUser, filterAndSortPages]);

  // Filtered and sorted team pages
  const filteredTeamPages = useMemo(() => {
    const teamDocs = documents.filter((p: any) => 
      !p.isDeleted &&
      p.teamCollaborators && p.teamCollaborators.length > 0 &&
      (
        currentUser?.role === 'ADMIN' || 
        p.ownerId === currentUser?.id ||
        (p.sharedWith && p.sharedWith.some((s: any) => s.userId === (currentUser?.id || '')))
      )
    );
    return filterAndSortPages(teamDocs);
  }, [documents, currentUser, filterAndSortPages]);

  // Global search results across all accessible pages
  const globalSearchPages = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const accessibleDocs = documents.filter((p: any) => {
      if (p.isDeleted) return false;
      
      // Admin sees everything
      if (currentUser?.role === 'ADMIN') return true;
      
      // I own it
      if (p.ownerId === currentUser?.id) return true;
      
      // Shared with me
      if (p.sharedWith && p.sharedWith.some((s: any) => s.userId === currentUser?.id)) return true;
      
      // In a team I'm part of
      if (p.teamCollaborators && p.teamCollaborators.some((tc: any) => accessibleTeams.some((t: any) => t.id === tc.teamId))) return true;
      
      return false;
    });

    return filterAndSortPages(accessibleDocs);
  }, [documents, currentUser, accessibleTeams, searchQuery, filterAndSortPages]);

  const getUserPersonalWorkspaceName = (user: any) => {
    if (!user) return 'Personal Workspace';
    const email = user.email || `${user.username}@enterprise.wiki`;
    const namePart = email.split('@')[0];
    const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const displayEmail = email.charAt(0).toUpperCase() + email.slice(1);
    return `${capitalizedName} workspace ( ${displayEmail} )`;
  };

  const openCreateModal = (team: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTeam(team);
    setIsModalOpen(true);
  };

  const toggleTeam = (teamId: string) => {
    setOpenTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId) 
        : [...prev, teamId]
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="flex items-center justify-between px-2 mb-2 pt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Global Search Results</span>
          </div>
          {globalSearchPages.length === 0 ? (
            <div className="p-3 text-center text-[10px] text-slate-550 italic bg-slate-950/20 rounded-lg border border-slate-900/40">
              No matching pages found
            </div>
          ) : (
            globalSearchPages.map(page => (
               <div 
                  key={page.id} 
                  onClick={() => setActivePageId(page.id)}
                  className={`flex flex-col group/page p-2 rounded-lg cursor-pointer transition-colors ${
                    activePageId === page.id 
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-lg' 
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={12} className={activePageId === page.id ? 'text-indigo-400' : 'text-slate-500'} />
                      <span className="text-xs truncate font-medium">{page.title}</span>
                    </div>
                    {(currentUser?.role === 'ADMIN' || page.ownerId === currentUser?.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(page.id, e);
                        }}
                        className="opacity-0 group-hover/page:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-1 shrink-0"
                        title="Delete Page"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="pl-5 pt-1 flex items-center gap-1 opacity-70">
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                      {page.ownerId === currentUser?.id ? 'My Workspace' : 
                       (page.teamCollaborators && page.teamCollaborators.length > 0) ? 'Team Document' : 
                       'Shared / Other Workspace'}
                    </span>
                  </div>
                </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* 3 Tabs Navigation Bar */}
          <div className="px-3 pb-2 pt-1 border-b border-slate-800/40 bg-slate-900/10 shrink-0">
            <div className={`grid ${currentUser?.role === 'ADMIN' ? 'grid-cols-3' : 'grid-cols-2'} gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80`}>
              <button
                type="button"
                onClick={() => setActiveTab('my')}
                className={`py-1.5 px-0.5 rounded text-[10px] font-bold text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 min-w-0 ${
                  activeTab === 'my'
                    ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-350 hover:bg-slate-900/50'
                }`}
                title="My Personal & Team Documents"
              >
                <Folder size={11} className="shrink-0" />
                <span className="truncate">My Docs</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('shared')}
                className={`py-1.5 px-0.5 rounded text-[10px] font-bold text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 min-w-0 ${
                  activeTab === 'shared'
                    ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-350 hover:bg-slate-900/50'
                }`}
                title="Workspaces Shared with Me"
              >
                <Users size={11} className="shrink-0" />
                <span className="truncate">Shared</span>
              </button>

              {currentUser?.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`py-1.5 px-0.5 rounded text-[10px] font-bold text-center transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 min-w-0 ${
                    activeTab === 'all'
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-350 hover:bg-slate-900/50'
                  }`}
                  title="All Members' Workspaces"
                >
                  <Globe size={11} className="shrink-0" />
                  <span className="truncate">All Users</span>
                </button>
              )}
            </div>
          </div>

      {/* Scrollable Directory Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* Tab 1: My Workspaces & Teams */}
        {activeTab === 'my' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Personal Workspace */}
            <div className="space-y-1">
              <div 
                onClick={() => setIsPersonalOpen(!isPersonalOpen)}
                className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {isPersonalOpen ? (
                    <ChevronDown size={14} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-500" />
                  )}
                  <Folder size={14} className="text-violet-400" />
                  <span className="text-xs font-bold text-slate-300">
                    {getUserPersonalWorkspaceName(currentUser)}
                  </span>
                </div>
              </div>
              
              {isPersonalOpen && (
                <div className="pl-6 space-y-0.5 animate-fadeIn">
                  {filteredMyPages.map(page => (
                    <div 
                      key={page.id} 
                      onClick={() => setActivePageId(page.id)}
                      className={`flex items-center justify-between group/page p-1.5 rounded-lg cursor-pointer transition-colors ${
                        activePageId === page.id 
                          ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-lg' 
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={12} className={activePageId === page.id ? 'text-indigo-400' : 'text-slate-500'} />
                        <span className="text-xs truncate font-medium">{page.title}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(page.id, e);
                        }}
                        className="opacity-0 group-hover/page:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-1 shrink-0"
                        title="Delete Page"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {filteredMyPages.length === 0 && (
                    <div className="p-3 text-center text-[10px] text-slate-550 italic bg-slate-950/20 rounded-lg border border-slate-900/40">
                      {searchQuery ? 'No matching pages' : 'No personal pages yet'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Workspace Teams */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-2 pt-2 border-t border-slate-800/40">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Workspace Teams</span>
              </div>

              {accessibleTeams.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No teams found. Admins can create teams in the Team Dashboard.
                </div>
              ) : (
                accessibleTeams.map((team: any) => {
                  const teamPages = filteredTeamPages.filter((p: any) => 
                    p.teamCollaborators?.some((tc: any) => tc.teamId === team.id)
                  );
                  const isOpen = openTeams.includes(team.id);
                  
                  return (
                    <div key={team.id} className="space-y-1">
                      <div 
                        onClick={() => toggleTeam(team.id)}
                        className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown size={14} className="text-slate-500" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-500" />
                          )}
                          <Folder size={14} className="text-indigo-400" />
                          <span className="text-xs font-bold text-slate-300">{team.name}</span>
                        </div>
                        <button 
                          onClick={(e) => openCreateModal(team, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-indigo-500/20 text-indigo-300 rounded hover:bg-indigo-500 hover:text-white transition-all"
                          title="Create New Page in Team"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      
                      {isOpen && (
                        <div className="pl-6 space-y-0.5">
                          {teamPages.map(page => (
                            <div 
                              key={page.id} 
                              onClick={() => setActivePageId(page.id)}
                              className={`flex items-center justify-between group/page p-1.5 rounded-lg cursor-pointer transition-colors ${
                                activePageId === page.id 
                                  ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-lg' 
                                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText size={12} className={activePageId === page.id ? 'text-indigo-400' : 'text-slate-500'} />
                                <span className="text-xs truncate font-medium">{page.title}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePage(page.id, e);
                                }}
                                className="opacity-0 group-hover/page:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-1 shrink-0"
                                title="Delete Page"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          {teamPages.length === 0 && (
                            <div className="p-1.5 text-[10px] text-slate-600 italic">No matching team pages</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Shared Workspaces */}
        {activeTab === 'shared' && (
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-800/40 mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Workspaces Shared with You
              </span>
            </div>

            {Object.keys(sharedByOwnerMap).length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 mt-4 mx-1 select-none">
                <Users size={20} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-450 font-bold">No shared workspaces</p>
                <p className="text-[10px] text-slate-600 mt-1">Pages shared with your email account will appear here.</p>
              </div>
            ) : (
              Object.entries(sharedByOwnerMap).map(([ownerId, { owner, pages }]) => {
                const isOpen = isWorkspaceOpen(ownerId);
                return (
                  <div key={ownerId} className="space-y-1 animate-fadeIn">
                    <div 
                      onClick={() => toggleWorkspace(ownerId)}
                      className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown size={14} className="text-slate-500" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-500" />
                        )}
                        <Folder size={14} className="text-emerald-400" />
                        <span className="text-xs font-bold text-slate-300">
                          {getUserPersonalWorkspaceName(owner)}
                        </span>
                      </div>
                    </div>
                    
                    {isOpen && (
                      <div className="pl-6 space-y-0.5 animate-fadeIn">
                        {pages.map(page => (
                          <div 
                            key={page.id} 
                            onClick={() => setActivePageId(page.id)}
                            className={`flex items-center justify-between group/page p-1.5 rounded-lg cursor-pointer transition-colors ${
                              activePageId === page.id 
                                ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-lg' 
                                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText size={12} className={activePageId === page.id ? 'text-indigo-400' : 'text-slate-500'} />
                              <span className="text-xs truncate font-medium">{page.title}</span>
                            </div>
                            {(currentUser?.role === 'ADMIN' || page.ownerId === currentUser?.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePage(page.id, e);
                                }}
                                className="opacity-0 group-hover/page:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-1 shrink-0"
                                title="Delete Page"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        {pages.length === 0 && (
                          <div className="p-1.5 text-[10px] text-slate-600 italic">No matching pages</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: All users workspaces */}
        {activeTab === 'all' && (
          <div className="space-y-2 animate-fadeIn">
            {currentUser?.role === 'ADMIN' ? (
              <>
                <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-800/40 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    All User Workspaces (Admin View)
                  </span>
                </div>

                {Object.keys(allUsersWorkspacesMap).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No other users found.
                  </div>
                ) : (
                  Object.entries(allUsersWorkspacesMap).map(([ownerId, { owner, pages }]) => {
                    const isOpen = isWorkspaceOpen(ownerId);
                    return (
                      <div key={ownerId} className="space-y-1 animate-fadeIn">
                        <div 
                          onClick={() => toggleWorkspace(ownerId)}
                          className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown size={14} className="text-slate-500" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-500" />
                            )}
                            <Folder size={14} className="text-violet-400" />
                            <span className="text-xs font-bold text-slate-300">
                              {getUserPersonalWorkspaceName(owner)}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono font-semibold bg-slate-950 px-1.5 py-0.5 border border-slate-800 rounded text-slate-500 shrink-0">
                            {pages.length} {pages.length === 1 ? 'doc' : 'docs'}
                          </span>
                        </div>
                        
                        {isOpen && (
                          <div className="pl-6 space-y-0.5 animate-fadeIn">
                            {pages.map(page => (
                              <div 
                                key={page.id} 
                                onClick={() => setActivePageId(page.id)}
                                className={`flex items-center justify-between group/page p-1.5 rounded-lg cursor-pointer transition-colors ${
                                  activePageId === page.id 
                                    ? 'bg-indigo-600/15 border border-indigo-500/30 text-white shadow-lg' 
                                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FileText size={12} className={activePageId === page.id ? 'text-indigo-400' : 'text-slate-500'} />
                                  <span className="text-xs truncate font-medium">{page.title}</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePage(page.id, e);
                                  }}
                                  className="opacity-0 group-hover/page:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-1 shrink-0"
                                  title="Delete Page"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                            {pages.length === 0 && (
                              <div className="p-1.5 text-[10px] text-slate-650 italic">No pages yet</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              <div className="bg-slate-950/40 border border-slate-800/65 rounded-xl p-4 text-center mt-2 mx-1 shadow-inner select-none animate-fadeIn">
                <Lock size={20} className="mx-auto text-indigo-450 mb-2.5 animate-pulse" />
                <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-1">
                  Admin Access Required
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  This section displays directory-wide personal workspaces and is restricted to Enterprise Administrators.
                </p>
                <div className="mt-3.5 pt-2 border-t border-slate-900 flex justify-center">
                  <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-slate-500 uppercase tracking-widest">
                    Role: {currentUser?.role || 'VIEWER'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      </>
      )}
      
      <CreateDocumentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        team={selectedTeam} 
        onSuccess={(id) => {
          setActivePageId(id);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
