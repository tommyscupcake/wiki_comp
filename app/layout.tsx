import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import AuthGuard from '@/components/AuthGuard';


export const metadata: Metadata = {
  title: 'My Google AI Studio App',
  description: 'My Google AI Studio App',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" />
        <script id="jspdf-bridge" dangerouslySetInnerHTML={{
          __html: `if (typeof window !== 'undefined') { window.jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF; }`
        }} />
        <script src="https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.min.js" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js" />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
