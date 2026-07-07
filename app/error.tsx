'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-semibold">Something went wrong!</h2>
        <p className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded border border-slate-800 font-mono break-all text-left">
          {error.message || 'An unexpected error occurred in the workspace application.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
