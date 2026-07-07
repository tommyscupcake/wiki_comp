'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import TypographyDropdown from './TypographyDropdown';
import {
  ChevronDown,
  Minus,
  Plus,
  Palette,
  Type,
  ListTodo,
  List as ListIcon,
  ListOrdered,
  Quote,
  Code,
  MinusSquare,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
} from 'lucide-react';

import { WikiDocument, useWikiStore } from '@/lib/store';

interface EditorToolbarProps {
  editor: Editor | null;
  activeDocument?: WikiDocument | null;
}

const FONTS = [
  { name: 'Default', value: 'ui-sans-serif, system-ui, sans-serif' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Courier New', value: 'Courier New, monospace' },
];

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
];

const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<Blob | File> => {
  return new Promise((resolve) => {
    // Only compress actual images
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions preserving aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function EditorToolbar({ editor, activeDocument }: EditorToolbarProps) {
  const [isFontOpen, setIsFontOpen] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [isLinkPromptOpen, setIsLinkPromptOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');

  const fontRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const virtualFileSystem = useWikiStore((state) => state.virtualFileSystem);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    // Compress image client-side to ensure it is lightweight and uploads fast!
    let uploadBlob: Blob | File = file;
    try {
      uploadBlob = await compressImage(file);
    } catch (e) {
      console.warn("Compression failed, uploading original file", e);
    }

    const teams = virtualFileSystem?.["teams.json"] || [];
    const teamCollab = activeDocument?.teamCollaborators?.[0];
    const team = teams.find((t: any) => t.id === teamCollab?.teamId);

    const teamId = team?.id || 'workspace';
    const teamName = team?.name || 'Workspace';
    const wikiId = activeDocument?.id || 'general';
    const wikiTitle = activeDocument?.title || 'General';

    const formData = new FormData();
    const fileName = file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.webp')
      ? file.name
      : `${file.name}.jpg`;
    formData.append('file', uploadBlob, fileName);
    formData.append('teamId', teamId);
    formData.append('teamName', teamName);
    formData.append('wikiId', wikiId);
    formData.append('wikiTitle', wikiTitle);

    try {
      // AI INSTRUCTION: Verify the correct upload API route path for this specific project. Defaulting to /api/upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errMsg = 'Upload failed';
        try {
          const errText = await response.text();
          if (errText.trim().startsWith('{')) {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errJson.message || errMsg;
          } else if (errText.trim().startsWith('<')) {
            errMsg = `Upload failed with status ${response.status}. The file may be too large.`;
          } else {
            errMsg = `Upload failed with status ${response.status}: ${errText.substring(0, 100)}`;
          }
        } catch (e) {
          errMsg = `Upload failed with status ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const resText = await response.text();
      if (!resText.trim().startsWith('{')) {
        throw new Error(`The server returned an unexpected response instead of JSON. First 250 chars: ${resText.trim().substring(0, 250)}`);
      }

      const data = JSON.parse(resText);
      const imageUrl = data.url; // Ensure this matches your API's response structure

      // 2. Insert the actual URL into Tiptap, NOT a Base64 string
      editor.chain().focus().setImage({ src: imageUrl }).run();

    } catch (error: any) {
      console.warn("Image upload to server failed, falling back to local compressed base64:", error);
      // Self-healing fallback: read the compressed uploadBlob as a local Data URL
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (editor) {
            editor.chain().focus().setImage({ src: base64data }).run();
          }
        };
        reader.readAsDataURL(uploadBlob);
      } catch (fallbackError) {
        console.error("Local fallback failed too:", fallbackError);
        alert(error?.message || "Failed to upload image.");
      }
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  // Force update when editor changes selections or updates content
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setTick((t) => t + 1);
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  // Close dropdowns on outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontRef.current && !fontRef.current.contains(event.target as Node)) {
        setIsFontOpen(false);
      }
      if (colorRef.current && !colorRef.current.contains(event.target as Node)) {
        setIsColorOpen(false);
      }
      if (sizeRef.current && !sizeRef.current.contains(event.target as Node)) {
        setIsSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!editor) {
    // Return a deactivated skeleton toolbar matching exact spacing to prevent client layout shift
    return (
      <div id="editor-toolbar-skeleton" className="flex items-center w-full flex-wrap gap-1.5 py-1.5 px-3 bg-[#1e293b] border-b border-slate-700/80 rounded-t-xl overflow-visible select-none pointer-events-none opacity-50">
        <div className="w-7 h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-7 h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <div className="w-22 h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-[110px] h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <div className="w-22 h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <div className="w-7 h-7 rounded bg-slate-700 animate-pulse" />
        <div className="w-7 h-7 rounded bg-slate-700 animate-pulse" />
      </div>
    );
  }

  // Find active settings
  const currentFontValue = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontName = FONTS.find((f) => f.value === currentFontValue)?.name || 'Default';
  const currentFontSizeStr = editor.getAttributes('textStyle').fontSize || '16px';
  const currentFontSize = parseInt(currentFontSizeStr.replace('px', ''), 10) || 16;
  const currentColor = editor.getAttributes('textStyle').color || '#000000';

  const isTaskListActive = (() => {
    if (!editor) return false;
    if (editor.isActive('taskList') || editor.isActive('taskItem')) {
      return true;
    }
    const { state } = editor;
    if (!state) return false;
    const { selection } = state;
    let hasTaskNode = false;
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.type.name === 'taskList' || node.type.name === 'taskItem') {
        hasTaskNode = true;
      }
    });
    return hasTaskNode;
  })();

  const setFontSize = (size: number) => {
    if (isTaskListActive) return;
    const clampedSize = Math.max(8, Math.min(120, size));
    const sizeStr = `${clampedSize}px`;

    // Apply inline text size
    editor.chain().focus().setMark('textStyle', { fontSize: sizeStr }).run();

    // Traverse AST to force parent <li> blocks to inherit the size
    const { state, view } = editor;
    const { tr, selection } = state;
    let modified = false;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, fontSize: sizeStr });
        modified = true;
      }
    });

    if (selection.empty) {
      for (let i = selection.$from.depth; i > 0; i--) {
        const node = selection.$from.node(i);
        if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
          const pos = selection.$from.before(i);
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, fontSize: sizeStr });
          modified = true;
        }
      }
    }

    if (modified) {
      view.dispatch(tr);
    }
  };

  const handleFontSizeChange = (direction: 'up' | 'down') => {
    const change = direction === 'up' ? 1 : -1;
    setFontSize(currentFontSize + change);
  };

  return (
    <div
      id="editor-toolbar"
      className="flex items-center w-full flex-wrap gap-1.5 py-1.5 px-3 bg-slate-800 border-b border-slate-700 rounded-t-2xl overflow-visible select-none z-30 relative"
      onMouseDown={(e) => {
        // Prevent clicking inside vacant areas of the toolbar from stealing editor focus
        const target = e.target as HTMLElement;
        if (target.id === 'editor-toolbar' || target.classList.contains('group-divider')) {
          e.preventDefault();
        }
      }}
    >
      {/* Group: Typography & Font Family Custom HTML Dropdowns */}
      <div className="flex items-center gap-1.5">
        {/* Typography Custom Dropdown */}
        <TypographyDropdown editor={editor} />

        {/* Font Family Select */}
        <div ref={fontRef} className="relative z-40">
          <button
            id="toolbar-font-select"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsFontOpen(!isFontOpen);
              setIsColorOpen(false);
              setIsSizeOpen(false);
            }}
            className="px-2 py-1.5 rounded-md bg-slate-900 hover:bg-slate-750 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center justify-between gap-1 cursor-pointer min-w-[110px]"
          >
            <span className="truncate flex items-center gap-1">
              <Type size={12} className="text-slate-400" />
              {currentFontName}
            </span>
            <ChevronDown size={11} className={`text-slate-400 transition-transform ${isFontOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFontOpen && (
            <ul
              id="toolbar-font-menu"
              className="absolute left-0 mt-1 w-48 rounded-lg bg-slate-950 border border-slate-800 shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto list-none m-0 p-0 z-50"
            >
              {FONTS.map((font) => {
                const isSelected = currentFontValue === font.value;
                return (
                  <li key={font.name} className="list-none m-0 p-0">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (font.name === 'Default') {
                          editor.chain().unsetFontFamily().focus().run();
                        } else {
                          editor.chain().setFontFamily(font.value).focus().run();
                        }
                        setIsFontOpen(false);
                      }}
                      style={{ fontFamily: font.value }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-indigo-600 hover:text-white block ${
                        isSelected ? 'text-indigo-400 bg-slate-900 font-semibold' : 'text-slate-200'
                      }`}
                    >
                      {font.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Font Size (Minus, custom input dropdown, Plus) */}
      <div className="flex items-center gap-1 bg-slate-900 px-1 py-0.5 rounded-lg border border-slate-700/60">
        <button
          id="toolbar-fontsize-dec"
          type="button"
          disabled={isTaskListActive}
          onMouseDown={(e) => {
            if (isTaskListActive) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            handleFontSizeChange('down');
          }}
          className={`p-1 rounded text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer ${isTaskListActive ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          title="Decrease font size"
        >
          <Minus size={13} />
        </button>

        <div ref={sizeRef} className="relative z-40">
          <button
            id="toolbar-size-select"
            type="button"
            disabled={isTaskListActive}
            onMouseDown={(e) => {
              if (isTaskListActive) {
                e.preventDefault();
                return;
              }
              e.preventDefault();
              setIsSizeOpen(!isSizeOpen);
              setIsFontOpen(false);
              setIsColorOpen(false);
            }}
            className={`px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer min-w-[50px] justify-center ${isTaskListActive ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            title="Select Font Size"
          >
            <span>{currentFontSize}</span>
            <ChevronDown size={10} className={`text-slate-400 transition-transform ${isSizeOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSizeOpen && (
            <ul
              id="toolbar-size-menu"
              className="absolute left-1/2 -translate-x-1/2 mt-2 w-20 rounded-lg bg-slate-950 border border-slate-800 shadow-xl overflow-y-auto py-1 max-h-40 z-50 list-none m-0 p-0"
            >
              {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map((sz) => {
                const isSelected = currentFontSize === sz;
                return (
                  <li key={sz} className="list-none m-0 p-0">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        if (isTaskListActive) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        setFontSize(sz);
                        setIsSizeOpen(false);
                      }}
                      className={`w-full text-center px-1 py-1 text-xs transition-colors hover:bg-indigo-600 hover:text-white block ${
                        isSelected ? 'text-indigo-400 bg-slate-900 font-bold' : 'text-slate-200'
                      }`}
                    >
                      {sz}px
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          id="toolbar-fontsize-inc"
          type="button"
          disabled={isTaskListActive}
          onMouseDown={(e) => {
            if (isTaskListActive) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            handleFontSizeChange('up');
          }}
          className={`p-1 rounded text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer ${isTaskListActive ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          title="Increase font size"
        >
          <Plus size={13} />
        </button>
      </div>

        <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Color picker (Dropdown with palette + custom native colors) */}
      <div ref={colorRef} className="relative z-40">
        <button
          id="toolbar-color"
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsColorOpen(!isColorOpen);
            setIsFontOpen(false);
            setIsSizeOpen(false);
          }}
          className="flex items-center gap-1 p-1 rounded-md border border-transparent hover:bg-slate-700 text-slate-200 hover:text-white cursor-pointer"
          title="Text Color"
        >
          <Palette size={14} />
          <span
            className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0"
            style={{ backgroundColor: currentColor }}
          />
        </button>

        {isColorOpen && (
          <div
            id="toolbar-color-palette"
            className="absolute left-0 mt-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800 shadow-xl w-[208px] flex flex-col gap-2"
          >
            {/* Color grid */}
            <div className="grid grid-cols-8 gap-1">
              {PRESET_COLORS.map((color) => {
                const isActive = currentColor.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor.chain().setColor(color).focus().run();
                      setIsColorOpen(false);
                    }}
                    style={{ backgroundColor: color }}
                    className={`w-4 h-4 rounded-sm border hover:scale-110 transition-transform ${
                      isActive ? 'border-indigo-400 scale-105 circle shadow-md' : 'border-slate-900/40'
                    }`}
                    title={color}
                  />
                );
              })}
            </div>

            {/* Clear & Custom custom wrapper */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().unsetColor().focus().run();
                  setIsColorOpen(false);
                }}
                className="text-[10px] text-slate-400 hover:text-white font-semibold flex items-center"
              >
                Clear Styling
              </button>

              <label
                onMouseDown={(e) => {
                  // Allow clicking label to trigger native input but prevent editor focus steal
                }}
                className="flex items-center gap-1 cursor-pointer"
              >
                <span className="text-[10px] text-slate-300 hover:text-white font-medium">Custom</span>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => {
                    editor.chain().setColor(e.target.value).focus().run();
                  }}
                  className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Formatting (Bold, Italic, Underline) */}
      <div className="flex items-center gap-1">
        <button
          id="toolbar-format-bold"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleBold().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('bold')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Bold"
        >
          <Bold size={15} />
        </button>

        <button
          id="toolbar-format-italic"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleItalic().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('italic')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Italic"
        >
          <Italic size={15} />
        </button>

        <button
          id="toolbar-format-underline"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleUnderline().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('underline')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Underline"
        >
          <UnderlineIcon size={15} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Alignment (Left, Center, Right, Justify) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().setTextAlign('left').run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive({ textAlign: 'left' })
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Align Left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().setTextAlign('center').run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive({ textAlign: 'center' })
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Align Center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().setTextAlign('right').run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive({ textAlign: 'right' })
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Align Right"
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().setTextAlign('justify').run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Align Justify"
        >
          <AlignJustify size={15} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Lists (Todo/Task list, Bullet list, Ordered list) */}
      <div className="flex items-center gap-1">
        <button
          id="toolbar-list-todo"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleTaskList().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('taskList')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Task Checklist"
        >
          <ListTodo size={15} />
        </button>

        <button
          id="toolbar-list-bullet"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleBulletList().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('bulletList')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Bullet List"
        >
          <ListIcon size={15} />
        </button>

        <button
          id="toolbar-list-ordered"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={`p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
            editor.isActive('orderedList')
              ? 'bg-indigo-500/25 text-indigo-400 border border-indigo-500/25'
              : 'text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent'
          }`}
          title="Numbered List"
        >
          <ListOrdered size={15} />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1.5 group-divider" />

      {/* Group: Structure Macros */}
      <div className="flex items-center gap-1">
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const previousUrl = editor.getAttributes('link').href;
              setLinkInput(previousUrl || '');
              setIsLinkPromptOpen(!isLinkPromptOpen);
            }}
            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${editor.isActive('link') ? 'bg-slate-700 text-white' : 'text-slate-300'}`}
            title="Insert Link"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>

          {/* CUSTOM LINK POPUP */}
          {isLinkPromptOpen && (
            <div className="absolute top-full mt-2 left-0 z-50 p-2 bg-slate-800 border border-slate-600 rounded-md shadow-xl flex gap-2 w-64">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    let finalUrl = linkInput.trim();
                    
                    if (finalUrl === '') {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    } else {
                      // Auto-prepend https:// if missing (and ignore mailto:)
                      if (!/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl)) {
                        finalUrl = `https://${finalUrl}`;
                      }
                      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
                    }
                    setIsLinkPromptOpen(false);
                  }
                  if (e.key === 'Escape') {
                    setIsLinkPromptOpen(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  let finalUrl = linkInput.trim();
                  
                  if (finalUrl === '') {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  } else {
                    // Auto-prepend https:// if missing (and ignore mailto:)
                    if (!/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl)) {
                      finalUrl = `https://${finalUrl}`;
                    }
                    editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
                  }
                  setIsLinkPromptOpen(false);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center">
          {/* Hidden actual file input */}
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            style={{ display: 'none' }} 
          />
          
          {/* The visible toolbar button */}
          <button 
            type="button" 
            style={{ pointerEvents: 'auto' }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors flex items-center justify-center"
            title="Upload Image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Trigger the hidden file input
              if (fileInputRef.current) {
                fileInputRef.current.click();
              } else {
                alert("File upload is not ready.");
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded transition-colors flex items-center justify-center ${
            editor.isActive('blockquote') 
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
          }`}
          title="Blockquote"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1.987.222 2 1.986.009 1.341-.476 1.996-1.99 1.996h-.012z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.99c.009 1.341-.476 1.996-1.99 1.996h-.012z"></path></svg>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded transition-colors flex items-center justify-center ${
            editor.isActive('codeBlock') 
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
          }`}
          title="Code Block"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
        </button>

        <button
          id="toolbar-macro-divider"
          type="button"
          onMouseDown={(e) => { 
            e.preventDefault(); 
            editor.chain().focus().setHorizontalRule().run();
          }}
          className="p-1 rounded-md transition-colors flex items-center justify-center cursor-pointer text-slate-200 hover:bg-slate-700 hover:text-white border border-transparent"
          title="Horizontal Divider"
        >
          <MinusSquare size={15} />
        </button>
      </div>
    </div>
  );
}
