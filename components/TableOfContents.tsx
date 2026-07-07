import React, { useMemo } from 'react';

interface TOCProps {
  content: string;
}

export default function TableOfContents({ content }: TOCProps) {
  const headings = useMemo(() => {
    const matches = Array.from(content.matchAll(/<(h[1-3])[^>]*>(.*?)<\/\1>/gi));
    return matches.map((m, idx) => {
      const level = parseInt(m[1].toLowerCase().replace('h', ''), 10);
      const text = m[2].replace(/<[^>]+>/g, '');
      return { id: `toc-${idx}`, level, text };
    });
  }, [content]);

  if (headings.length === 0) return null;

  return (
    <div className="no-print w-56 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto hidden lg:block shadow-xl">
      <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Table of Contents</h3>
      <ul className="space-y-2">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
            <span className="text-[11px] font-medium text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer truncate block" title={h.text}>
              {h.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
