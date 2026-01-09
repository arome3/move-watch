'use client';

import { useEffect, useRef, useState } from 'react';

const cliFeatures = [
  { command: 'movewatch simulate', description: 'Simulate transactions from your terminal' },
  { command: 'movewatch guard', description: 'Run security analysis on local contracts' },
  { command: 'movewatch watch', description: 'Monitor contracts in real-time' },
  { command: 'movewatch deploy', description: 'Deploy with pre-flight checks' },
];

export function CLIComingSoon() {
  const [isVisible, setIsVisible] = useState(false);
  const [typedIndex, setTypedIndex] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setTypedIndex((prev) => (prev + 1) % cliFeatures.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900 via-dark-950 to-dark-900" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`relative glass-panel p-8 lg:p-12 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
        >
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-primary-500/20 rounded-tl-2xl" />
          <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-primary-500/20 rounded-br-2xl" />

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left: Content */}
            <div>
              {/* Coming Soon Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/30 mb-6">
                <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Coming Soon</span>
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                MoveWatch{' '}
                <span className="gradient-text">CLI</span>
              </h2>

              <p className="text-dark-400 text-lg mb-6 leading-relaxed">
                All the power of MoveWatch, right in your terminal. Simulate, analyze, and monitor
                without leaving your development workflow.
              </p>

              {/* Feature list */}
              <ul className="space-y-3">
                {['CI/CD integration', 'Local contract analysis', 'Scriptable automation'].map((feature, i) => (
                  <li
                    key={feature}
                    className={`flex items-center gap-3 text-dark-300 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
                    style={{ animationDelay: `${200 + i * 100}ms` }}
                  >
                    <svg className="w-5 h-5 text-primary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Terminal mockup */}
            <div
              className={`${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: '150ms' }}
            >
              <div className="rounded-xl overflow-hidden bg-dark-950 border border-dark-700/50 shadow-2xl">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-dark-800/50 border-b border-dark-700/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-dark-500 ml-2 font-mono">terminal</span>
                </div>

                {/* Terminal content */}
                <div className="p-5 font-mono text-sm space-y-4">
                  {cliFeatures.map((feature, index) => (
                    <div
                      key={feature.command}
                      className={`transition-all duration-500 ${
                        index === typedIndex ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary-400">$</span>
                        <span className="text-white">{feature.command}</span>
                        {index === typedIndex && (
                          <span className="w-2 h-5 bg-primary-400 animate-pulse" />
                        )}
                      </div>
                      {index === typedIndex && (
                        <p className="text-dark-500 mt-1 pl-4 text-xs"># {feature.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
