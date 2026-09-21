import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-hindi',
  fallback: ['sans-serif'],
});

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'POGH Ayodhya - Police Officers Guest House Portal',
  description: 'Official Booking & Room Management System for Police Officers Guest House, Ayodhya',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi" className={`${inter.variable} ${notoDevanagari.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900 font-sans">
        {children}
      </body>
    </html>
  );
}
