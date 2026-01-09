import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import { Header } from '@/components/Header';
import { PaymentRequiredModal } from '@/components/payment';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MoveWatch - Transaction Simulator for Movement Network',
  description:
    'Simulate transactions on Movement Network before execution. Preview gas costs, state changes, and events.',
  keywords: ['Movement Network', 'blockchain', 'transaction simulator', 'Move', 'Aptos'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Clash Display from Fontshare */}
        <link href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-dark-950 text-dark-50 grain-overlay">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />

            {/* Main content */}
            <main className="flex-1">{children}</main>

            {/* Footer */}
            <footer className="border-t border-dark-800 py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-center text-sm text-dark-500">
                  Built for Movement Network developers | Powered by x402
                </p>
              </div>
            </footer>
          </div>

          {/* x402 Payment Modal (global) */}
          <PaymentRequiredModal />
        </Providers>
      </body>
    </html>
  );
}
