'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal body */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-sm bg-slate-905 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-10 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-850 bg-slate-950/20">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle size={16} strokeWidth={2.5} className="animate-bounce" />
              <h3 className="text-sm font-bold tracking-tight text-slate-100 uppercase font-mono">
                Confirm Deletion
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex flex-col gap-3">
            <p className="text-xs text-slate-355 text-slate-300 font-medium leading-relaxed">
              Are you sure you want to delete <strong className="text-rose-300 font-bold">&ldquo;{itemName}&rdquo;</strong>?
            </p>
            <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[10px] text-slate-400 font-mono flex items-start gap-2">
              <span className="text-rose-400 font-bold block mt-0.5">⚠️ SAFETY WARN:</span>
              <span>This operation cannot be undone. Collaborator sessions access rights will be permanently terminated.</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-850 bg-slate-950/30 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-semibold hover:shadow-sm transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/15 text-white text-xs font-bold leading-none flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 size={12} strokeWidth={2.5} />
              <span>Delete</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
