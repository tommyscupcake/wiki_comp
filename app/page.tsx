'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWikiStore, readFile, writeFile, addAuditLogVFS } from '@/lib/store';
import { canUserEdit, canUserShare } from '@/lib/acl';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit2,
  Download,
  Upload,
  Sparkles,
  Trash2,
  BookOpen,
  Clock,
  ArrowUpDown,
  Check,
  Loader2,
  FileDown,
  Info,
  Layers,
  SearchCode,
  AlertCircle,
  User,
  Shield,
  Users,
  X,
  PanelLeftClose,
  PanelLeft,
  Lock,
  Unlock,
  Save,
  Calendar,
  Bell,
} from 'lucide-react';

import WikiEditor from '@/components/WikiEditor';
import ShareModal from '@/components/ShareModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import LocalSidebar from '@/components/LocalSidebar';
import TableOfContents from '@/components/TableOfContents';
import BulkExportModal from '@/components/BulkExportModal';
import DocumentDiffViewer from '@/components/DocumentDiffViewer';

export default function WikiPageStage() {
  const router = useRouter();
  const {
    logout,
    loadFromServer,
  } = useWikiStore();

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const storeCurrentUser = useWikiStore(state => state.currentUser);
  const currentUser = readFile('users.json')?.find((u: any) => u.id === storeCurrentUser?.id) || storeCurrentUser;
  
  const documents = useWikiStore(state => state.documents);

  const users = readFile('users.json') || [];
  const teams = readFile('teams.json') || [];
  const notifications = useWikiStore(state => state.notifications);
  const markNotificationAsRead = useWikiStore(state => state.markNotificationAsRead);
  const markAllNotificationsAsRead = useWikiStore(state => state.markAllNotificationsAsRead);
  const clearNotifications = useWikiStore(state => state.clearNotifications);
  const syncWarning = useWikiStore(state => state.syncWarning);
  const clearSyncWarning = useWikiStore(state => state.clearSyncWarning);

  useEffect(() => {
    if (!syncWarning) return;
    const timer = setTimeout(() => clearSyncWarning(), 8000);
    return () => clearTimeout(timer);
  }, [syncWarning, clearSyncWarning]);

  const [activePageId, setActivePageId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'alpha'>('updated');
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dynamic Resizable Sidebar States
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wiki_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return Math.max(240, Math.min(parsed, 480));
        }
      }
    }
    return 280;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Sidebar drag width limits & handler tracking
  useEffect(() => {
    localStorage.setItem('wiki_sidebar_width', sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate layout shift relative to left edge with padding offset of ~16px on desktop
      const offset = window.innerWidth >= 768 ? 16 : 12;
      const calculatedWidth = e.clientX - offset;
      const maxWidth = Math.min(480, window.innerWidth * 0.5);
      const clampedWidth = Math.max(240, Math.min(calculatedWidth, maxWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Selection Guard
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Status message
  const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Custom modal states to avoid iframe window.prompt / window.confirm blockage
  const [promptInputValue, setPromptInputValue] = useState('');
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    defaultValue: string;
    placeholder: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: (value: string) => void;
    onCancel?: () => void;
    oldHtml?: string;
    newHtml?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    defaultValue: '',
    placeholder: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: () => {},
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel?: () => void;
    alternativeLabel?: string;
    onAlternative?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: () => {},
  });

  const showPromptModal = (options: {
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (value: string) => void;
    onCancel?: () => void;
    oldHtml?: string;
    newHtml?: string;
  }) => {
    setPromptInputValue(options.defaultValue || '');
    setPromptModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      defaultValue: options.defaultValue || '',
      placeholder: options.placeholder || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      oldHtml: options.oldHtml,
      newHtml: options.newHtml,
      onConfirm: (val) => {
        options.onConfirm(val);
        setPromptModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (options.onCancel) options.onCancel();
        setPromptModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const showConfirmModal = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    alternativeLabel?: string;
    onAlternative?: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      onConfirm: () => {
        options.onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (options.onCancel) options.onCancel();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      alternativeLabel: options.alternativeLabel,
      onAlternative: options.onAlternative ? () => {
        options.onAlternative?.();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      } : undefined
    });
  };
  
  const [prevActivePageId, setPrevActivePageId] = useState<string>('');
  if (activePageId !== prevActivePageId) {
    setPrevActivePageId(activePageId);
    setHasUnsavedChanges(false);
    setSavingStatus('saved');
  }

  // AI Panel State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSystemRole, setAiSystemRole] = useState(
    'You are an expert technical editor. Refine the provided document content by correcting spelling, improving clarity, retaining all HTML formatting exactly, and making it sound professional and engaging.'
  );

  const importInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<{ editor: any }>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [visibility, setVisibility] = useState('private');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string; folderId?: string } | null>(null);

  const [zoomLevel, setZoomLevel] = useState(100);
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));
  const resetZoom = () => setZoomLevel(100);

  // Filter and load client-side pages considering ownership, explicit collaborations, and Workspace visibility
  const userDocuments: any[] = useMemo(() => {
    if (!currentUser) return [];
    const activeDocs = documents.filter((doc: any) => !doc.isDeleted);
    if (currentUser.role === 'ADMIN') return activeDocs;

    // Get all teams the current user is a member of
    const userTeams = (teams || []).filter((team: any) =>
      (team.members || []).some((m: any) => m.userId === currentUser.id)
    );

    return activeDocs.filter((doc: any) => {
      // 1. User is the owner of the document
      if (doc.ownerId === currentUser.id) return true;

      // 2. Document has public Workspace visibility
      if (doc.visibility === 'WORKSPACE') return true;

      // 3. Document is explicitly shared with user via sharedWith
      if (doc.sharedWith && doc.sharedWith.some((s: any) => s.userId === currentUser.id)) return true;

      // 4. Document is explicitly shared with user via collaborators
      if (doc.collaborators && doc.collaborators.some((c: any) => c.userId === currentUser.id)) return true;

      // 5. Document is shared with one of user's teams
      if (doc.teamCollaborators && doc.teamCollaborators.some((tc: any) => userTeams.some((ut: any) => ut.id === tc.teamId))) return true;

      return false;
    });
  }, [documents, currentUser, teams]);

  const isModerator = useMemo(() => {
    if (!currentUser) return false;
    return (teams || []).some((t: any) =>
      (t.members || []).some((m: any) => m.userId === currentUser.id && m.teamRole === 'MODERATOR')
    );
  }, [teams, currentUser]);

  // Handle active page ID fallback
  useEffect(() => {
    if (userDocuments.length > 0) {
      if (!activePageId || !userDocuments.some((doc: any) => doc.id === activePageId)) {
        const timer = setTimeout(() => {
          setActivePageId(userDocuments[0].id);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [userDocuments, activePageId]);

  // eslint-disable-next-line react-hooks/refs
  const editor = editorRef.current?.editor;
  const activePage = userDocuments.find((p) => p.id === activePageId) || null;

  const mentionableUsers = useMemo(() => {
    if (!activePage) return [];
    
    // First collect all user IDs that have access
    const accessibleUserIds = new Set<string>();
    
    // Owner has access
    accessibleUserIds.add(activePage.ownerId);
    
    // Direct collaborators have access
    if (activePage.sharedWith) {
      activePage.sharedWith.forEach((c: any) => {
        if (typeof c === 'string') {
          accessibleUserIds.add(c);
        } else if (c.userId) {
          accessibleUserIds.add(c.userId);
        } else if (c.teamId) {
          const team = teams.find((t: any) => t.id === c.teamId);
          if (team && team.members) {
            team.members.forEach((m: any) => accessibleUserIds.add(m.userId));
          }
        }
      });
    }

    if (activePage.collaborators) {
      activePage.collaborators.forEach((c: any) => accessibleUserIds.add(c.userId));
    }
    
    // Team collaborators have access
    if (activePage.teamCollaborators) {
      activePage.teamCollaborators.forEach((tc: any) => {
        const team = teams.find((t: any) => t.id === tc.teamId);
        if (team && team.members) {
          team.members.forEach((m: any) => accessibleUserIds.add(m.userId));
        }
      });
    }
    
    // Filter users and also include ALL admins, because admins always have access to everything
    return users.filter((u: any) => u.role === 'ADMIN' || accessibleUserIds.has(u.id)).map((u: any) => ({
      id: u.id,
      label: u.username,
      email: u.email
    }));
  }, [activePage, users, teams]);

  // Sync page visibility state when page changes
  useEffect(() => {
    if (activePage) {
      const targetVisibility = activePage.visibility?.toLowerCase() || 'private';
      if (visibility !== targetVisibility) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibility(targetVisibility);
      }
    }
  }, [activePage, visibility]);

  // Permission Calculations
  const isEffectiveReadOnly = useMemo(() => {
    return !(currentUser?.role === 'ADMIN' || canUserEdit(currentUser?.id, activePage)) || isReadOnly;
  }, [activePage, currentUser, isReadOnly]);

  const handleContentChange = (newHtml: string) => {
    if (!activePageId || !activePage) return;
    if (newHtml !== activePage.content) {
      setHasUnsavedChanges(true);
      setSavingStatus('unsaved');
    } else {
      setHasUnsavedChanges(false);
      setSavingStatus('saved');
    }
  };



  // Handle active page title change
  const handleTitleChange = (newTitle: string) => {
    if (!activePageId || !activePage) return;
    useWikiStore.getState().updateDocument(activePageId, { title: newTitle });
  };

  const handlePageChange = (newPageId: string) => {
    if (hasUnsavedChanges) {
      showConfirmModal({
        title: "Unsaved Changes",
        message: "You have unsaved changes in this document. Switching pages now will discard those changes.",
        confirmLabel: "Discard & Switch",
        cancelLabel: "Stay Here",
        onConfirm: () => {
          setHasUnsavedChanges(false);
          setSavingStatus('saved');
          setActivePageId(newPageId);
        }
      });
    } else {
      setActivePageId(newPageId);
    }
  };

  const templates = readFile('templates.json') || [];
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocTemplateId, setNewDocTemplateId] = useState('');

  // Add brand new page
  const handleAddPage = () => {
    setIsNewDocModalOpen(true);
    setNewDocName('');
    setNewDocTemplateId('');
  };

  const confirmAddPage = () => {
    if (!currentUser) return;
    const newDocId = `doc-${new Date().getTime()}`;
    
    let content = '';
    if (newDocTemplateId) {
      const tpl = templates.find((t: any) => t.id === newDocTemplateId);
      if (tpl) {
        content = `<h1>${newDocName || 'Untitled Document'}</h1>${tpl.content}`;
      }
    }

    const newDoc = {
      id: newDocId,
      title: newDocName || '📁 Untitled Document',
      content,
      ownerId: currentUser.id,
      visibility: 'PRIVATE' as const,
      collaborators: [],
      teamCollaborators: [],
      sharedWith: currentUser.id ? [{ userId: currentUser.id, role: 'Admin' as const }] : [],
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    useWikiStore.getState().createDocument(newDoc);
    
    if (currentUser) {
      addAuditLogVFS(
        currentUser.id,
        'WIKI_CREATE',
        `Created wiki document "${newDoc.title}" under Personal Workspace.`,
        currentUser.id,
        {
          wikiName: newDoc.title,
          teamName: 'Personal Workspace',
          role: currentUser.role,
          userName: currentUser.username,
          userEmail: currentUser.email || `${currentUser.username}@enterprise.wiki`
        }
      );
    }

    setActivePageId(newDocId);
    setIsNewDocModalOpen(false);
  };

  // Delete page with ownership/role safeties and modal confirmation trigger
  const handleDeletePage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const docToDelete = documents.find((d: any) => d.id === id);
    if (!docToDelete) return;

    const isOwner = docToDelete.ownerId === currentUser?.id;
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      alert('Forbidden: You can only delete documents that you own or as an Admin.');
      return;
    }

    if (userDocuments.length <= 1) {
      alert('You must preserve at least one active page in your Workspace!');
      return;
    }

    setDocumentToDelete({ id: docToDelete.id, title: docToDelete.title, folderId: docToDelete.teamCollaborators?.[0]?.teamId || 'workspace' });
    setIsDeleteModalOpen(true);
  };

  // Perform actual deletion when confirmed
  const handleConfirmDelete = () => {
    if (!documentToDelete) return;
    const { id } = documentToDelete as any;
    
    useWikiStore.getState().softDeleteDocument(id);
    
    if (activePageId === id) {
      const remaining = userDocuments.filter((d: any) => d.id !== id);
      if (remaining.length > 0) {
        setActivePageId(remaining[0].id);
      } else {
        setActivePageId('');
      }
    }
    setDocumentToDelete(null);
  };

  // Filter and sort pages
  const processedPages = useMemo(() => {
    let result = [...userDocuments];

    // Filter by text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query)
      );
    }

    // Sort options
    if (sortBy === 'alpha') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // default: update time
      result.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    }

    return result;
  }, [userDocuments, searchQuery, sortBy]);

  // Markdown / HTML direct imports
  const triggerImportFile = () => {
    importInputRef.current?.click();
  };

  const TEXT_IMPORT_EXTENSIONS = ['.md', '.markdown', '.html', '.htm'];
  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

  const finishFileImport = (content: string, titlePrefix: string, file: File) => {
    if (!currentUser) return;

    const newDocId = `doc-${new Date().getTime()}`;
    const newDoc = {
      id: newDocId,
      title: `${titlePrefix} ${file.name.replace(/\.[^/.]+$/, '')}`,
      content: content || '<p>Imported empty document...</p>',
      ownerId: currentUser.id,
      visibility: 'PRIVATE' as const,
      collaborators: [],
      teamCollaborators: [],
      sharedWith: currentUser.id ? [{ userId: currentUser.id, role: 'Admin' as const }] : [],
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    useWikiStore.getState().createDocument(newDoc);

    addAuditLogVFS(
      currentUser.id,
      'WIKI_CREATE',
      `Created wiki document "${newDoc.title}" via file import.`,
      currentUser.id,
      {
        wikiName: newDoc.title,
        teamName: 'Imported Pages',
        role: currentUser.role,
        userName: currentUser.username,
        userEmail: currentUser.email || `${currentUser.username}@enterprise.wiki`
      }
    );

    setActivePageId(newDocId);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!currentUser) return;

    const lowerName = file.name.toLowerCase();
    const isTextImport = TEXT_IMPORT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (isTextImport) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        let cleanHtml = '';

        if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          cleanHtml = text;
        } else {
          // Safe, basic Markdown parser translating headings, bullets, blocks into pure HTML structured markup
          cleanHtml = text
            .replace(/^#\s+(.*$)/gim, '<h1>$1</h1>')
            .replace(/^##\s+(.*$)/gim, '<h2>$1</h2>')
            .replace(/^###\s+(.*$)/gim, '<h3>$1</h3>')
            .replace(/^\>\s+(.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/^\s*- (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/^([^\r\n]+)/gim, '<p>$1</p>');

          // Merge adjacent <ul> elements safely
          cleanHtml = cleanHtml.replace(/<\/ul>\s*<ul>/g, '');
        }

        finishFileImport(cleanHtml, '📥', file);
      };
      reader.readAsText(file);
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    // Non-text file (image, PDF, zip, or anything else a wiki can attach):
    // upload to S3 via the same generic pipeline the editor's image button
    // uses, then embed it in a brand-new document — inline <img> for images,
    // a download link for everything else.
    const isImage = file.type.startsWith('image/') || IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('userId', currentUser.id);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      const data = await response.json();
      const fileUrl = data.url;

      const content = isImage
        ? `<img src="${fileUrl}" alt="${file.name}" />`
        : `<p><a href="${fileUrl}" target="_blank" rel="noopener noreferrer">📎 ${file.name}</a></p>`;

      finishFileImport(content, isImage ? '🖼️' : '📎', file);
    } catch (err) {
      console.error('File import upload failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  // Modular export downloading
  const startFileDownload = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
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

  const handleExportFile = (format: 'md' | 'html' | 'docx' | 'pdf') => {
    if (!activePage) return;
    const nameSlug = activePage.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const processedContent = preprocessExportContent(activePage.content);

    if (format === 'html') {
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');
      
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${activePage.title}</title>
  ${styles}
</head>
<body class="bg-slate-900 text-white min-h-screen">
  <div class="max-w-[816px] w-full min-h-[1056px] mx-auto my-8 p-12 bg-white text-black shadow-lg ring-1 ring-slate-200 prose prose-slate">
    ${activePage.content}
  </div>
</body>
</html>`;
      startFileDownload(htmlContent, `${nameSlug}.html`, 'text/html');
    } else if (format === 'docx') {
        let docxContent = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>${activePage.title}</title></head>
          <body>
        `;
        docxContent += processedContent;
        docxContent += `</body></html>`;
        startFileDownload(docxContent, `${nameSlug}.doc`, 'application/msword');
    } else if (format === 'pdf') {
      try {
        const sourceElement = document.getElementById('editor-content-wrapper');
        if (!sourceElement) throw new Error('Editor content not found');

        // 1. Create an isolated memory clone
        const memoryDiv = document.createElement('div');
        const liveEditor = document.getElementById('editor-content-wrapper');
        if (liveEditor) {
          memoryDiv.innerHTML = liveEditor.innerHTML;
        }

        // 2. Map the true checkbox state and fix the parent lists
        const liveCheckboxes = liveEditor ? liveEditor.querySelectorAll('input[type="checkbox"]') : [];
        const cloneCheckboxes = memoryDiv.querySelectorAll('input[type="checkbox"]');

        cloneCheckboxes.forEach((cb, index) => {
          // Get actual checked state
          const isChecked = liveCheckboxes[index] ? (liveCheckboxes[index] as HTMLInputElement).checked : false;

          // Target the specific <li> holding this checkbox
          const parentLi = cb.closest('li');
          if (parentLi) {
            parentLi.style.listStyleType = 'none'; // Keeps the bullet hidden
            parentLi.style.marginLeft = '0px';     // REMOVED the -24px shift
            parentLi.style.paddingLeft = '0px';    // Ensures it sits flush
          }

          // Replace the input component with plain text
          const textNode = document.createTextNode(isChecked ? '[x] ' : '[ ] ');
          cb.parentNode?.replaceChild(textNode, cb);
        });

        // 3. Extract the cleaned string
        const rawHTML = memoryDiv.innerHTML;

        const finalHTML = `
          <style>
            .pdf-container {
              font-family: system-ui, -apple-system, sans-serif; 
              color: #1a1a1a; 
              background-color: white; 
              padding: 30px 40px 10px 40px; /* Reduced bottom padding to prevent trailing blank pages */
              width: 800px; 
              line-height: 1.6; 
            }
            
            /* Remove any trailing margin or padding from the last child to prevent overflow blank pages */
            .pdf-container > *:last-child {
              margin-bottom: 0 !important;
              padding-bottom: 0 !important;
            }
            
            /* Basic styling for documents */
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

            /* Force html2canvas to respect standard list spacing */
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
            /* Tiptap wraps list text in <p> tags, which causes the massive gap in html2canvas if rendered as blocks */
            li > p {
              display: inline !important; 
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Checklist task lists styling for PDF alignment */
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

            /* PERFECT UNDERLINE ALIGNMENT: Compensates for italic bounding box shifts */
            .pdf-container u, .pdf-container span[style*="underline"] {
              text-decoration: none !important; 
              border-bottom: 2px solid currentColor !important; 
              display: inline-block !important; /* Locks the exact width of the box */
              padding-bottom: 1px !important; /* Tiny gap so it doesn't clip the letters */
              padding-right: 3px !important; /* Extends the line to cover the italic lean */
              line-height: 1 !important;
              vertical-align: baseline !important; /* Keeps the text perfectly level with the list numbers */
            }

            .pdf-hide { display: none !important; }
          </style>
          <div class="pdf-container">${rawHTML}</div>
        `;

        const opt = {
          margin: 0.5,
          filename: 'wiki-export.pdf',
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, logging: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css'] }
        };

        if (typeof (window as any).html2pdf === 'function') {
          (window as any).html2pdf().set(opt).from(finalHTML).save().catch((err: any) => {
            console.error('html2pdf error:', err);
          });
        } else {
          throw new Error('html2pdf not loaded');
        }
      } catch (error) {
        console.error('PDF export failed:', error);
      }
    } else {
      // Reverse-render HTML structures to standard readable Markdown markup
      let markdownText = activePage.content
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<del>(.*?)<\/del>/gi, '~$1~')
        .replace(/<li>(.*?)<\/li>/gi, '- $1')
        .replace(/<\/li>/gi, '')
        .replace(/<ul>/gi, '')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol>/gi, '')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ''); // Sweep away remnants

      startFileDownload(markdownText, `${nameSlug}.md`, 'text/markdown');
    }
  };

  // Helper metrics
  const editorStats = useMemo(() => {
    if (!activePage) return { words: 0, chars: 0, readTime: 1, checklists: 0, headings: 0 };
    const rawText = activePage.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = rawText ? rawText.split(/\s+/).length : 0;
    const chars = rawText.length;
    const readTime = Math.max(1, Math.ceil(words / 220));

    // Calculate checklists count
    const checkboxRows = activePage.content.match(/<input\s+type="checkbox".*?>/gi) || [];
    const checklists = checkboxRows.length;

    // Calculate Headings count
    const headingElements = activePage.content.match(/<h[1-3].*?>/gi) || [];
    const headings = headingElements.length;

    return { words, chars, readTime, checklists, headings };
  }, [activePage]);

  // Request Gemini AI formatting copilot
  const handleAiRefinement = async (presetPrompt: string) => {
    if (!activePage) return;
    setIsAiOpen(true);
    setAiLoading(true);
    setAiResponse('');

    const queryPrompt = `Here is the current HTML content of our wiki page titled "${activePage.title}":
---------
${activePage.content}
---------

User requests this modification or enhancement on the content: "${presetPrompt}".

Task instruction: Perform the modification directly on the HTML document above. Return ONLY the fully modified HTML, preserving standard HTML formatting wrapper classes (meaning retain <h1>, <h2>, <ul>, <p>, <strong>, blockquote inside the editor canvas, and particularly task checklists <ul data-type="taskList"> <li class="task-item"> labels if appropriate). Do not wrap the response in markdown code blocks like \`\`\`html or specify explanations. Output pure HTML.`;

    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryPrompt,
          systemInstruction: aiSystemRole,
        }),
      });

      const data = await response.json();
      if (response.ok && data.text) {
        // Strip out any accidental markdown fence decorators from Gemini
        let refinedResult = data.text.trim();
        if (refinedResult.startsWith('```html')) {
          refinedResult = refinedResult.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
        } else if (refinedResult.startsWith('```')) {
          refinedResult = refinedResult.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        }
        setAiResponse(refinedResult);
      } else {
        setAiResponse(`<p class="text-rose-400">Error: ${data.error || 'Gemini processing failed.'}</p>`);
      }
    } catch (e: any) {
      setAiResponse(`<p class="text-rose-400">Server Error: ${e?.message || 'Failed connecting to server.'}</p>`);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiContent = () => {
    if (!aiResponse) return;
    handleContentChange(aiResponse);
    setAiResponse('');
    setIsAiOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex p-3 md:p-4 gap-3 md:gap-4 overflow-hidden font-sans relative">
      {/* Document save warning/error toast */}
      <AnimatePresence>
        {syncWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg px-4 py-2.5 border text-xs rounded-xl shadow-lg flex items-start gap-2 ${
              syncWarning.level === 'error'
                ? 'bg-slate-900 border-red-500/30 text-red-400'
                : 'bg-slate-900 border-amber-500/30 text-amber-400'
            }`}
          >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span className="font-semibold flex-1">{syncWarning.message}</span>
            <button onClick={clearSyncWarning} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Off-screen/In-screen Sidebar Drawer */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: sidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: isDragging ? 0 : 0.22, ease: 'easeOut' }}
            className="no-print flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden z-20 shadow-xl"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-extrabold text-sm text-white shadow-lg">
                  W
                </div>
                <div>
                  <h1 className="font-extrabold text-xs text-white tracking-wider">ENTERPRISE WIKI</h1>
                  <p className="text-[9px] text-slate-400 font-mono tracking-widest">WORKSPACE CORE</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold uppercase font-mono tracking-wider">
                  LIVE
                </span>
              </div>
            </div>

            {/* Sub-header Controls */}
            {currentUser && (
              <div className="p-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-col gap-2">
                <div className="flex gap-1.5">
                  <button
                    id="sidebar-add-page"
                    type="button"
                    onClick={handleAddPage}
                    className="flex-1 py-1.5 px-1.5 rounded bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] font-bold text-[10px] text-white flex items-center justify-center gap-1 shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={12} /> New Doc
                  </button>

                  <button
                    id="sidebar-import-file"
                    type="button"
                    onClick={triggerImportFile}
                    className="flex-1 py-1.5 px-1.5 bg-slate-800 hover:bg-slate-750 rounded text-[10px] text-slate-200 font-semibold flex items-center justify-center gap-1 border border-slate-750 transition-colors cursor-pointer whitespace-nowrap"
                    title="Import a document (.md/.html) or attach a file (image, PDF, zip, etc.)"
                  >
                    <Upload size={12} /> Import Doc
                  </button>
                  {activePage && (
                    <button
                      id="sidebar-delete-page"
                      type="button"
                      onClick={(e) => handleDeletePage(activePageId, e)}
                      className="flex-1 py-1.5 px-1.5 bg-red-950/40 hover:bg-red-900/30 border border-red-900/40 hover:border-red-500/30 rounded text-[10px] text-red-300 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      title="Delete current wiki document"
                    >
                      <Trash2 size={12} /> Delete Doc
                    </button>
                  )}
                  <input
                    type="file"
                    ref={importInputRef}
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Document Filters */}
            <div className="p-3 border-b border-slate-800/80 flex flex-col gap-2 bg-slate-900/30">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search workspace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Sort Picker */}
              <div className="flex gap-1.5 items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSortBy((prev) => (prev === 'updated' ? 'alpha' : 'updated'))}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded font-semibold text-[10px] text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Toggle sort parameter"
                >
                  <ArrowUpDown size={10} />
                  {sortBy === 'updated' ? 'Recent' : 'A-Z'}
                </button>
              </div>
            </div>

            {/* Directory tree page lists */}
            <LocalSidebar 
              activePageId={activePageId} 
              setActivePageId={handlePageChange} 
              onDeletePage={handleDeletePage} 
              searchQuery={searchQuery}
              sortBy={sortBy}
            />

            {/* User Account / Role Controller Footer */}
            {currentUser && (
              <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="h-6 w-6 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold uppercase text-[10px]">
                      {currentUser.username[0]}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="font-semibold text-slate-200 text-[11px] truncate">{currentUser.username}</span>
                      <span className="text-[9px] text-slate-550 font-mono tracking-wider">{currentUser.role}</span>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="p-1 text-slate-500 hover:text-red-400 font-bold text-[10px] font-mono tracking-wider uppercase bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded cursor-pointer transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Dynamic Resize Handle Divider */}
      {isSidebarOpen && (
        <div
          onMouseDown={() => setIsDragging(true)}
          className={`no-print hidden md:flex group w-2 cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-all duration-150 z-20 relative flex-shrink-0 -mx-2 md:-mx-2.5 justify-center ${
            isDragging ? 'bg-indigo-500/20' : ''
          }`}
          title="Drag to resize sidebar"
        >
          <div className={`w-[2px] h-full ${
            isDragging ? 'bg-indigo-400 font-bold shadow-lg shadow-indigo-500/50' : 'bg-slate-800/80 group-hover:bg-indigo-400'
          } transition-colors`} />
        </div>
      )}

      {/* Modals and Overlays */}
      <AnimatePresence>
        {isNewDocModalOpen && (
          <div className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Create Workspace Document
                </h2>
                <button onClick={() => setIsNewDocModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Document Name</label>
                  <input 
                    type="text" 
                    value={newDocName}
                    onChange={e => setNewDocName(e.target.value)}
                    placeholder="e.g. Q3 Roadmap"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Template (Optional)</label>
                  <select
                    value={newDocTemplateId}
                    onChange={e => setNewDocTemplateId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Blank Document</option>
                    {templates.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-2">
                <button onClick={() => setIsNewDocModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={confirmAddPage} 
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 gap-3 md:gap-4">
        {/* Workspace banner/navigation breadcrumb bar */}
        <header className="no-print h-12 bg-slate-900 border border-slate-800 rounded-2xl px-5 flex items-center justify-between shadow-xl flex-shrink-0">
          {/* Toggle button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-1.5 rounded-lg border border-slate-700/60 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              title={isSidebarOpen ? 'Maximize editing screen' : 'Reveal document directory sidebar'}
            >
              {isSidebarOpen ? (
                <PanelLeftClose size={14} className="text-indigo-400" />
              ) : (
                <PanelLeft size={14} />
              )}
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 font-sans">
              <span className="text-slate-400 font-normal">Workspace</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-100 select-none font-bold truncate max-w-[150px] md:max-w-xs">
                {activePage?.title || 'Unknown Page'}
              </span>
            </div>
          </div>

          {/* Sync status and right actions */}
          <div className="flex items-center gap-3">
            {/* Sync widget */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-[10px] font-mono select-none font-semibold">
              {savingStatus === 'saved' ? (
                <>
                  <Check size={11} className="text-emerald-400 font-extrabold" />
                  <span className="text-emerald-400">All changes saved</span>
                </>
              ) : savingStatus === 'saving' ? (
                <>
                  <Loader2 size={11} className="text-amber-400 animate-spin" />
                  <span className="text-amber-400">Saving...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                  <span className="text-amber-400">Unsaved Changes</span>
                </>
              )}
            </div>

            {currentUser && (currentUser.role === 'ADMIN' || isModerator) && (
              <button 
                type="button"
                onClick={() => {
                  router.push('/admin');
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 border border-slate-700/50 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Admin Panel
              </button>
            )}
            
            <div style={{ position: 'relative' }} className="group">
              <button
                type="button"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors border border-slate-700/50 cursor-pointer relative"
              >
                <Bell className="w-5 h-5" />
                {currentUser && notifications.filter(n => n.userId === currentUser.id && !n.isRead).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-950"></span>
                )}
              </button>
              <div 
                style={{ position: 'absolute', right: 0, top: '100%', paddingTop: '4px', zIndex: 50 }}
                className="w-80 hidden group-hover:block hover:block"
              >
                <div className="rounded-lg bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-96">
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                    <span className="text-sm font-semibold text-slate-200">Notifications</span>
                    {currentUser && notifications.filter(n => n.userId === currentUser.id).length > 0 && (
                      <button 
                        onClick={() => markAllNotificationsAsRead(currentUser.id)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 p-1">
                    {!currentUser || notifications.filter(n => n.userId === currentUser.id).length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
                    ) : (
                      notifications.filter(n => n.userId === currentUser.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((notification) => (
                        <div 
                          key={notification.id}
                          className={`p-3 rounded-md mb-1 last:mb-0 text-sm transition-colors cursor-pointer ${notification.isRead ? 'bg-transparent hover:bg-slate-900/50' : 'bg-slate-800/50 hover:bg-slate-800'}`}
                          onClick={() => {
                            if (!notification.isRead) markNotificationAsRead(notification.id);
                            if (notification.link) {
                              // If link is a document id
                              setActivePageId(notification.link);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`flex-1 ${notification.isRead ? 'text-slate-400' : 'text-slate-200'}`}>
                              {notification.message}
                            </span>
                            {!notification.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(notification.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {currentUser && notifications.filter(n => n.userId === currentUser.id).length > 0 && (
                    <div className="p-2 border-t border-slate-800 bg-slate-900/50">
                      <button 
                        onClick={() => clearNotifications(currentUser.id)}
                        className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Canvas Frame */}
        <div className="flex-1 flex overflow-hidden relative gap-3 md:gap-4 bg-slate-950">
          {activePage ? (
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden gap-3 md:gap-4">
              {/* Document staging core frame */}
              <div className="flex-1 overflow-hidden p-3 md:p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
                {/* Active page controls section */}
                <div className="no-print flex flex-col gap-1.5 py-1.5 px-3 bg-slate-950/50 border border-slate-800/80 rounded-xl">
                  <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
                    {/* Document title textbox input */}
                    <div className="flex items-center gap-3 flex-1 w-full">
                      <input
                        type="text"
                        value={activePage.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        disabled={isEffectiveReadOnly}
                        className="text-lg font-bold text-white bg-transparent border-b border-transparent focus:border-indigo-500 py-0.5 px-1 focus:outline-none flex-1 font-sans placeholder-slate-650 w-full disabled:opacity-80 disabled:cursor-default"
                        placeholder="Document title..."
                        title={isEffectiveReadOnly ? "Document title" : "Edit active document title"}
                      />
                    </div>

                    {/* Advanced Document Share Trigger */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-md h-8 select-none">
                        <button 
                          type="button" 
                          onClick={handleZoomOut}
                          className="px-2.5 h-full text-slate-400 hover:text-white hover:bg-slate-700 rounded-l-md transition-colors cursor-pointer flex items-center justify-center"
                          title="Zoom Out"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        
                        <button 
                          type="button"
                          onClick={resetZoom}
                          className="px-2 h-full text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border-x border-slate-700 transition-colors cursor-pointer flex items-center justify-center min-w-[50px]"
                          title="Reset to 100%"
                        >
                          {zoomLevel}%
                        </button>

                        <button 
                          type="button" 
                          onClick={handleZoomIn}
                          className="px-2.5 h-full text-slate-400 hover:text-white hover:bg-slate-700 rounded-r-md transition-colors cursor-pointer flex items-center justify-center"
                          title="Zoom In"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                      </div>


                      {/* Export Button / Menu */}
                      <div style={{ position: 'relative' }} className="group">
                        <button
                          type="button"
                          className="px-2 py-1 h-8 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-750 font-semibold text-xs text-white flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download size={11} /> Export
                        </button>

                        <div 
                          style={{ position: 'absolute', right: 0, top: '100%', paddingTop: '4px', zIndex: 50 }}
                          className="w-32 hidden group-hover:block hover:block"
                        >
                          <div className="rounded-lg bg-slate-950 border border-slate-850 shadow-2xl py-1">
                            <button
                              type="button"
                              onClick={() => handleExportFile('md')}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <FileDown size={11} /> Markdown (.md)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportFile('html')}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <FileDown size={11} /> Pure HTML (.html)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportFile('docx')}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <FileDown size={11} /> Word (.docx)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportFile('pdf')}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <FileDown size={11} /> PDF (.pdf)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Save Version Button */}
                      {(currentUser?.role === 'ADMIN' || canUserEdit(currentUser?.id, activePage)) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!activePage) return;
                            
                            const editor = editorRef.current?.editor;
                            const contentToSave = editor ? editor.getHTML() : activePage.content;
                            
                            showPromptModal({
                              title: "Save Document Version",
                              message: "Enter a brief descriptive label/name for this saved version (optional):",
                              defaultValue: `Version ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                              placeholder: "e.g., Draft 1, Before formatting edits",
                              confirmLabel: "Save Version",
                              cancelLabel: "Cancel",
                              oldHtml: activePage.content || "<p>Previous version content...</p>",
                              newHtml: contentToSave || "<p>Current editor content...</p>",
                              onConfirm: (versionName) => {
                                setSavingStatus('saving');
                                const { saveVersion } = useWikiStore.getState();
                                saveVersion(activePage.id, contentToSave, currentUser?.id || '', versionName);
                                setHasUnsavedChanges(false);
                                setSavingStatus('saved');
                              }
                            });
                          }}
                          className="px-2 py-1 h-8 rounded-md border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300"
                          title="Save as a new version in History"
                        >
                          <Save size={11} />
                          <span>Save</span>
                        </button>
                      )}

                      {/* History Button */}
                      <button
                        type="button"
                        onClick={() => setIsHistoryOpen(true)}
                        className={`px-2 py-1 h-8 rounded-md border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          isHistoryOpen ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Clock size={11} />
                        <span>History</span>
                      </button>

                      {/* Comments Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCommentsOpen(!isCommentsOpen);
                          setIsHistoryOpen(false);
                          setIsAiOpen(false);
                        }}
                        className={`px-2 py-1 h-8 rounded-md border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          isCommentsOpen ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
                        }`}
                      >
                        <BookOpen size={11} />
                        <span>Comments</span>
                      </button>

                      {/* Private Status Badge / Button */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsShareModalOpen(true);
                        }}
                        className="flex items-center justify-center rounded-md border transition-all select-none cursor-pointer hover:opacity-80 active:scale-95 px-2 py-1 h-8 text-xs ml-auto sm:ml-0"
                        style={{
                          backgroundColor: visibility === 'private' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: visibility === 'private' ? 'rgb(251, 146, 60)' : 'rgb(74, 222, 128)',
                          borderColor: visibility === 'private' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(34, 197, 94, 0.2)'
                        }}
                        title={visibility === 'private' ? "Private" : "Public"}
                      >
                        {visibility === 'private' ? (
                          <Lock size={14} className="pointer-events-none" />
                        ) : (
                          <Unlock size={14} className="pointer-events-none" />
                        )}
                      </button>

                      {/* Interactive Editor Button */}
                      {(currentUser?.role === 'ADMIN' || canUserEdit(currentUser?.id, activePage)) ? (
                        <button
                          type="button"
                          title={isReadOnly ? "Switch to Edit Mode" : "Switch to View Mode"}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!isReadOnly && hasUnsavedChanges && activePage) {
                              showConfirmModal({
                                title: "Unsaved Changes",
                                message: "You have unsaved changes in this document. Would you like to save your changes as a version before leaving Edit Mode?",
                                confirmLabel: "Save & Exit",
                                cancelLabel: "Cancel",
                                alternativeLabel: "Discard & Exit",
                                onConfirm: () => {
                                  const editorInstance = editorRef.current?.editor;
                                  const contentToSave = editorInstance ? editorInstance.getHTML() : activePage.content;
                                  showPromptModal({
                                    title: "Save Document Version",
                                    message: "Enter a brief descriptive label/name for this saved version (optional):",
                                    defaultValue: `Version ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                                    placeholder: "e.g., Draft 1",
                                    confirmLabel: "Save & Exit",
                                    cancelLabel: "Cancel",
                                    oldHtml: activePage.content || "<p>Previous version content...</p>",
                                    newHtml: contentToSave || "<p>Current editor content...</p>",
                                    onConfirm: (versionName) => {
                                      setSavingStatus('saving');
                                      const { saveVersion } = useWikiStore.getState();
                                      saveVersion(activePage.id, contentToSave, currentUser?.id || '', versionName);
                                      setHasUnsavedChanges(false);
                                      setSavingStatus('saved');
                                      
                                      const newState = !isReadOnly;
                                      setIsReadOnly(newState);
                                      if (editorInstance) {
                                        editorInstance.setEditable(!newState);
                                      }
                                    }
                                  });
                                },
                                onAlternative: () => {
                                  const editorInstance = editorRef.current?.editor;
                                  if (editorInstance) {
                                    editorInstance.commands.setContent(activePage.content || '<p></p>', { emitUpdate: false });
                                  }
                                  setHasUnsavedChanges(false);
                                  setSavingStatus('saved');
                                  
                                  const newState = !isReadOnly;
                                  setIsReadOnly(newState);
                                  if (editorInstance) {
                                    editorInstance.setEditable(!newState);
                                  }
                                }
                              });
                            } else {
                              const newState = !isReadOnly;
                              setIsReadOnly(newState);
                              const editorInstance = editorRef.current?.editor;
                              if (editorInstance) {
                                editorInstance.setEditable(!newState); // This physically locks/unlocks the Tiptap canvas
                              }
                            }
                          }}
                          className="flex items-center justify-center p-[7px] ml-1 rounded-md border border-slate-600/50 hover:bg-slate-700 transition-colors"
                        >
                          {isReadOnly ? (
                            /* EYE ICON (VIEW MODE) with ORANGE color */
                            <svg className="text-orange-400 hover:text-orange-300" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          ) : (
                            /* PENCIL ICON (EDIT MODE) with GREEN color */
                            <svg className="text-green-400 hover:text-green-300" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          )}
                        </button>
                      ) : (
                        <div className="px-2 py-1 h-8 rounded-md text-xs font-semibold flex items-center gap-1 border bg-slate-950 border-slate-850 text-slate-400 select-none">
                          <Eye size={11} className="text-slate-500" />
                          <span>Read-only Mode</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Tiptap layout window */}
                <div className="flex-grow flex-1 min-h-0 w-full flex flex-col relative overflow-visible">
                  <WikiEditor
                    ref={editorRef}
                    content={activePage.content}
                    onChange={handleContentChange}
                    readOnly={isEffectiveReadOnly}
                    activeDocument={activePage}
                    zoomLevel={zoomLevel}
                    mentionableUsers={mentionableUsers}
                  />

                  {/* AI Quick format accelerator button overlay for fast context editing */}
                  {!isEffectiveReadOnly && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIsAiOpen((prev) => !prev)}
                      type="button"
                      className="no-print absolute bottom-4 right-4 z-25 py-2.5 px-4 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 flex items-center gap-2 hover:opacity-95 font-bold text-xs text-white shadow-xl cursor-pointer"
                    >
                      <Sparkles size={14} className="animate-pulse text-purple-200" />
                      AI Formatting Copilot
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Table Of Contents side-nav */}
              {isTocOpen && (
                <TableOfContents content={activePage.content} />
              )}

              {/* Collapsed/Expanded Gemini AI Format Panel on the Right */}
              <AnimatePresence>
                {isHistoryOpen && (
                  <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="no-print flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl"
                  >
                    <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-indigo-400" />
                        <h2 className="font-extrabold text-xs text-white uppercase tracking-wider">Version History</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsHistoryOpen(false)}
                        className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {(activePage.history || []).length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No saved versions.</p>
                      ) : (
                        (activePage.history || []).map((v: any) => {
                          const authorUser = (users || []).find((u: any) => u.username === v.authorId || u.id === v.authorId || u.email === v.authorId);
                          const authorDisplayName = authorUser ? authorUser.username : (v.authorId || 'Unknown User');
                          const authorRole = authorUser ? authorUser.role : '';
                          const authorAvatar = authorUser?.profilePic;

                          const dateObj = new Date(v.timestamp);
                          const formattedDate = dateObj.toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          });
                          const formattedTime = dateObj.toLocaleTimeString(undefined, { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          });

                          return (
                            <div key={v.versionId} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-3 hover:border-slate-700/50 transition-all">
                              {/* Header: Version Name & Action badge */}
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-bold text-slate-100 line-clamp-2">{v.name || 'Saved Version'}</span>
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono shrink-0">
                                  {v.versionId.substring(0, 7)}
                                </span>
                              </div>

                              {/* Saved By (User) Info */}
                              <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded border border-slate-800/30">
                                {authorAvatar ? (
                                  <img 
                                    src={authorAvatar} 
                                    alt={authorDisplayName} 
                                    className="w-5 h-5 rounded-full object-cover border border-slate-700"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                    <User size={10} className="text-slate-400" />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-semibold text-slate-300 truncate">
                                    {authorDisplayName}
                                  </span>
                                  {authorRole && (
                                    <span className="text-[8px] text-slate-500 uppercase font-semibold tracking-wider">
                                      {authorRole}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Date and Time info */}
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                                <div className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1 rounded border border-slate-800/30">
                                  <Calendar size={11} className="text-slate-500 shrink-0" />
                                  <span className="truncate">{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-900/40 px-2 py-1 rounded border border-slate-800/30">
                                  <Clock size={11} className="text-slate-500 shrink-0" />
                                  <span className="truncate">{formattedTime}</span>
                                </div>
                              </div>
                              
                              {/* Content Preview */}
                              <div className="text-[10px] text-slate-400 italic truncate px-2 py-1 bg-slate-900 rounded border border-slate-800/50">
                                {v.content.replace(/<[^>]+>/g, '').substring(0, 50) || 'Empty document...'}
                              </div>

                              <button 
                                type="button"
                                className="w-full mt-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer font-medium text-[11px] transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  showConfirmModal({
                                    title: "Restore Document Version?",
                                    message: `WARNING: Restoring '${v.name || 'this version'}' will overwrite your current document. Unsaved changes will be lost. Proceed?`,
                                    confirmLabel: "Restore",
                                    cancelLabel: "Cancel",
                                    onConfirm: () => {
                                      try {
                                        const versionContent = v.content; 
                                        const editor = editorRef.current?.editor;

                                        if (editor) {
                                          editor.commands.setContent(versionContent);
                                        } else {
                                          console.error("Editor instance not found");
                                        }
                                        
                                        const { restoreVersion } = useWikiStore.getState();
                                        restoreVersion(activePage.id, v.versionId);
                                        
                                        setHasUnsavedChanges(false);
                                        setSavingStatus('saved');
                                      } catch (error) {
                                        console.error("Failed to restore version:", error);
                                      }
                                    }
                                  });
                                }}
                              >
                                Restore Version
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.aside>
                )}

                {isCommentsOpen && (
                  <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="no-print flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl"
                  >
                    <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-amber-400" />
                        <h2 className="font-extrabold text-xs text-white uppercase tracking-wider">Comments</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCommentsOpen(false)}
                        className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {(activePage.comments || []).length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No comments yet.</p>
                      ) : (
                        (activePage.comments || []).map((c: any) => (
                          <div key={c.commentId} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold">{c.authorId}</span>
                              <span className="text-[9px] text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 bg-slate-900 p-2 border border-slate-800 rounded">{c.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-3 border-t border-slate-800 flex flex-col gap-2 bg-slate-950">
                      <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full h-20 p-2 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                      />
                      <button
                        onClick={() => {
                          if (!newCommentText.trim()) return;
                          const { addComment } = useWikiStore.getState();
                          addComment(activePage.id, newCommentText, currentUser?.id || '', '');
                          setNewCommentText('');
                        }}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded transition-colors"
                      >
                        Post Comment
                      </button>
                    </div>
                  </motion.aside>
                )}

                {isAiOpen && (
                  <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="no-print flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl"
                  >
                    <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-400 animate-pulse" />
                        <h2 className="font-extrabold text-xs text-white uppercase tracking-wider">AI Format Copilot</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAiOpen(false)}
                        className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                        title="Dismiss copilot"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* System instructions configuration parameters info box */}
                      <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10 flex gap-2.5">
                        <Info size={14} className="text-purple-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-gray-400 space-y-1">
                          <p className="font-semibold text-gray-200">State Preserving Editor</p>
                          <p>
                            Gemini processes the raw document canvas structure to enrich contents while strictly safeguarding isolated color formatting layers.
                          </p>
                        </div>
                      </div>

                      {/* Selected context shortcuts */}
                      <div className="text-xs space-y-2">
                        <h3 className="text-gray-400 font-bold uppercase tracking-wider text-[10px] select-none">
                          Quick Presets Actions
                        </h3>
                        <div className="grid grid-cols-2 gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={() =>
                              handleAiRefinement(
                                'Improve grammar and polish the existing copy, return fully structured rich HTML style layout'
                              )
                            }
                            disabled={aiLoading}
                            className="p-2 rounded bg-[#1c1d27] border border-gray-800 text-[11px] text-gray-300 hover:text-white hover:border-gray-700 transition-colors text-left cursor-pointer disabled:opacity-50"
                          >
                            🪄 Polish Grammar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAiRefinement(
                                'Summarize the core specifications in elegant blockquote headers, concluding with a task checker list of actionable steps'
                              )
                            }
                            disabled={aiLoading}
                            className="p-2 rounded bg-[#1c1d27] border border-gray-800 text-[11px] text-gray-300 hover:text-white hover:border-gray-700 transition-colors text-left cursor-pointer disabled:opacity-50"
                          >
                            📝 Summarize & List
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAiRefinement(
                                'Convert major milestones or lists in this page to interactive checkbox list items (data-type="taskList") exactly'
                              )
                            }
                            disabled={aiLoading}
                            className="p-2 rounded bg-[#1c1d27] border border-gray-800 text-[11px] text-gray-300 hover:text-white hover:border-gray-700 transition-colors text-left cursor-pointer disabled:opacity-50"
                          >
                            ✅ Convert to Checklists
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAiRefinement(
                                'Translate technical descriptions and terms into simplified product milestones for broad audiences'
                              )
                            }
                            disabled={aiLoading}
                            className="p-2 rounded bg-[#1c1d27] border border-gray-800 text-[11px] text-gray-300 hover:text-white hover:border-gray-700 transition-colors text-left cursor-pointer disabled:opacity-50"
                          >
                            💡 Simplify Terms
                          </button>
                        </div>
                      </div>

                      {/* Custom input prompts text block */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                          Custom Translation Or Directive
                        </label>
                        <textarea
                          placeholder="e.g.: Add a detailed section on core milestones, ending with a checklist of tests..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          disabled={aiLoading}
                          className="w-full h-24 p-2 bg-[#12131b] border border-[#232433] rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleAiRefinement(aiPrompt)}
                          disabled={aiLoading || !aiPrompt.trim()}
                          className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-55 cursor-pointer"
                        >
                          {aiLoading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Synthesizing...
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} /> Run AI Generation
                            </>
                          )}
                        </button>
                      </div>

                      {/* Output section */}
                      {aiLoading && (
                        <div className="p-10 text-center space-y-3">
                          <Loader2 size={24} className="mx-auto text-purple-400 animate-spin" />
                          <p className="text-[11px] text-gray-400 font-mono">Analyzing document nodes...</p>
                        </div>
                      )}

                      {!aiLoading && aiResponse && (
                        <div className="space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                              Generated Content Preview
                            </h4>
                            <button
                              type="button"
                              onClick={() => setAiResponse('')}
                              className="text-[10px] text-gray-500 hover:text-white font-mono"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="p-3 rounded-lg bg-[#0a0a0e] border border-purple-500/20 max-h-52 overflow-y-auto text-xs prose prose-invert">
                            {/* Simple visual rendering raw preview of parsed text inside */}
                            <div
                              dangerouslySetInnerHTML={{ __html: aiResponse }}
                              className="space-y-1 text-gray-300"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={applyAiContent}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-xs text-white cursor-pointer"
                            >
                              Apply to Document
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(aiResponse);
                                alert('Copied to clipboard!');
                              }}
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded font-semibold text-xs text-gray-300 hover:text-white cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer author selection */}
                    <div className="p-3 border-t border-[#1f202c] text-center bg-[#07080a]">
                      <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest block">
                        Enterprise AI Assistant Engine
                      </span>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <BookOpen className="text-gray-700 mb-2 animate-pulse" size={40} />
              <h3 className="text-sm font-bold text-gray-400">No Document Selected</h3>
              <p className="text-xs text-gray-600 mt-1">Pick or create a page in the sidebar catalog to begin.</p>
            </div>
          )}
        </div>
      </main>

      {/* Advanced Sharing Configuration Modal overlay */}
      {activePage && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          document={activePage}
          visibility={visibility}
          setVisibility={setVisibility}
        />
      )}

      {/* Universal Destruction Consent Guard */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={documentToDelete?.title || ''}
      />

      <BulkExportModal
        isOpen={isBulkExportModalOpen}
        onClose={() => setIsBulkExportModalOpen(false)}
      />

      {/* Custom Prompt Modal for sandbox-blocked iframe environments */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 select-none">
          <div className="bg-[#1e2230] w-[800px] max-w-[90vw] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-5 border-b border-slate-700/50 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              <h2 className="text-lg font-bold text-white">{promptModal.title}</h2>
            </div>
            
            <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm text-slate-300 mb-2">{promptModal.message}</label>
                <input 
                  type="text"
                  value={promptInputValue}
                  onChange={(e) => setPromptInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      promptModal.onConfirm(promptInputValue);
                    }
                  }}
                  className="w-full bg-[#0f111a] border border-indigo-500/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder={promptModal.placeholder}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-slate-300">Review Changes:</label>
                <div className="bg-white rounded-lg p-1 overflow-hidden border border-slate-200">
                  <DocumentDiffViewer 
                    oldHtml={promptModal.oldHtml || "<p>Previous version content...</p>"} 
                    newHtml={promptModal.newHtml || "<p>Current editor content...</p>"} 
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-[#151822] border-t border-slate-700 flex justify-end gap-3">
               <button 
                 type="button"
                 onClick={() => {
                   if (promptModal.onCancel) promptModal.onCancel();
                   setPromptModal(prev => ({ ...prev, isOpen: false }));
                 }}
                 className="px-5 py-2.5 bg-transparent hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium border border-slate-600 transition-colors"
               >
                 {promptModal.cancelLabel}
               </button>
               <button 
                 type="button"
                 onClick={() => promptModal.onConfirm(promptInputValue)}
                 className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-colors"
               >
                 {promptModal.confirmLabel}
               </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Custom Confirm/Alternative Modal for sandbox-blocked iframe environments */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-amber-500" />
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">{confirmModal.message}</p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.onCancel) confirmModal.onCancel();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-850 transition-colors cursor-pointer"
                >
                  {confirmModal.cancelLabel}
                </button>
                
                {confirmModal.alternativeLabel && confirmModal.onAlternative && (
                  <button
                    type="button"
                    onClick={confirmModal.onAlternative}
                    className="px-3 py-1.5 rounded-lg border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-950/40 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {confirmModal.alternativeLabel}
                  </button>
                )}

                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal Overlay */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-slate-50 w-[800px] max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-300">
            
            <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Document History (Revision Diff)</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-800 font-bold p-1 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              {/* Mock data injected to test the inline highlight UI */}
              <DocumentDiffViewer
                oldHtml="<p>The company Little Snow Flakes was founded recently.</p><p>We sell sport brands.</p>"
                newHtml="<p>The company Little Snow Flakes Limited was founded recently.</p><p>We are the official distributor for Legea and Volchem.</p>"
              />
            </div>
            
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
               <button 
                 onClick={() => setIsHistoryOpen(false)} 
                 className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm font-medium transition-colors"
               >
                 Restore this Version
               </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
