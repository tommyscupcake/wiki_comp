'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';

interface TypographyDropdownProps {
  editor: Editor | null;
}

interface HeadingOption {
  label: string;
  cssClass: string;
  action: (editor: Editor) => boolean;
  active: (editor: Editor) => boolean;
}

const OPTIONS: HeadingOption[] = [
  {
    label: 'Normal text',
    cssClass: 'text-sm font-normal text-slate-300',
    action: (editor: Editor) => {
      
      return editor.chain().setParagraph().focus().run();
    },
    active: (editor: Editor) => editor.isActive('paragraph') && !editor.isActive('heading'),
  },
  {
    label: 'Heading 1',
    cssClass: 'text-2xl font-bold text-slate-100',
    action: (editor: Editor) => {
      
      return editor.chain().toggleHeading({ level: 1 }).focus().run();
    },
    active: (editor: Editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    label: 'Heading 2',
    cssClass: 'text-xl font-bold text-slate-100',
    action: (editor: Editor) => {
      
      return editor.chain().toggleHeading({ level: 2 }).focus().run();
    },
    active: (editor: Editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    label: 'Heading 3',
    cssClass: 'text-lg font-bold text-slate-100',
    action: (editor: Editor) => {
      
      return editor.chain().toggleHeading({ level: 3 }).focus().run();
    },
    active: (editor: Editor) => editor.isActive('heading', { level: 3 }),
  },
];

export default function TypographyDropdown({ editor }: TypographyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!editor) {
    return (
      <div className="w-[115px] h-7 bg-slate-900 border border-slate-700/60 rounded-md animate-pulse" />
    );
  }

  // Find currently active typography
  const activeOption = OPTIONS.find((opt) => opt.active(editor)) || OPTIONS[0];

  return (
    <div ref={containerRef} id="toolbar-typography-container" className="relative z-50">
      {/* Trigger Button - prevented from losing cursor focus through onMouseDown prevention */}
      <button
        id="toolbar-typography-select"
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
        className="px-2 py-1.5 rounded-md bg-slate-900 hover:bg-slate-750 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center justify-between gap-1 cursor-pointer min-w-[110px]"
        title="Typography / Headings"
      >
        <span>{activeOption.label}</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Styled drop-down menu with scaled previews of Headings & Paragraph */}
      {isOpen && (
        <ul
          id="toolbar-typography-menu"
          onMouseDown={(e) => {
            // Retain absolute editor selection focus across all option list clicks
            e.preventDefault();
          }}
          className="absolute left-0 mt-1.5 w-56 rounded-lg bg-slate-950 border border-slate-800 shadow-xl overflow-hidden py-1.5 z-50 list-none m-0 p-0"
        >
          {OPTIONS.map((option) => {
            const isActive = option.active(editor);
            return (
              <li key={option.label} className="list-none m-0 p-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    option.action(editor);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs transition-colors hover:bg-indigo-600 hover:text-white block group ${
                    isActive ? 'bg-slate-900/90 text-indigo-400 border-l-2 border-indigo-500 font-semibold' : 'text-slate-200'
                  }`}
                >
                  <span className={`${option.cssClass} group-hover:text-white transition-colors block leading-tight`}>
                    {option.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
