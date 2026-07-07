'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import CodeBlock from '@tiptap/extension-code-block';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import getSuggestion from './mentionSuggestion';
import { common, createLowlight } from 'lowlight';
import 'highlight.js/styles/atom-one-dark.css';

import { FontSize } from '@/lib/FontSizeExtension';
import { HeadingImmunity } from '@/lib/HeadingImmunityExtension';

import { WikiDocument, useWikiStore } from '@/lib/store';
import EditorToolbar from './EditorToolbar';
import ListItem from '@tiptap/extension-list-item';
import { CustomImage } from './ResizableImageNodeView';

interface WikiEditorProps {
  content: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  activeDocument?: WikiDocument | null;
  zoomLevel?: number;
  mentionableUsers?: any[];
}

const CustomListItem = ListItem.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

const CustomTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

export interface WikiEditorRef {
  editor: Editor | null;
}

const WikiEditor = React.forwardRef<WikiEditorRef, WikiEditorProps>(({
  content,
  onChange,
  readOnly = false,
  activeDocument = null,
  zoomLevel = 100,
  mentionableUsers = [],
   
}, ref) => {

  const mentionableUsersRef = useRef(mentionableUsers);
  useEffect(() => {
    mentionableUsersRef.current = mentionableUsers;
  }, [mentionableUsers]);

  const lastUpdateFromEditorRef = useRef<string | null>(content);
  const isLocalChangeRef = useRef(false);
  const prevDocIdRef = useRef<string | null>(activeDocument?.id || null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lowlight = createLowlight(common);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Mention.configure({
        HTMLAttributes: {
          class: "mention bg-indigo-500/20 text-indigo-400 rounded px-1 py-0.5 font-medium",
        },
        suggestion: getSuggestion(() => mentionableUsersRef.current),
      }),
      Placeholder.configure({
        placeholder: 'Start your document here...',
        emptyEditorClass: 'is-editor-empty',
      }),
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
        strike: false,
        dropcursor: false,
        listItem: false,
        underline: false,
        link: false,
      }),
      CodeBlock,
      Link.configure({
        openOnClick: "whenNotEditable", // Allows clicking ONLY when in View Mode (Orange Eye)
        autolink: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-blue-400 underline decoration-blue-400/50 underline-offset-2 cursor-pointer hover:text-blue-300 transition-colors'
        }
      }),
      Underline,
      CustomListItem,
      TaskList,
      CustomTaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      CustomImage,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      HeadingImmunity,
    ],
    content: content || '<p></p>',
    editable: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      isLocalChangeRef.current = true;
      lastUpdateFromEditorRef.current = html;
      onChangeRef.current(html);
    },
    editorProps: {
      handlePaste(view, event) {
        event.preventDefault();
        const plainText = event.clipboardData?.getData('text/plain');
        if (plainText) {
          const cleanText = plainText.replace(/[\r\n]+/g, ' ').trim();
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText(cleanText, from, to));
        }
        return true;
      },
      attributes: {
        class: 'tiptap focus:outline-none min-h-[960px] h-full w-full text-black text-sm tiptap-paper',
      },
    },
  }, []);

  React.useImperativeHandle(ref, () => ({
    editor
  }), [editor]);

  // Track outer content changes to update editor asynchronously
  useEffect(() => {
    if (!editor) return;

    const docIdChanged = activeDocument?.id !== prevDocIdRef.current;
    prevDocIdRef.current = activeDocument?.id || null;

    if (docIdChanged) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
      isLocalChangeRef.current = false;
      lastUpdateFromEditorRef.current = content;
      return;
    }

    if (content === lastUpdateFromEditorRef.current) {
      return;
    }

    if (isLocalChangeRef.current) {
      isLocalChangeRef.current = false;
      lastUpdateFromEditorRef.current = content;
      return;
    }

    // This branch is only hit for external changes (e.g. AI formatting or Version Restoration)
    if (content !== editor.getHTML()) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
      if (from !== undefined && to !== undefined) {
        setTimeout(() => {
          if (!editor.isDestroyed) {
             editor.commands.setTextSelection({ from, to });
          }
        }, 0);
      }
    }
    lastUpdateFromEditorRef.current = content;
  }, [content, editor, activeDocument?.id]);

  // Set readOnly state when changed
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  const renderedContent = useMemo(() => (
    <div className="flex-grow flex-1 min-h-0 overflow-y-auto relative bg-slate-900 rounded-b-2xl no-scrollbar">
      <div 
        id="editor-content-wrapper"
        onClick={(e) => {
          if (editor && !readOnly && e.target === e.currentTarget) {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              e.stopPropagation();
              return;
            }
            editor.commands.focus('end');
          }
        }}
        className={`relative max-w-[816px] w-full min-h-[1056px] mx-auto my-8 p-12 bg-white text-black shadow-lg ring-1 ring-slate-200 prose prose-slate transition-transform duration-200 ease-in-out flex flex-col cursor-text flow-root no-scrollbar [&_.ProseMirror_p]:!my-0 [&_.ProseMirror_p]:!leading-normal prose-p:!my-0 [&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:!pl-0 [&_li[data-type="taskItem"]]:flex [&_li[data-type="taskItem"]]:items-start [&_li[data-type="taskItem"]]:!gap-3 [&_li[data-type="taskItem"]_label]:mt-1 [&_li[data-type="taskItem"]_input]:!w-5 [&_li[data-type="taskItem"]_input]:!h-5 [&_li[data-type="taskItem"]_input]:!m-0 [&_li[data-type="taskItem"]_input]:cursor-pointer [&_li[data-type="taskItem"]_div]:flex-1 [&_li[data-type="taskItem"]_div_p]:!m-0 [&_li[data-type="taskItem"]_div_*]:!text-[16px] [&_li[data-type="taskItem"]_div_*]:!leading-normal [&_li[data-type="taskItem"]_div]:!text-[16px] [&_.ProseMirror_p]:relative [&_.ProseMirror_p]:z-10 [&_.ProseMirror_h1]:relative [&_.ProseMirror_h1]:z-10 [&_.ProseMirror_h2]:relative [&_.ProseMirror_h2]:z-10 [&_.ProseMirror_h3]:relative [&_.ProseMirror_h3]:z-10 [&_.ProseMirror_h4]:relative [&_.ProseMirror_h4]:z-10 [&_.ProseMirror_h5]:relative [&_.ProseMirror_h5]:z-10 [&_.ProseMirror_h6]:relative [&_.ProseMirror_h6]:z-10 [&_.ProseMirror_ul]:relative [&_.ProseMirror_ul]:z-10 [&_.ProseMirror_ol]:relative [&_.ProseMirror_ol]:z-10 [&_.ProseMirror_blockquote]:relative [&_.ProseMirror_blockquote]:z-10 [&_.ProseMirror_pre]:relative [&_.ProseMirror_pre]:z-10 [&_.ProseMirror_table]:relative [&_.ProseMirror_table]:z-10 [&_.ProseMirror_hr]:relative [&_.ProseMirror_hr]:z-10 [&_.ProseMirror]:!overflow-visible [&_.ProseMirror]:break-words [&_.ProseMirror]:no-scrollbar`}
        style={{
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'top center'
        }}
      >
        <EditorContent editor={editor} className="flow-root flex-grow flex flex-col w-full [&>div]:flex-grow [&>div]:outline-none pointer-events-none [&>div]:pointer-events-auto" />
      </div>
    </div>
  ), [editor, readOnly, zoomLevel]);

  return (
    <div className="w-full flex-grow flex-1 min-h-0 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all relative no-scrollbar">
      {/* Editor Toolbar (Invisible if readOnly is active) */}
      {!readOnly && (
        <div id="editor-toolbar-wrapper" className="no-print flex-shrink-0 z-10 w-full flex items-center justify-between">
          <EditorToolbar editor={editor} activeDocument={activeDocument} />
        </div>
      )}

      {/* Raw Edit Canvas Panel */}
      {renderedContent}
    </div>
  );
});

WikiEditor.displayName = 'WikiEditor';

export default WikiEditor;
