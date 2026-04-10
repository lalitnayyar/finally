import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinAlly - AI Trading Workstation',
  description: 'AI-powered trading terminal with live market data and chat assistant',
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
