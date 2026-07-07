import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ChevronRight, ChevronDown, Minus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWikiStore, readFile } from '@/lib/store';
import { getAccessibleTeams } from '@/lib/acl';

function IndeterminateCheckbox({ checked, indeterminate, onChange, className }: { checked: boolean, indeterminate: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className={`relative flex items-center justify-center w-4 h-4 rounded border border-slate-700 bg-slate-950 ${checked ? 'bg-indigo-600 border-indigo-600' : ''} ${className}`}>
      <input 
        type="checkbox" 
        ref={ref}
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full m-0 p-0"
      />
      {checked && !indeterminate && <Check size={12} className="text-white pointer-events-none" />}
      {indeterminate && !checked && <Minus size={12} className="text-indigo-500 pointer-events-none" />}
    </div>
  );
}

export default function BulkExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const storeCurrentUser = useWikiStore(state => state.currentUser);
  const currentUser = readFile('users.json')?.find((u: any) => u.id === storeCurrentUser?.id) || storeCurrentUser;
  const teams = readFile('teams.json') || [];
  
  const allDocuments = useWikiStore(state => state.documents);

  const accessibleTeams = getAccessibleTeams(teams, currentUser);

  // Compute pages accessible by the current user grouped by team
  const teamPagesMap = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    accessibleTeams.forEach((team: any) => {
      const teamPages = allDocuments.filter((p: any) => 
        !p.isDeleted &&
        p.teamCollaborators?.some((tc: any) => tc.teamId === team.id) &&
        (currentUser.role === 'ADMIN' || (p.sharedWith && p.sharedWith.some((s: any) => s.userId === currentUser.id)))
      );
      map[team.id] = teamPages;
    });
    return map;
  }, [accessibleTeams, allDocuments, currentUser]);

  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'DOCX' | 'PDF'>('DOCX');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        // Select all accessible pages by default
        const allPageIds = Object.values(teamPagesMap).flatMap(pages => pages.map(p => p.id));
        setSelectedPages(allPageIds);
      }, 0);
    }
  }, [isOpen, teamPagesMap]);

  const toggleTeamExpansion = (teamId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleTeamSelection = (teamId: string) => {
    const teamPageIds = teamPagesMap[teamId].map(p => p.id);
    const areAllSelected = teamPageIds.every(id => selectedPages.includes(id));
    
    if (areAllSelected) {
      setSelectedPages(prev => prev.filter(id => !teamPageIds.includes(id)));
    } else {
      setSelectedPages(prev => {
        const newSet = new Set(prev);
        teamPageIds.forEach(id => newSet.add(id));
        return Array.from(newSet);
      });
    }
  };

  const togglePageSelection = (pageId: string) => {
    setSelectedPages(prev => 
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

  const preprocessExportContent = (htmlContent: string) => {
    if (typeof window === 'undefined') return htmlContent;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const processDOMNodes = (node: HTMLElement) => {
      if (node.tagName === 'LI' && node.getAttribute('data-type') === 'taskItem') {
         const isChecked = node.getAttribute('data-checked') === 'true';
         const label = node.querySelector('label');
         if (label) {
           const span = document.createElement('span');
           span.textContent = isChecked ? '[x] ' : '[ ] ';
           span.style.fontFamily = 'monospace';
           label.replaceWith(span);
         }
      }

      if ((node.tagName === 'P' || node.tagName === 'DIV') && node.innerHTML.trim() === '') {
         node.innerHTML = '<br />';
      }

      Array.from(node.children).forEach(child => {
        if (child.nodeType === 1) {
          processDOMNodes(child as HTMLElement);
        }
      });
    };

    processDOMNodes(tempDiv);

    return tempDiv.innerHTML;
  };

  const generateExport = async () => {
    if (!currentUser) return;
    setIsExporting(true);
    setExportProgress({ current: 0, total: selectedPages.length });

    try {
      const allPagesToExport: { page: any; team: any }[] = [];
      accessibleTeams.forEach((team: any) => {
        const teamPages = teamPagesMap[team.id].filter((p: any) => selectedPages.includes(p.id));
        teamPages.forEach((page: any) => {
          allPagesToExport.push({ page, team });
        });
      });

      if (allPagesToExport.length === 0) {
        setIsExporting(false);
        return;
      }

      if (typeof window !== 'undefined' && (window as any).JSZip) {
        const zip = new (window as any).JSZip();

        for (let i = 0; i < allPagesToExport.length; i++) {
          const { page, team } = allPagesToExport[i];
          setExportProgress({ current: i + 1, total: allPagesToExport.length });

          const safeTeamName = team.name.replace(/[^a-z0-9]/gi, '_') || `team_${team.id}`;
          const safePageTitle = page.title.replace(/[^a-z0-9]/gi, '_') || `page_${page.id}`;
          const processedContent = preprocessExportContent(page.content);

          if (exportFormat === 'DOCX') {
            let docxContent = `
              <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
              <head><meta charset='utf-8'><title>${page.title}</title></head>
              <body>
                <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">${page.title}</h1>
                ${processedContent}
              </body></html>
            `;
            const blob = new Blob([docxContent], { type: 'application/msword' });
            zip.file(`${safeTeamName}/${safePageTitle}.doc`, blob);
          } else if (exportFormat === 'PDF') {
            // Create element off-screen for html2pdf
            const pageElement = document.createElement('div');
            pageElement.innerHTML = `
              <style>
                .pdf-container {
                  font-family: system-ui, -apple-system, sans-serif; 
                  color: #1a1a1a; 
                  background-color: white; 
                  padding: 40px; 
                  width: 800px; 
                  line-height: 1.6; 
                }
                .pdf-container > *:last-child {
                  margin-bottom: 0 !important;
                  padding-bottom: 0 !important;
                }
                h1 { font-size: 24px; font-weight: bold; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                h2 { font-size: 20px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
                h3 { font-size: 16px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; }
                p { margin-bottom: 12px; }
                blockquote { border-left: 4px solid #cbd5e1; padding-left: 16px; color: #475569; font-style: italic; margin-top: 12px; margin-bottom: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                th { background-color: #f1f5f9; font-weight: bold; }
                pre { background-color: #f1f5f9; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 14px; margin-top: 12px; margin-bottom: 12px; white-space: pre-wrap; }
                code { font-family: monospace; font-size: 14px; background-color: #f1f5f9; padding: 2px 4px; border-radius: 2px; }
                img { max-width: 100%; height: auto; border-radius: 4px; margin: 12px 0; }
                ul, ol {
                  padding-left: 24px !important;
                  margin-left: 0 !important;
                  margin-top: 8px !important;
                  margin-bottom: 8px !important;
                }
                li {
                  padding-left: 4px !important;
                  margin-left: 0 !important;
                  margin-bottom: 4px !important;
                }
                li > p {
                  display: inline !important; 
                  margin: 0 !important;
                  padding: 0 !important;
                }
                ul[data-type="taskList"] {
                  list-style: none !important;
                  padding-left: 0 !important;
                  margin-top: 8px !important;
                  margin-bottom: 8px !important;
                }
                ul[data-type="taskList"] li {
                  display: flex !important;
                  flex-direction: row !important;
                  align-items: flex-start !important;
                  padding-left: 0 !important;
                  margin-left: 0 !important;
                  margin-bottom: 6px !important;
                  list-style-type: none !important;
                }
                ul[data-type="taskList"] li > label {
                  flex: 0 0 auto !important;
                  margin-right: 8px !important;
                  font-family: monospace !important;
                  font-size: 14px !important;
                  white-space: nowrap !important;
                  display: inline-block !important;
                }
                ul[data-type="taskList"] li > div {
                  flex: 1 1 auto !important;
                  display: inline-block !important;
                }
                ul[data-type="taskList"] li > div > p {
                  display: inline !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                ul[data-type="taskList"] li[data-checked="true"] > div {
                  text-decoration: line-through !important;
                  opacity: 0.6 !important;
                }
                .pdf-container u, .pdf-container span[style*="underline"] {
                  text-decoration: none !important; 
                  border-bottom: 2px solid currentColor !important; 
                  display: inline-block !important;
                  padding-bottom: 1px !important;
                  padding-right: 3px !important;
                  line-height: 1 !important;
                  vertical-align: baseline !important;
                }
                .pdf-hide { display: none !important; }
              </style>
              <div class="pdf-container">
                <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">${page.title}</h1>
                <div>${processedContent}</div>
              </div>
            `;
            
            pageElement.style.position = 'fixed';
            pageElement.style.top = '-9999px';
            pageElement.style.left = '-9999px';
            pageElement.style.width = '800px';
            pageElement.style.background = 'white';
            document.body.appendChild(pageElement);

            const opt = {
              margin: 0.5,
              filename: `${safePageTitle}.pdf`,
              image: { type: 'jpeg', quality: 1 },
              html2canvas: { scale: 2, useCORS: true, logging: false },
              jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: ['avoid-all', 'css'] }
            };

            const pdfBlob = await (window as any).html2pdf().set(opt).from(pageElement).output('blob');
            document.body.removeChild(pageElement);
            zip.file(`${safeTeamName}/${safePageTitle}.pdf`, pdfBlob);
          }

          // Small delay to keep UI responsive
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        if ((window as any).saveAs) {
          (window as any).saveAs(zipBlob, `Wiki_Workspace_Export.zip`);
        } else {
          const url = URL.createObjectURL(zipBlob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = `Wiki_Workspace_Export.zip`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url);
        }
      } else {
        throw new Error('JSZip not found');
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Download size={16} className="text-indigo-400" /> Bulk Export Workspace
              </h2>
              <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 flex-1">
              <p className="text-xs text-slate-400">
                Select the wikis you want to include in your export. They will be compiled into a single document.
              </p>
              
              <div className="flex gap-4 pb-2 border-b border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${exportFormat === 'DOCX' ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-600 group-hover:border-slate-400'}`}>
                    {exportFormat === 'DOCX' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                  <input type="radio" name="format" value="DOCX" checked={exportFormat === 'DOCX'} onChange={() => setExportFormat('DOCX')} className="sr-only" />
                  <span className="text-sm text-slate-300">DOCX (Word)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${exportFormat === 'PDF' ? 'border-indigo-500 bg-indigo-500/20' : 'border-slate-600 group-hover:border-slate-400'}`}>
                    {exportFormat === 'PDF' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                  <input type="radio" name="format" value="PDF" checked={exportFormat === 'PDF'} onChange={() => setExportFormat('PDF')} className="sr-only" />
                  <span className="text-sm text-slate-300">PDF (Portable Document)</span>
                </label>
              </div>

              <div className="space-y-1">
                {accessibleTeams.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No teams accessible.</div>
                ) : (
                  accessibleTeams.map((team: any) => {
                    const teamPages = teamPagesMap[team.id] || [];
                    if (teamPages.length === 0) return null; // Only show teams with pages
                    
                    const teamPageIds = teamPages.map((p: any) => p.id);
                    const selectedCount = teamPageIds.filter((id: string) => selectedPages.includes(id)).length;
                    const isAllSelected = selectedCount === teamPages.length && teamPages.length > 0;
                    const isIndeterminate = selectedCount > 0 && selectedCount < teamPages.length;
                    const isExpanded = expandedTeams.includes(team.id);

                    return (
                      <div key={team.id} className="flex flex-col">
                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
                          <button 
                            onClick={(e) => toggleTeamExpansion(team.id, e)}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-700/50"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <IndeterminateCheckbox 
                              checked={isAllSelected}
                              indeterminate={isIndeterminate}
                              onChange={() => toggleTeamSelection(team.id)}
                            />
                            <span className="text-sm text-slate-200 font-medium">{team.name}</span>
                            <span className="text-xs text-slate-500 ml-auto">{selectedCount}/{teamPages.length}</span>
                          </label>
                        </div>
                        
                        {isExpanded && (
                          <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-2">
                            {teamPages.map((page: any) => (
                              <label key={page.id} className="flex items-center gap-3 p-1.5 rounded hover:bg-slate-800/30 cursor-pointer transition-colors">
                                <IndeterminateCheckbox 
                                  checked={selectedPages.includes(page.id)}
                                  indeterminate={false}
                                  onChange={() => togglePageSelection(page.id)}
                                />
                                <span className="text-xs text-slate-300">{page.title}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end items-center gap-2 shrink-0">
              {isExporting && (
                <div className="text-xs text-indigo-400 mr-auto flex items-center gap-1.5 font-medium animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  Generating: {exportProgress.current} / {exportProgress.total}
                </div>
              )}
              <button 
                onClick={onClose} 
                disabled={isExporting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={generateExport}
                disabled={selectedPages.length === 0 || isExporting}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Export Selected ({selectedPages.length})
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
