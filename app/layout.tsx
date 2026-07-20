import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'CreatorOS AI — AI-Powered YouTube Content Studio',
  description:
    'The all-in-one AI platform for YouTube creators. Research trends, generate scripts, create thumbnails, optimize SEO, edit videos, and publish — all powered by AI.',
  openGraph: {
    title: 'CreatorOS AI — AI-Powered YouTube Content Studio',
    description:
      'The all-in-one AI platform for YouTube creators. Research, script, edit, optimize, and publish — powered by AI.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreatorOS AI — AI-Powered YouTube Content Studio',
    description:
      'The all-in-one AI platform for YouTube creators. Research, script, edit, optimize, and publish — powered by AI.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'hsl(240 10% 5.5%)',
                border: '1px solid hsl(240 4% 16%)',
                color: 'hsl(0 0% 98%)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
