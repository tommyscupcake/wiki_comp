'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWikiStore } from '@/lib/store';
import { Activity } from 'lucide-react';

export function AdminLogsPageContent({ isTabbed = false }: { isTabbed?: boolean }) {
  // Optimization: Fetch audit-logs once on mount via lazy state initializer to prevent repeatedly parsing/rendering.
  const [auditLogs] = useState<any[]>(() => {
    return useWikiStore.getState().virtualFileSystem['audit-logs.json'] || [];
  });

  const filteredAuditLogs = useMemo(() => {
    const excludedTypes = ['ACCESS_CONSOLE', 'VIEW_PAGE', 'DIRECTORY_ACCESS', 'EXPORT_USERS_CSV'];
    const includedTypes = [
      'USER_CREATE', 'WIKI_CREATE', 'TEAM_CREATE', 
      'USER_UPDATE', 'TEAM_UPDATE', 'WIKI_UPDATE',
      'USER_DELETE', 'TEAM_DELETE', 'WIKI_DELETE',
      'SESSION_REVOKE', 'PASSWORD_RESET', 'SYSTEM_INIT'
    ];
    return auditLogs.filter((log: any) => 
      log && 
      !excludedTypes.includes(log.action) && 
      (includedTypes.includes(log.action) || log.action.includes('CREATE') || log.action.includes('UPDATE') || log.action.includes('DELETE'))
    );
  }, [auditLogs]);
  
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
            Security Event Logs
          </h3>
          <p className="text-[10px] text-slate-500">
            Secretly tracing all administrative edits, profile updates, and authentication override attempts.
          </p>
        </div>

        <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/20">
          {filteredAuditLogs.length} Events Logged
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-850">
        {filteredAuditLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            No logged security events recorded.
          </div>
        ) : (
          filteredAuditLogs.map((log: any, index: number) => (
            <div key={`${log.id}-${index}`} className="p-3.5 hover:bg-slate-950/20 transition-all flex items-start gap-3.5">
              <div className="mt-0.5 h-6 w-6 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                <Activity size={12} className="text-indigo-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-200">@{log.adminName}</span>
                    <span className="text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.2 rounded">
                      {log.action}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {(() => {
                      try {
                        if (!log.timestamp) return '';
                        const d = new Date(log.timestamp);
                        if (isNaN(d.getTime())) {
                          return log.timestamp;
                        }
                        return d.toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        });
                      } catch (e) {
                        return log.timestamp;
                      }
                    })()}
                  </span>
                </div>

                <div className="mt-1">
                  {log.action === 'WIKI_CREATE' ? (
                    (() => {
                      const wikiName = log.metadata?.wikiName || log.details?.match(/"([^"]+)"/)?.[1] || 'Untitled Wiki';
                      const teamName = log.metadata?.teamName || 'Personal Workspace';
                      return (
                        <div className="text-[11px] text-slate-300">
                          Created wiki <span className="font-semibold text-emerald-400">&quot;{wikiName}&quot;</span> under team <span className="font-semibold text-indigo-400">&quot;{teamName}&quot;</span>.
                        </div>
                      );
                    })()
                  ) : log.action === 'USER_CREATE' ? (
                    (() => {
                      const userName = log.metadata?.userName || log.details?.match(/"([^"]+)"/)?.[1] || 'New User';
                      const userEmail = log.metadata?.userEmail || `${userName}@enterprise.wiki`;
                      const role = log.metadata?.role || log.details?.match(/as (\w+)/)?.[1] || 'VIEWER';
                      return (
                        <div className="text-[11px] text-slate-300">
                          Registered new user <span className="font-semibold text-sky-400">{userName}</span> (<span className="text-slate-400">{userEmail}</span>) with role <span className="font-mono text-[10px] bg-slate-850 text-sky-300 px-1.5 py-0.5 rounded border border-slate-750">{role}</span>.
                        </div>
                      );
                    })()
                  ) : log.action === 'TEAM_CREATE' ? (
                    (() => {
                      const teamName = log.metadata?.teamName || log.details?.split('Created team: ')?.[1] || log.details?.match(/"([^"]+)"/)?.[1] || 'New Team';
                      const creator = log.adminName || 'Admin';
                      return (
                        <div className="text-[11px] text-slate-300">
                          Created new team <span className="font-semibold text-indigo-400">&quot;{teamName}&quot;</span>, initialized by <span className="font-semibold text-slate-200">@{creator}</span>.
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-[11px] text-slate-400">{log.details}</p>
                  )}
                </div>
                
                {log.targetUserId && (
                  <span className="text-[9px] font-mono text-slate-600 block mt-1">
                    Target Account ID: {log.targetUserId}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
