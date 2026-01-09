'use client';

import { useEffect, useRef, useState } from 'react';

const capabilities = [
  {
    id: 'alerts',
    title: 'Smart Alerts',
    description: 'Get notified when conditions are met on-chain. 4 alert types for comprehensive coverage.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    gradient: 'from-primary-500/20 to-primary-600/20',
    size: 'large',
    features: ['Transaction Failed', 'Balance Threshold', 'Event Emitted', 'Gas Spike'],
  },
  {
    id: 'channels',
    title: 'Notification Channels',
    description: 'Deliver alerts wherever your team works. Rich formatting for each platform.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    gradient: 'from-gold-500/20 to-gold-600/20',
    size: 'medium',
    integrations: [
      { name: 'Discord', icon: '💬' },
      { name: 'Slack', icon: '📱' },
      { name: 'Telegram', icon: '✈️' },
      { name: 'Webhook', icon: '🔗' },
      { name: 'Email', icon: '📧' },
    ],
  },
  {
    id: 'monitoring',
    title: 'Live Monitoring',
    description: 'Track contract health, transaction volume, and gas trends in real-time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    gradient: 'from-green-500/20 to-primary-500/20',
    size: 'medium',
    stats: [
      { label: 'Transactions', value: '24h' },
      { label: 'Gas Analytics', value: 'Live' },
      { label: 'Anomaly Detection', value: 'AI' },
    ],
  },
  {
    id: 'events',
    title: 'Event Streaming',
    description: 'Real-time on-chain event feed via WebSocket. Filter by type and monitor specific contracts.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    gradient: 'from-yellow-500/20 to-orange-500/20',
    size: 'medium',
  },
  {
    id: 'gas',
    title: 'Gas Analytics',
    description: 'Deep gas usage insights with function-level breakdown and historical trends.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    gradient: 'from-cyan-500/20 to-blue-500/20',
    size: 'large',
    chartData: [30, 45, 25, 60, 40, 55, 35, 70, 50, 65, 45, 80],
  },
  {
    id: 'actions',
    title: 'Web3 Actions',
    description: 'Programmable automation with event, block, and schedule-based triggers.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    gradient: 'from-purple-500/20 to-pink-500/20',
    size: 'medium',
    triggers: ['Event', 'Block', 'Schedule'],
  },
];

// Mini chart component
function MiniChart({ data }: { data: number[] }) {
  const maxValue = Math.max(...data);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, index) => (
        <div
          key={index}
          className="flex-1 bg-gradient-to-t from-primary-500/50 to-primary-400/30 rounded-t"
          style={{
            height: `${(value / maxValue) * 100}%`,
            animationDelay: `${index * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Capability Card Component
function CapabilityCard({
  capability,
  index,
  isVisible,
}: {
  capability: typeof capabilities[number];
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`feature-card p-6 ${capability.size === 'large' ? 'lg:col-span-2' : ''} ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${capability.gradient} flex items-center justify-center mb-4`}>
        <div className="text-primary-400">{capability.icon}</div>
      </div>

      {/* Title & Description */}
      <h3 className="text-xl font-semibold text-white mb-2">{capability.title}</h3>
      <p className="text-dark-400 text-sm leading-relaxed mb-4">{capability.description}</p>

      {/* Feature-specific content */}
      {capability.features && (
        <div className="flex flex-wrap gap-2">
          {capability.features.map((feature) => (
            <span
              key={feature}
              className="px-3 py-1 text-xs rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20"
            >
              {feature}
            </span>
          ))}
        </div>
      )}

      {capability.integrations && (
        <div className="flex gap-3">
          {capability.integrations.map((integration) => (
            <div
              key={integration.name}
              className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700/50 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-default"
              title={integration.name}
            >
              {integration.icon}
            </div>
          ))}
        </div>
      )}

      {capability.stats && (
        <div className="flex gap-4">
          {capability.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-lg font-bold text-white font-mono">{stat.value}</div>
              <div className="text-xs text-dark-500">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {capability.chartData && (
        <div className="mt-2">
          <MiniChart data={capability.chartData} />
        </div>
      )}

      {capability.triggers && (
        <div className="flex gap-2">
          {capability.triggers.map((trigger) => (
            <span
              key={trigger}
              className="px-3 py-1 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
            >
              {trigger}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CapabilitiesGrid() {
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
    <section id="features" ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[180px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 mb-6">
            <span className="text-xs font-medium text-dark-400 uppercase tracking-wider">Platform Features</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Everything You Need to{' '}
            <span className="gradient-text">Ship Confidently</span>
          </h2>
          <p className="text-lg text-dark-400 max-w-2xl mx-auto">
            A complete toolkit for Movement developers. From simulation to monitoring,
            we&apos;ve got you covered at every stage.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map((capability, index) => (
            <CapabilityCard
              key={capability.id}
              capability={capability}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
