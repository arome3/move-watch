'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const features = [
  { text: 'Generous free tier', icon: '✓' },
  { text: 'No credit card required', icon: '✓' },
  { text: 'Pay with MOVE tokens', icon: '✓' },
  { text: 'Production ready', icon: '✓' },
];

const quickLinks = [
  {
    title: 'Documentation',
    description: 'Learn how to integrate MoveWatch',
    href: 'https://docs.movementlabs.xyz',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    external: true,
  },
  {
    title: 'GitHub',
    description: 'Explore the open source code',
    href: 'https://github.com/movewatch',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
      </svg>
    ),
    external: true,
  },
  {
    title: 'Discord',
    description: 'Join the community',
    href: 'https://discord.gg/movewatch',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
      </svg>
    ),
    external: true,
  },
];

export function CTASection() {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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
    const handleMouseMove = (e: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    const section = ref.current;
    section?.addEventListener('mousemove', handleMouseMove);
    return () => section?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section ref={ref} className="relative py-32 overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-dark-950" />

        {/* Primary gradient orb that follows mouse */}
        <div
          className="absolute w-[1000px] h-[1000px] rounded-full blur-[200px] transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(23, 133, 130, 0.3) 0%, transparent 70%)',
            left: `${mousePosition.x * 100 - 50}%`,
            top: `${mousePosition.y * 100 - 50}%`,
          }}
        />

        {/* Static gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[120px]" />

        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(23, 133, 130, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(23, 133, 130, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main CTA Card */}
        <div
          className={`relative glass-panel p-12 lg:p-16 text-center mb-16 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
        >
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-primary-500/30 rounded-tl-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-gold-500/30 rounded-br-3xl" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary-500/10 to-gold-500/10 border border-primary-500/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-dark-300">Join the Movement</span>
          </div>

          {/* Headline */}
          <h2 className="text-display-xl text-white mb-6">
            Ready to Ship with{' '}
            <span className="gradient-text-shine">Confidence</span>?
          </h2>

          <p className="text-lg sm:text-xl text-dark-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join developers building the future on Movement Network. Simulate transactions,
            secure your contracts, and monitor everything in real-time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/auth/signin"
              className="group relative px-10 py-5 overflow-hidden rounded-2xl font-bold text-lg transition-all duration-300"
            >
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-gold-500 to-primary-500 bg-[length:200%_200%] animate-gradient-x" />

              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-white/20" />
              </div>

              {/* Shadow */}
              <div className="absolute inset-0 shadow-2xl shadow-primary-500/40 group-hover:shadow-primary-500/60 transition-shadow duration-300" />

              <span className="relative z-10 flex items-center justify-center gap-2 text-white">
                Get Started Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>

            <Link
              href="/simulator"
              className="group px-10 py-5 bg-dark-800/50 hover:bg-dark-800 border border-dark-600 hover:border-primary-500/50 text-dark-300 hover:text-white font-semibold text-lg rounded-2xl transition-all duration-300"
            >
              <span className="flex items-center justify-center gap-2">
                Try the Simulator
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.text}
                className={`flex items-center gap-2 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">
                  {feature.icon}
                </span>
                <span className="text-sm text-dark-400">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div
          className={`grid md:grid-cols-3 gap-6 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '200ms' }}
        >
          {quickLinks.map((link) => (
            <a
              key={link.title}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="group glass-button p-6 text-left hover:border-primary-500/30 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700/50 flex items-center justify-center text-dark-400 group-hover:text-primary-400 group-hover:border-primary-500/30 transition-colors">
                  {link.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                      {link.title}
                    </h3>
                    {link.external && (
                      <svg className="w-4 h-4 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-dark-500">{link.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
