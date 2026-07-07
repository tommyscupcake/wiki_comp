'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useWikiStore } from '@/lib/store';
import { Lock, User, AlertCircle, BookOpen, Fingerprint } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, currentUser, users } = useWikiStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect straight to workspace
  useEffect(() => {
    if (currentUser) {
      router.push('/');
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill out all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    const success = await login(username, password);
    setIsLoading(false);
    if (success) {
      router.push('/');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 font-sans relative overflow-hidden">
      {/* Background visual graphics */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-10 mx-4"
        id="login-card-container"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mb-4 shadow-inner text-blue-400">
            <BookOpen size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 font-sans">
            Enterprise Wiki Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Log in to manage knowledge bases, documents, and lists
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg"
              id="login-error-alert"
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <User size={14} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="w-full py-2 pl-9 pr-4 bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock size={14} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2 pl-9 pr-4 bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            id="login-button"
          >
            {isLoading ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Access Workspace'
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex flex-col items-center">
          <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase font-mono flex items-center gap-1">
            <Fingerprint size={10} /> Test Accounts Preloaded
          </span>
          <div className="grid grid-cols-2 gap-4 w-full mt-2.5 text-[11px] text-slate-400 text-center font-mono">
            <div className="p-1.5 bg-slate-950/30 rounded border border-slate-800/50">
              <span className="text-[9px] text-slate-500 block">ADMIN</span>
              admin / admin
            </div>
            <div className="p-1.5 bg-slate-950/30 rounded border border-slate-800/50">
              <span className="text-[9px] text-slate-500 block">CREATOR</span>
              user / user
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
