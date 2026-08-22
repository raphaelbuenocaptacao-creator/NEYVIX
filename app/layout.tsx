import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEYVIX',
  description: 'One identity. Your digital world.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
