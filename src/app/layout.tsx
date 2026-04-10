import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HN Daily Digest',
  description: 'Top 10 Hacker News stories, summarized daily.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
