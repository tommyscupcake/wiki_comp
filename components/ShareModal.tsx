'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, Shield, Trash2 } from 'lucide-react';
import { useWikiStore, addAuditLogVFS, readFile, User } from '@/lib/store';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: any;
  visibility: string;
  setVisibility: (visibility: string) => void;
}

export default function ShareModal({ isOpen, onClose, document, visibility, setVisibility }: ShareModalProps) {
  const users = (readFile('users.json') || []) as User[];
  const storeCurrentUser = useWikiStore((state) => state.currentUser);
  const currentUser = users.find((u: any) => u.id === storeCurrentUser?.id) || storeCurrentUser;
  
  const [allowedUsers, setAllowedUsers] = useState<{ id: string; name: string; email: string; role: 'Viewer' | 'Editor' | 'Admin' }[]>([]);
  const [localVisibility, setLocalVisibility] = useState('private');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (document) {
      const initial = (document.sharedWith || []).map((s: any) => {
        const u = users.find(user => user.id === s.userId);
        return {
          id: s.userId,
          name: u ? u.username : s.userId,
          email: u?.email || `${u?.username || s.userId}@enterprise.wiki`,
          role: s.role as 'Viewer' | 'Editor' | 'Admin'
        };
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllowedUsers(initial);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalVisibility(document.visibility?.toLowerCase() === 'workspace' ? 'public' : 'private');
    }
  }, [document, users]);

  if (!isOpen || !document) return null;

  const activeUsers = users.filter(u => u.id !== currentUser?.id && u.status === 'ACTIVE');

  const filteredUsers = userSearch.trim() === '' 
    ? [] 
    : activeUsers.filter(user => 
        !allowedUsers.some(allowed => allowed.id === user.id) &&
        (user.username.toLowerCase().includes(userSearch.toLowerCase()) || 
         (user.email && user.email.toLowerCase().includes(userSearch.toLowerCase())))
      );

  const handleAddUser = (user: any) => {
    setAllowedUsers([
      ...allowedUsers, 
      { 
        id: user.id, 
        name: user.username, 
        email: user.email || `${user.username}@enterprise.wiki`,
        role: 'Viewer'
      }
    ]);
    setUserSearch('');
  };

  const handleRemoveUser = (userToRemoveId: string) => {
    setAllowedUsers(allowedUsers.filter((user) => user.id !== userToRemoveId));
  };

  const handleRoleChange = (userId: string, role: 'Viewer' | 'Editor' | 'Admin') => {
    setAllowedUsers(allowedUsers.map(u => u.id === userId ? { ...u, role } : u));
  };

  const handleSavePermissions = () => {
    const mappedVisibility = localVisibility === 'public' ? 'WORKSPACE' : 'PRIVATE';
    const newSharedWith = allowedUsers.map(u => ({
      userId: u.id,
      role: u.role
    }));

    useWikiStore.getState().updateDocument(document.id, {
      visibility: mappedVisibility,
      sharedWith: newSharedWith
    });

    // Keep parent in sync
    setVisibility(localVisibility);

    try {
      if (currentUser) {
        addAuditLogVFS(
          currentUser.id,
          'DOCUMENT_SHARE',
          `Updated permissions for "${document.title}" (Visibility: ${mappedVisibility}, Shared with: ${newSharedWith.length} users).`,
          document.id
        );
      }
    } catch (e) {
      console.error(e);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10 font-sans"
      >
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h2 className="text-sm font-bold text-slate-200">Share this Wiki Page</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Visibility</label>
            <select
              value={localVisibility}
              onChange={(e) => setLocalVisibility(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="private">Private (Only you and invited members)</option>
              <option value="public">Public (Everyone in the workspace)</option>
            </select>
          </div>

          {localVisibility === 'public' ? (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <p className="text-sm text-indigo-400">This page is visible to everyone in the workspace.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Invite Members</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-650 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="Search users by username or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  
                  {/* THE DROPDOWN LIST */}
                  {filteredUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-48 overflow-y-auto">
                      {filteredUsers.map(user => (
                        <div 
                          key={user.id}
                          className="px-4 py-2 hover:bg-indigo-600 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-700/50 last:border-0"
                          onClick={() => handleAddUser(user)}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">{user.username}</span>
                            <span className="text-xs text-slate-400">{user.email || `${user.username}@enterprise.wiki`}</span>
                          </div>
                          <UserPlus size={14} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                  {userSearch.length > 0 && filteredUsers.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl px-4 py-3 text-sm text-slate-400 text-center">
                      No matching users found.
                    </div>
                  )}
                </div>
              </div>

              {allowedUsers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">People with access</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                    {allowedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-800 bg-slate-950/30">
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="text-sm text-slate-300 font-medium truncate">{user.name}</span>
                          <span className="text-xs text-slate-500 truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="Viewer">Viewer</option>
                            <option value="Editor">Editor</option>
                            <option value="Admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Remove User"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSavePermissions}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
            Save Permissions
          </button>
        </div>
      </motion.div>
    </div>
  );
}
