import React, { useState, useEffect } from 'react';
import { X, Loader2, User } from 'lucide-react';
import { useWikiStore, readFile, writeFile, addAuditLogVFS, getValidUserId, warnStaleSession } from '@/lib/store';

interface TeamMember {
  userId: string;
  username?: string;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  onSuccess?: (id: string) => void;
}

export default function CreateDocumentModal({ isOpen, onClose, team, onSuccess }: Props) {
  const users = readFile('users.json') || [];
  const templates = readFile('templates.json') || [];
  const storeCurrentUser = useWikiStore(state => state.currentUser);
  const currentUser = readFile('users.json')?.find((u: any) => u.id === storeCurrentUser?.id) || storeCurrentUser;
  
  const [pageName, setPageName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && team) {
      setTimeout(() => {
        setErrorMsg('');
        setPageName('');
        const initialPerms: Record<string, string> = {};
        team.members.forEach(m => {
          initialPerms[m.userId] = 'VIEWER';
        });
        setPermissions(initialPerms);
      }, 0);
    }
  }, [isOpen, team]);

  if (!isOpen || !team) return null;

  const handleRoleChange = (userId: string, role: string) => {
    setPermissions(prev => ({ ...prev, [userId]: role }));
  };

  const handleCreate = async () => {
    if (!pageName.trim()) return;
    const userId = getValidUserId(currentUser);
    if (!userId) {
      warnStaleSession();
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      // Simulate brief network delay
      await new Promise(r => setTimeout(r, 400));

      const docId = `doc-${new Date().getTime()}`;

      const sharedWith = Object.entries(permissions).map(([memberId, p]) => ({
        userId: memberId,
        role: (p === 'EDITOR' || p === 'MODERATOR') ? 'Editor' : (p === 'ADMIN' ? 'Admin' : 'Viewer') as any
      }));
      if (!sharedWith.some(s => s.userId === userId)) {
        sharedWith.push({ userId, role: 'Admin' });
      }

      let content = '';
      if (selectedTemplateId) {
        const tpl = templates.find((t: any) => t.id === selectedTemplateId);
        if (tpl) {
          content = `<h1>${pageName}</h1>${tpl.content}`;
        }
      }

      const newDoc = {
        id: docId,
        title: pageName,
        content,
        ownerId: userId,
        visibility: 'PRIVATE' as const,
        collaborators: [],
        teamCollaborators: [{ teamId: team.id, access: 'READ' as const }],
        sharedWith,
        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      useWikiStore.getState().createDocument(newDoc);

      addAuditLogVFS(
        userId,
        'WIKI_CREATE',
        `Created wiki document "${pageName}" under team "${team.name}".`,
        userId,
        {
          wikiName: pageName,
          teamName: team.name,
          role: currentUser?.role,
          userName: currentUser?.username,
          userEmail: currentUser?.email || `${currentUser?.username}@enterprise.wiki`
        }
      );

      if (onSuccess) {
        onSuccess(docId);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error creating document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            Create Document in {team.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900 text-xs text-red-400">
              {errorMsg}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Page Name</label>
            <input 
              type="text" 
              value={pageName}
              onChange={e => setPageName(e.target.value)}
              placeholder="e.g. Q3 Roadmap"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Template (Optional)</label>
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Blank Document</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Assign Permissions</label>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-800/50">
              {team.members.map(member => {
                const userData = users.find((u: any) => u.id === member.userId);
                return (
                <div key={member.userId} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                      <User size={12} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-200">
                        {userData ? userData.username : 'Unknown User'}
                      </span>
                      {userData?.email && (
                        <span className="text-[10px] text-slate-500">{userData.email}</span>
                      )}
                    </div>
                  </div>
                  <select 
                    value={permissions[member.userId] || 'VIEWER'}
                    onChange={e => handleRoleChange(member.userId, e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 ml-2"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    <option value="MODERATOR">Moderator</option>
                  </select>
                </div>
                );
              })}
              {team.members.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">No members in this team.</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleCreate} 
            disabled={!pageName.trim() || loading}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
