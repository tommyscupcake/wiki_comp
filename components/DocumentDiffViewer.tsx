import React from 'react';

interface DocumentDiffViewerProps {
  oldHtml: string;
  newHtml: string;
}

export default function DocumentDiffViewer({ oldHtml, newHtml }: DocumentDiffViewerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex-1 border rounded-md overflow-hidden">
          <div className="bg-rose-100 text-rose-800 px-3 py-1 text-xs font-semibold border-b border-rose-200">
            Old Version
          </div>
          <div 
            className="p-4 bg-white text-sm prose prose-sm max-w-none text-red-600 line-through opacity-80"
            dangerouslySetInnerHTML={{ __html: oldHtml }} 
          />
        </div>
        
        <div className="flex-1 border rounded-md overflow-hidden">
          <div className="bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold border-b border-emerald-200">
            New Version
          </div>
          <div 
            className="p-4 bg-white text-sm prose prose-sm max-w-none text-green-700 bg-green-50/30"
            dangerouslySetInnerHTML={{ __html: newHtml }} 
          />
        </div>
      </div>
    </div>
  );
}
