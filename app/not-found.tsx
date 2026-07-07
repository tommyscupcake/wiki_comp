import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-blue-500">404</h1>
        <h2 className="text-xl font-semibold">Page Not Found</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          The wiki page or resource you are looking for does not exist or has been moved.
        </p>
        <Link 
          href="/" 
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
}
