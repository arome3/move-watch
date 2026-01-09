'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const features = [
  { title: 'Gas Profiling', description: 'Per-instruction breakdown', icon: '⚡' },
  { title: 'Fork Simulation', description: 'Historical state testing', icon: '🔀' },
  { title: 'State Overrides', description: 'What-if scenarios', icon: '🔧' },
  { title: 'Execution Tracing', description: 'Step-by-step visualization', icon: '📊' },
  { title: 'Shareable Results', description: '30-day persistence', icon: '🔗' },
];

// Animated code execution visualization
function ExecutionViz() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: 'Parse', color: 'primary' },
    { label: 'Validate', color: 'gold' },
    { label: 'Execute', color: 'primary' },
    { label: 'Commit', color: 'gold' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % (steps.length + 1));
    }, 800);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < step
                ? s.color === 'primary'
                  ? 'bg-primary-500 text-white scale-100'
                  : 'bg-gold-500 text-dark-900 scale-100'
                : i === step
                  ? 'bg-dark-700 text-white scale-110 ring-2 ring-primary-400'
                  : 'bg-dark-800 text-dark-500 scale-90'
            }`}
          >
            {i < step ? '✓' : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 transition-colors duration-300 ${
                i < step ? 'bg-primary-500' : 'bg-dark-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Static demo display (no user interaction needed)
function SimulationDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Auto-cycle through phases for visual interest
    const timer = setInterval(() => {
      setPhase((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      {/* Main visualization card */}
      <div className="glass-panel overflow-hidden">
        {/* Header with execution viz */}
        <div className="px-6 py-4 border-b border-dark-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-mono text-dark-400">Simulating...</span>
            </div>
            <ExecutionViz />
          </div>
        </div>

        {/* Content area with code-like display */}
        <div className="p-6 font-mono text-sm">
          {/* Function call */}
          <div className="mb-4">
            <span className="text-dark-500">// Transaction</span>
            <div className="mt-1">
              <span className="text-primary-400">0x1</span>
              <span className="text-dark-500">::</span>
              <span className="text-gold-400">coin</span>
              <span className="text-dark-500">::</span>
              <span className="text-white">transfer</span>
            </div>
          </div>

          {/* Visual separator */}
          <div className="h-px bg-gradient-to-r from-primary-500/50 via-gold-500/30 to-transparent my-4" />

          {/* Results grid - different states based on phase */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl bg-dark-800/50 text-center transition-all duration-500 ${phase === 0 ? 'ring-2 ring-primary-500/50' : ''}`}>
              <div className="text-2xl font-bold text-white mb-1">847</div>
              <div className="text-xs text-dark-500 uppercase tracking-wider">Gas Used</div>
              {phase === 0 && (
                <div className="mt-2 text-xs text-green-400">-12% vs avg</div>
              )}
            </div>
            <div className={`p-4 rounded-xl bg-dark-800/50 text-center transition-all duration-500 ${phase === 1 ? 'ring-2 ring-gold-500/50' : ''}`}>
              <div className="text-2xl font-bold text-primary-400 mb-1">2</div>
              <div className="text-xs text-dark-500 uppercase tracking-wider">State Δ</div>
              {phase === 1 && (
                <div className="mt-2 text-xs text-primary-400">Balance, Seq</div>
              )}
            </div>
            <div className={`p-4 rounded-xl bg-dark-800/50 text-center transition-all duration-500 ${phase === 2 ? 'ring-2 ring-primary-500/50' : ''}`}>
              <div className="text-2xl font-bold text-gold-400 mb-1">1</div>
              <div className="text-xs text-dark-500 uppercase tracking-wider">Events</div>
              {phase === 2 && (
                <div className="mt-2 text-xs text-gold-400">TransferEvent</div>
              )}
            </div>
          </div>

          {/* Gas breakdown visualization */}
          <div className="mt-6">
            <div className="text-xs text-dark-500 mb-3">Gas Breakdown</div>
            <div className="h-3 rounded-full overflow-hidden bg-dark-800 flex">
              <div className="bg-primary-500 transition-all duration-1000" style={{ width: '50%' }} />
              <div className="bg-gold-500 transition-all duration-1000" style={{ width: '33%' }} />
              <div className="bg-primary-400 transition-all duration-1000" style={{ width: '17%' }} />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-primary-400">Execution 420</span>
              <span className="text-gold-400">Storage 280</span>
              <span className="text-primary-300">I/O 147</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent elements */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl glass-panel flex items-center justify-center animate-float">
        <span className="text-3xl">⚡</span>
      </div>
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-xl glass-panel flex items-center justify-center animate-float-delayed">
        <span className="text-2xl">✓</span>
      </div>
    </div>
  );
}

export function SimulatorShowcase() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);
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

    // Parallax
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section id="features" ref={ref} className="relative py-32 overflow-hidden">
      {/* UNIQUE BACKGROUND: Diagonal stripes instead of blur orbs */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 40px,
              rgba(23, 133, 130, 0.5) 40px,
              rgba(23, 133, 130, 0.5) 41px
            )`,
          }}
        />
        {/* Single subtle accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[200px]"
          style={{
            background: 'radial-gradient(circle, rgba(23, 133, 130, 0.08) 0%, transparent 70%)',
            transform: `translate(-50%, calc(-50% + ${scrollY * 0.05}px))`,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* UNIQUE LAYOUT: Centered header, then asymmetric two-up */}

        {/* Header - LEFT ALIGNED for variety */}
        <div className={`max-w-2xl mb-16 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-primary-500" />
            <span className="text-xs font-medium text-primary-400 uppercase tracking-wider">Pillar One</span>
          </div>

          <h2 className="text-display-lg text-white mb-6">
            Simulate Before You Ship
          </h2>

          <p className="text-lg text-dark-400 leading-relaxed">
            See exactly what your transaction will do—gas costs, state changes, events—without
            spending a single unit of gas. Debug in seconds, not hours.
          </p>
        </div>

        {/* Two-column with OVERLAP for visual interest */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: Feature pills - stacked vertically, floating */}
          <div
            className={`lg:col-span-4 lg:sticky lg:top-24 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{ animationDelay: '100ms' }}
          >
            <div className="space-y-3">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`group flex items-center gap-4 p-4 rounded-xl bg-dark-900/50 border border-dark-800 hover:border-primary-500/30 hover:bg-dark-800/50 transition-all duration-300 cursor-default ${
                    isVisible ? 'animate-fade-in-up' : 'opacity-0'
                  }`}
                  style={{
                    animationDelay: `${150 + index * 80}ms`,
                    transform: `translateX(${index % 2 === 0 ? '0' : '8px'})`, // Staggered offset
                  }}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{feature.icon}</span>
                  <div>
                    <div className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                      {feature.title}
                    </div>
                    <div className="text-sm text-dark-500">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 mt-8 text-primary-400 font-medium hover:text-primary-300 transition-colors group"
            >
              Open Simulator
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Right: Demo visualization - LARGER, with perspective tilt */}
          <div
            className={`lg:col-span-8 lg:-mr-8 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{
              animationDelay: '200ms',
              transform: `perspective(1000px) rotateY(-2deg)`,
            }}
          >
            <SimulationDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
