/* eslint-disable @next/next/no-img-element */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import Image from '@tiptap/extension-image';
import { Move } from 'lucide-react';

export const ResizableImageNodeView = (props: any) => {
  const { node, updateAttributes, selected, deleteNode, editor, selectNode, getPos } = props;
  const { src, alt, title, width, alignment, left, top } = node.attrs;
  const isEditable = editor?.isEditable;
  
  const [isHovered, setIsHovered] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const directionRef = useRef<'left' | 'right' | null>(null);

  const selectThisNode = useCallback(() => {
    if (typeof selectNode === 'function') {
      try {
        selectNode();
      } catch (e) {
        console.error('selectNode failed:', e);
      }
    } else if (typeof getPos === 'function' && editor) {
      try {
        const pos = getPos();
        const { state, view } = editor;
        const tr = state.tr;
        const selection = NodeSelection.create(state.doc, pos);
        view.dispatch(tr.setSelection(selection));
      } catch (e) {
        console.error('Failed to manually select node:', e);
        try {
          if (editor.commands && typeof editor.commands.setNodeSelection === 'function') {
            editor.commands.setNodeSelection(getPos());
          }
        } catch (err) {
          console.error('setNodeSelection command failed:', err);
        }
      }
    }
  }, [selectNode, getPos, editor]);

  // Allow selecting and hovering the free-moving image when the user hovers over it, even if empty paragraphs/divs are layered on top of it.
  useEffect(() => {
    if (!isEditable || alignment !== 'free') return;

    const isPointerOverActualText = (x: number, y: number): boolean => {
      try {
        const element = document.elementFromPoint(x, y);
        if (!element) return false;

        if (element.classList.contains('ProseMirror') || element.id === 'editor-content-wrapper') {
          return false;
        }

        const textContainer = element.closest('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, span, strong, em, a');
        if (!textContainer) return false;

        const text = textContainer.textContent || '';
        if (!text.trim()) return false;

        const range = document.createRange();
        let hasTextNodes = false;
        const walker = document.createTreeWalker(textContainer, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let minLeft = Infinity;
        let maxRight = -Infinity;
        let minTop = Infinity;
        let maxBottom = -Infinity;

        while (node) {
          if (node.textContent && node.textContent.trim()) {
            range.selectNode(node);
            const rects = range.getClientRects();
            for (let i = 0; i < rects.length; i++) {
              const r = rects[i];
              if (r.width > 0 && r.height > 0) {
                minLeft = Math.min(minLeft, r.left);
                maxRight = Math.max(maxRight, r.right);
                minTop = Math.min(minTop, r.top);
                maxBottom = Math.max(maxBottom, r.bottom);
                hasTextNodes = true;
              }
            }
          }
          node = walker.nextNode();
        }

        if (hasTextNodes) {
          // 8px horizontal / 4px vertical buffer to protect text hover/selection
          return (
            x >= minLeft - 8 &&
            x <= maxRight + 8 &&
            y >= minTop - 4 &&
            y <= maxBottom + 4
          );
        }
      } catch (err) {
        console.error('Error in isPointerOverActualText:', err);
      }
      return false;
    };

    let lastHoverState = false;
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const isInside = 
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      let nextHoverState = false;
      if (isInside) {
        const isOverText = isPointerOverActualText(e.clientX, e.clientY);
        if (!isOverText) {
          nextHoverState = true;
        }
      }

      if (nextHoverState !== lastHoverState) {
        lastHoverState = nextHoverState;
        setIsHovered(nextHoverState);
      }
    };

    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const isClickInside = 
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (isClickInside) {
        const target = e.target as HTMLElement;

        if (target.closest('button, .cursor-nwse-resize, .cursor-nesw-resize, input, select, textarea, [role="button"]')) {
          return;
        }

        if (containerRef.current.contains(target)) {
          // If the user clicked directly on our image or elements inside our container,
          // let Tiptap/ProseMirror handle it natively so selection/focus are correct!
          selectThisNode();
          return;
        }

        const isEditorCanvas = target?.classList.contains('ProseMirror') || target?.id === 'editor-content-wrapper';
        const isInteractive = target?.closest('button, input, select, textarea, [role="button"]');
        if (isInteractive) return;

        const clickingText = isPointerOverActualText(e.clientX, e.clientY);

        if (!clickingText || isEditorCanvas) {
          e.preventDefault();
          e.stopPropagation();
          selectThisNode();
        }
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    document.addEventListener('mousedown', handleGlobalMouseDown, true);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mousedown', handleGlobalMouseDown, true);
    };
  }, [isEditable, alignment, selectThisNode, getPos, editor]);

  const handleResizeStart = (e: React.MouseEvent, direction: 'left' | 'right') => {
    if (!isEditable) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    directionRef.current = direction;
    
    if (containerRef.current) {
      startWidthRef.current = containerRef.current.getBoundingClientRect().width;
    }

    let latestWidth = startWidthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startXRef.current;
      const newWidth = directionRef.current === 'right' 
        ? startWidthRef.current + dx 
        : startWidthRef.current - dx;
      
      const offsetParent = containerRef.current?.offsetParent as HTMLElement;
      const parentWidth = offsetParent ? offsetParent.clientWidth : 800;
      const currentLeftVal = parseFloat(left || '0');

      // Maximum allowable width is the parent width minus left offset (if free alignment)
      const maxAllowedWidth = alignment === 'free' 
        ? Math.max(50, parentWidth - currentLeftVal)
        : parentWidth;

      latestWidth = Math.max(50, Math.min(newWidth, maxAllowedWidth));
      
      if (containerRef.current) {
        containerRef.current.style.width = `${latestWidth}px`;
      }
    };

    const handleMouseUp = () => {
      directionRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Persist the final width once
      updateAttributes({ width: `${latestWidth}px` });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    selectThisNode();

    const currentLeft = parseFloat(left || '100');
    const currentTop = parseFloat(top || '100');

    const startX = e.clientX;
    const startY = e.clientY;

    const paperEl = document.getElementById('editor-content-wrapper');
    const paperRect = paperEl ? paperEl.getBoundingClientRect() : null;
    const imgRect = containerRef.current?.getBoundingClientRect();

    // Calculate scale factor from the zoom level applied to the paper
    const scaleX = paperRect && paperEl ? (paperRect.width / paperEl.offsetWidth) : 1;
    const scaleY = paperRect && paperEl ? (paperRect.height / paperEl.offsetHeight) : 1;

    let latestLeft = currentLeft;
    let latestTop = currentTop;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (paperRect && imgRect && paperEl) {
        // Track dragging in screen space, applying limits relative to the paper container
        let nextScreenLeft = imgRect.left + dx;
        let nextScreenTop = imgRect.top + dy;

        // Perfect boundary constraint in screen coordinates (respects paper boundaries on all sides)
        nextScreenLeft = Math.max(paperRect.left, Math.min(nextScreenLeft, paperRect.right - imgRect.width));
        nextScreenTop = Math.max(paperRect.top, Math.min(nextScreenTop, paperRect.bottom - imgRect.height));

        // Convert the constrained screen delta back to layout-space pixels by dividing by scale factor
        const constrainedDx = nextScreenLeft - imgRect.left;
        const constrainedDy = nextScreenTop - imgRect.top;

        latestLeft = currentLeft + (constrainedDx / scaleX);
        latestTop = currentTop + (constrainedDy / scaleY);
      } else {
        const offsetParent = containerRef.current?.offsetParent as HTMLElement;
        const parentWidth = offsetParent ? offsetParent.clientWidth : 800;
        const parentHeight = offsetParent ? offsetParent.clientHeight : 1000;
        const imgWidth = containerRef.current?.offsetWidth || 300;
        const imgHeight = containerRef.current?.offsetHeight || 200;

        let nextLeft = currentLeft + dx;
        let nextTop = currentTop + dy;

        latestLeft = Math.max(0, Math.min(nextLeft, parentWidth - imgWidth));
        latestTop = Math.max(0, Math.min(nextTop, parentHeight - imgHeight));
      }

      if (containerRef.current) {
        containerRef.current.style.left = `${latestLeft}px`;
        containerRef.current.style.top = `${latestTop}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Persist the final drag position once
      updateAttributes({
        left: `${latestLeft}px`,
        top: `${latestTop}px`,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getWrapperStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: 'relative',
      width: width,
      maxWidth: '100%',
      zIndex: selected ? 40 : (isHovered ? 30 : 5),
    };

    if (alignment === 'left') {
      return {
        ...baseStyles,
        float: 'left',
        margin: '0 1.5rem 1.5rem 0',
        display: 'inline-block',
      };
    } else if (alignment === 'right') {
      return {
        ...baseStyles,
        float: 'right',
        margin: '0 0 1.5rem 1.5rem',
        display: 'inline-block',
      };
    } else if (alignment === 'free') {
      return {
        position: 'absolute',
        left: left || '100px',
        top: top || '100px',
        width: width,
        maxWidth: '100%',
        zIndex: selected ? 40 : (isHovered ? 30 : 5),
        margin: 0,
        float: 'none',
        display: 'block',
      };
    } else {
      return {
        ...baseStyles,
        display: 'block',
        margin: '1.5rem auto',
        float: 'none',
        clear: 'both',
      };
    }
  };

  return (
    <NodeViewWrapper 
      as="div" 
      ref={containerRef}
      style={getWrapperStyles() as any}
      onMouseEnter={() => {
        if (isEditable) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (isEditable) {
          setIsHovered(false);
        }
      }}
      className={`relative group pointer-events-auto select-none ${isEditable ? 'cursor-pointer' : ''} ${selected && isEditable ? 'ProseMirror-selectednode' : ''}`}
    >
      {/* Floating Toolbar */}
      {isEditable && selected && (
        <div className="pdf-hide absolute left-1/2 bottom-0 translate-y-[calc(100%+12px)] -translate-x-1/2 z-50 flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 text-sm">
          <button
            type="button"
            className={`px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-200 ${alignment === 'left' ? 'bg-slate-100 dark:bg-slate-700 font-semibold text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => updateAttributes({ alignment: 'left' })}
            title="Align Left"
          >
            Left
          </button>
          <button
            type="button"
            className={`px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-200 ${alignment === 'center' ? 'bg-slate-100 dark:bg-slate-700 font-semibold text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => updateAttributes({ alignment: 'center' })}
            title="Align Center"
          >
            Center
          </button>
          <button
            type="button"
            className={`px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-200 ${alignment === 'right' ? 'bg-slate-100 dark:bg-slate-700 font-semibold text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => updateAttributes({ alignment: 'right' })}
            title="Align Right"
          >
            Right
          </button>
          <button
            type="button"
            className={`px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-200 ${alignment === 'free' ? 'bg-slate-100 dark:bg-slate-700 font-semibold text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => {
              const rect = containerRef.current?.getBoundingClientRect();
              const parentRect = containerRef.current?.offsetParent?.getBoundingClientRect();
              const paperEl = document.getElementById('editor-content-wrapper');
              const paperRect = paperEl?.getBoundingClientRect();
              const scaleX = paperRect && paperEl ? (paperRect.width / paperEl.offsetWidth) : 1;
              const scaleY = paperRect && paperEl ? (paperRect.height / paperEl.offsetHeight) : 1;

              let initialLeft = '100px';
              let initialTop = '100px';
              if (rect && parentRect) {
                const l = rect.left - parentRect.left;
                const t = rect.top - parentRect.top;
                const parentWidth = parentRect.width;
                const parentHeight = parentRect.height;
                const imgWidth = rect.width;
                const imgHeight = rect.height;
                const clampedLeft = Math.max(0, Math.min(l, parentWidth - imgWidth));
                const clampedTop = Math.max(0, Math.min(t, parentHeight - imgHeight));
                initialLeft = `${clampedLeft / scaleX}px`;
                initialTop = `${clampedTop / scaleY}px`;
              }
              updateAttributes({
                alignment: 'free',
                left: initialLeft,
                top: initialTop,
              });
            }}
            title="Free Move (Drag anywhere)"
          >
            Free Drag
          </button>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
          <button
            type="button"
            className="px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 rounded flex items-center gap-1 transition-colors"
            onClick={deleteNode}
            title="Remove Photo"
          >
            🗑️ Remove
          </button>
        </div>
      )}

      {/* Persistent Move Handle (always on top of text) */}
      {alignment === 'free' && isEditable && (
        <div 
          className="pdf-hide absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg border-2 border-white dark:border-slate-800 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-all z-50 animate-fade-in pointer-events-auto"
          onMouseDown={(e) => {
            if (!isEditable) return;
            e.preventDefault();
            e.stopPropagation();
            selectThisNode();
            handleDragStart(e);
          }}
          title="Drag to move, click to select"
        >
          <Move className="w-4 h-4" strokeWidth={2.5} />
        </div>
      )}

      {/* Image with Drag Overlay */}
      <div 
        className={`relative w-full h-auto ${isEditable ? 'cursor-pointer' : ''}`}
        style={alignment === 'free' ? { zIndex: 1 } : undefined}
        onMouseDown={(e) => {
          if (!isEditable) return;
          // Ensure we don't block clicks to toolbar or handles
          const target = e.target as HTMLElement;
          if (target.closest('button, .cursor-nwse-resize, .cursor-nesw-resize')) {
            return;
          }
          // Do NOT prevent default or stop propagation, so that ProseMirror's
          // native focus and click event handling are not broken!
          selectThisNode();
        }}
        onClick={(e) => {
          if (!isEditable) return;
          selectThisNode();
        }}
      >
        <img
          src={src}
          alt={alt}
          title={title}
          className={`block w-full h-auto transition-all duration-150 ${
            selected && isEditable 
              ? 'outline outline-3 outline-blue-500 shadow-lg' 
              : isEditable 
                ? 'hover:outline hover:outline-2 hover:outline-blue-500/50 group-hover:outline group-hover:outline-2 group-hover:outline-blue-500/50 cursor-pointer hover:shadow-md' 
                : ''
          }`}
          draggable="false"
        />
        {alignment === 'free' && isEditable && (
          <div 
            className="pdf-hide absolute inset-0 bg-blue-500/0 hover:bg-blue-500/10 active:bg-blue-500/15 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all z-30"
            onMouseDown={(e) => {
              if (!isEditable) return;
              // Make sure to select it on mousedown on the free drag overlay!
              selectThisNode();
              handleDragStart(e);
            }}
          >
            <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 pointer-events-none select-none text-slate-700 dark:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 scale-95 group-hover:scale-100 transform">
              <span>✥ Drag to Move</span>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handles */}
      {isEditable && selected && (
        <>
          <div
            className="pdf-hide absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
          />
          <div
            className="pdf-hide absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
          <div
            className="pdf-hide absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'left')}
          />
          <div
            className="pdf-hide absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-50"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
        </>
      )}
    </NodeViewWrapper>
  );
};

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '50%',
        parseHTML: (element) => element.getAttribute('width') || element.style.width || '50%',
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-alignment') || 'center',
        renderHTML: (attributes) => {
          if (!attributes.alignment) return {};
          return { 'data-alignment': attributes.alignment };
        },
      },
      left: {
        default: '100px',
        parseHTML: (element) => element.getAttribute('data-left') || '100px',
        renderHTML: (attributes) => {
          if (!attributes.left) return {};
          return { 'data-left': attributes.left };
        },
      },
      top: {
        default: '100px',
        parseHTML: (element) => element.getAttribute('data-top') || '100px',
        renderHTML: (attributes) => {
          if (!attributes.top) return {};
          return { 'data-top': attributes.top };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});
