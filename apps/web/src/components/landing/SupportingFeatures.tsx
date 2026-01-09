'use client';

import { useEffect, useRef, useState } from 'react';

const features = [
  {
    icon: '⛽',
    title: 'Gas Analytics',
    description: 'Track gas costs with function-level breakdown and anomaly detection.',
    stats: [
      { label: 'Cost Analysis', value: 'Deep' },
      { label: 'Anomalies', value: 'AI' },
    ],
    gradient: 'from-gold-500/20 to-orange-500/20',
  },
  {
    icon: '📡',
    title: 'Event Streaming',
    description: 'Real-time WebSocket feed of on-chain events filtered by contract.',
    stats: [
      { label: 'Latency', value: '<1s' },
      { label: 'Filters', value: 'Custom' },
    ],
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: '🔗',
    title: 'Shareable Results',
    description: 'Generate URLs for simulation and security analysis with 30-day persistence.',
    stats: [
      { label: 'Retention', value: '30 days' },
      { label: 'Access', value: 'Public' },
    ],
    gradient: 'from-green-500/20 to-primary-500/20',
  },
];

export function SupportingFeatures() {
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
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-dark-900/50 to-dark-950" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Plus Everything You Need
          </h2>
          <p className="text-dark-400 max-w-xl mx-auto">
            Additional tools to monitor, analyze, and share your development workflow.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative p-6 rounded-2xl bg-dark-900/50 border border-dark-800 hover:border-dark-700 transition-all duration-300 ${
                isVisible ? 'animate-fade-in-up' : 'opacity-0'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <span className="text-2xl">{feature.icon}</span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-dark-400 leading-relaxed mb-4">{feature.description}</p>

              {/* Stats */}
              <div className="flex gap-4">
                {feature.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-sm font-bold text-white font-mono">{stat.value}</div>
                    <div className="text-xs text-dark-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} blur-xl opacity-20`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
