import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'POGH Ayodhya - Police Officers Guest House Portal',
  description: 'Official Booking & Room Management System for Police Officers Guest House, Ayodhya',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900">
        {children}
      </body>
    </html>
  );
}
