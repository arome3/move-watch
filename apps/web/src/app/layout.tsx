import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
      <body className="font-sans antialiased bg-slate-950 text-slate-50">
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-primary-400">MoveWatch</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    beta
                  </span>
                </div>
                <nav className="flex items-center gap-6">
                  <a
                    href="/"
                    className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    Simulator
                  </a>
                  <a
                    href="/alerts"
                    className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    Alerts
                  </a>
                  <a
                    href="https://docs.movementlabs.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    Docs
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="border-t border-slate-800 py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-slate-500">
                Built for Movement Network developers
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
