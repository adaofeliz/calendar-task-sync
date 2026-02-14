import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calendar Task Sync',
  description: 'Sync Tududi tasks with Google Calendar',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
