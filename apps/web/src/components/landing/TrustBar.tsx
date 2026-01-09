'use client';

import { useEffect, useRef, useState } from 'react';

const partners = [
  {
    name: 'Movement Network',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: 'Aptos SDK',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
];

const stats = [
  { value: '5,000+', label: 'Developers' },
  { value: '100+', label: 'Projects' },
  { value: '24/7', label: 'Monitoring' },
];

export function TrustBar() {
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <section
      ref={ref}
      className={`relative py-12 overflow-hidden border-y border-dark-800/50 ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-900 to-dark-950" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Built with badges */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <span className="text-xs uppercase tracking-widest text-dark-500">Built with</span>
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg glass-button"
              >
                <span className="text-primary-400">{partner.icon}</span>
                <span className="text-sm font-medium text-dark-300">{partner.name}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-8 bg-dark-700" />

          {/* Stats */}
          <div className="flex items-center gap-8">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <div className="text-lg font-bold text-white font-mono">{stat.value}</div>
                <div className="text-xs text-dark-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
