import type { Metadata } from 'next';
import './globals.css';
import './visual-v3.css';

export const metadata: Metadata = {
  title: 'NEYVIX',
  description: 'Uma identidade. Uma inteligência. Um universo digital.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
