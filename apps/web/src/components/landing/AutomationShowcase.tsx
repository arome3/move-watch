'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const triggers = [
  { id: 'event', label: 'Events', icon: '⚡', desc: 'On-chain activity' },
  { id: 'threshold', label: 'Thresholds', icon: '📊', desc: 'Value conditions' },
  { id: 'schedule', label: 'Schedule', icon: '⏰', desc: 'Time-based' },
];

const alertTypes = [
  { id: 'tx_failed', label: 'TX Failed', color: 'border-red-500/40 bg-red-500/10' },
  { id: 'balance', label: 'Balance', color: 'border-gold-500/40 bg-gold-500/10' },
  { id: 'event', label: 'Event', color: 'border-primary-500/40 bg-primary-500/10' },
  { id: 'gas', label: 'Gas Spike', color: 'border-orange-500/40 bg-orange-500/10' },
];

const channels = [
  { id: 'discord', label: 'Discord', color: '#5865F2' },
  { id: 'slack', label: 'Slack', color: '#4A154B' },
  { id: 'telegram', label: 'Telegram', color: '#0088cc' },
  { id: 'webhook', label: 'Webhook', color: '#10B981' },
  { id: 'email', label: 'Email', color: '#EC4899' },
];

// Animated data particle flowing through the pipeline
function DataParticle({ delay, path }: { delay: number; path: 'left' | 'right' }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-primary-400 animate-flow-particle"
      style={{
        animationDelay: `${delay}s`,
        left: path === 'left' ? '0%' : 'auto',
        right: path === 'right' ? '0%' : 'auto',
      }}
    />
  );
}

// Central processing hub animation
function ProcessingHub({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative">
      {/* Outer ring */}
      <div className={`absolute inset-0 rounded-full border-2 ${isActive ? 'border-primary-500/50 animate-spin-slow' : 'border-dark-700'}`}>
        {/* Orbit dots */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary-400" />
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gold-400" />
      </div>

      {/* Inner content */}
      <div className="relative w-32 h-32 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-1">🎯</div>
          <div className="text-xs text-dark-400 font-medium">Processing</div>
        </div>

        {/* Pulse effect */}
        {isActive && (
          <div className="absolute inset-0 rounded-full border-2 border-primary-500/30 animate-ping" style={{ animationDuration: '2s' }} />
        )}
      </div>
    </div>
  );
}

// Flowing connection line with animated particles
function FlowLine({ direction, isActive }: { direction: 'in' | 'out'; isActive: boolean }) {
  return (
    <div className={`relative h-1 flex-1 ${direction === 'in' ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-dark-700 via-primary-500/50 to-dark-700`}>
      {isActive && (
        <>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-400 shadow-glow-sm"
            style={{
              animation: `flow-${direction} 2s ease-in-out infinite`,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gold-400 shadow-glow-gold"
            style={{
              animation: `flow-${direction} 2s ease-in-out infinite`,
              animationDelay: '1s',
            }}
          />
        </>
      )}
    </div>
  );
}

export function AutomationShowcase() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState(0);
  const [activeOutput, setActiveOutput] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-cycle through triggers and outputs
  useEffect(() => {
    if (!isVisible) return;

    const triggerInterval = setInterval(() => {
      setActiveTrigger((prev) => (prev + 1) % triggers.length);
    }, 2500);

    const outputInterval = setInterval(() => {
      setActiveOutput((prev) => (prev + 1) % (alertTypes.length + channels.length));
    }, 1500);

    return () => {
      clearInterval(triggerInterval);
      clearInterval(outputInterval);
    };
  }, [isVisible]);

  return (
    <section id="automate" ref={ref} className="relative py-32 overflow-hidden">
      {/* UNIQUE BACKGROUND: Dot matrix grid */}
      <div className="absolute inset-0 -z-10">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(23, 133, 130, 0.4) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Horizontal flow lines */}
        <div className="absolute inset-0">
          {[0.3, 0.5, 0.7].map((pos) => (
            <div
              key={pos}
              className="absolute h-px w-full bg-gradient-to-r from-transparent via-primary-500/10 to-transparent"
              style={{ top: `${pos * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* UNIQUE LAYOUT: Header with side accent */}
        <div className={`relative mb-20 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            {/* Main header - takes 8 cols */}
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <span className="text-sm">⚡</span>
                </div>
                <span className="text-xs font-medium text-primary-400 uppercase tracking-wider">Pillar Three</span>
              </div>

              <h2 className="text-display-lg text-white">
                Event-Driven{' '}
                <span className="gradient-text">Automation</span>
              </h2>
            </div>

            {/* Side description - takes 4 cols, aligned bottom */}
            <div className="lg:col-span-4 lg:pb-2">
              <p className="text-dark-400 text-sm leading-relaxed">
                When something happens on-chain, get notified instantly or trigger automated responses.
                Configure once, run forever.
              </p>
            </div>
          </div>
        </div>

        {/* Main flow visualization - horizontal pipeline */}
        <div className={`relative ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
          {/* Desktop: Three column flow */}
          <div className="hidden lg:flex items-center justify-between gap-4">
            {/* Left: Triggers (input) */}
            <div className="flex-1">
              <div className="text-xs text-dark-500 uppercase tracking-wider mb-4 text-right pr-4">Triggers</div>
              <div className="space-y-3">
                {triggers.map((trigger, index) => (
                  <div
                    key={trigger.id}
                    className={`relative flex items-center justify-end gap-3 p-4 rounded-xl border transition-all duration-500 ${
                      activeTrigger === index
                        ? 'bg-primary-500/10 border-primary-500/40 scale-105'
                        : 'bg-dark-900/50 border-dark-800 opacity-60'
                    }`}
                  >
                    <div className="text-right">
                      <div className="font-medium text-white">{trigger.label}</div>
                      <div className="text-xs text-dark-500">{trigger.desc}</div>
                    </div>
                    <span className="text-2xl">{trigger.icon}</span>

                    {/* Active indicator line */}
                    {activeTrigger === index && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-8 h-0.5 bg-primary-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Flow line in */}
            <FlowLine direction="in" isActive={isVisible} />

            {/* Center: Processing Hub */}
            <div className="flex-shrink-0">
              <ProcessingHub isActive={isVisible} />
            </div>

            {/* Flow line out */}
            <FlowLine direction="out" isActive={isVisible} />

            {/* Right: Outputs (alerts + channels) */}
            <div className="flex-1">
              <div className="text-xs text-dark-500 uppercase tracking-wider mb-4 pl-4">Outputs</div>

              {/* Split into alerts and channels */}
              <div className="grid grid-cols-2 gap-3">
                {/* Alert Types */}
                <div className="space-y-2">
                  <div className="text-[10px] text-dark-600 uppercase tracking-wider mb-2">Alerts</div>
                  {alertTypes.map((alert, index) => (
                    <div
                      key={alert.id}
                      className={`px-3 py-2 rounded-lg border transition-all duration-300 ${alert.color} ${
                        activeOutput === index ? 'scale-105 opacity-100' : 'opacity-50'
                      }`}
                    >
                      <span className="text-xs font-medium text-white">{alert.label}</span>
                    </div>
                  ))}
                </div>

                {/* Channels */}
                <div className="space-y-2">
                  <div className="text-[10px] text-dark-600 uppercase tracking-wider mb-2">Channels</div>
                  {channels.map((channel, index) => (
                    <div
                      key={channel.id}
                      className={`px-3 py-2 rounded-lg border border-dark-700 transition-all duration-300 ${
                        activeOutput === alertTypes.length + index ? 'scale-105 opacity-100' : 'opacity-50'
                      }`}
                      style={{
                        background: activeOutput === alertTypes.length + index ? `${channel.color}20` : undefined,
                        borderColor: activeOutput === alertTypes.length + index ? `${channel.color}60` : undefined,
                      }}
                    >
                      <span className="text-xs font-medium text-white">{channel.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Vertical flow */}
          <div className="lg:hidden">
            {/* Triggers */}
            <div className="mb-8">
              <div className="text-xs text-dark-500 uppercase tracking-wider mb-4">Triggers</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {triggers.map((trigger, index) => (
                  <div
                    key={trigger.id}
                    className={`flex-shrink-0 p-4 rounded-xl border transition-all ${
                      activeTrigger === index
                        ? 'bg-primary-500/10 border-primary-500/40'
                        : 'bg-dark-900/50 border-dark-800 opacity-60'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{trigger.icon}</span>
                    <div className="font-medium text-white text-sm">{trigger.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow down */}
            <div className="flex justify-center mb-8">
              <div className="w-px h-12 bg-gradient-to-b from-primary-500/50 to-gold-500/50 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                  <svg className="w-4 h-4 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 16l-6-6h12l-6 6z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Processing */}
            <div className="flex justify-center mb-8">
              <ProcessingHub isActive={isVisible} />
            </div>

            {/* Arrow down */}
            <div className="flex justify-center mb-8">
              <div className="w-px h-12 bg-gradient-to-b from-primary-500/50 to-gold-500/50 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                  <svg className="w-4 h-4 text-gold-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 16l-6-6h12l-6 6z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Outputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-dark-500 uppercase tracking-wider mb-3">Alerts</div>
                <div className="space-y-2">
                  {alertTypes.map((alert) => (
                    <div key={alert.id} className={`px-3 py-2 rounded-lg border ${alert.color}`}>
                      <span className="text-xs font-medium text-white">{alert.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-dark-500 uppercase tracking-wider mb-3">Channels</div>
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="px-3 py-2 rounded-lg border border-dark-700 bg-dark-800/50"
                    >
                      <span className="text-xs font-medium text-white">{channel.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar - horizontal with staggered heights */}
        <div className={`mt-20 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
          <div className="flex items-end justify-center gap-6">
            <div className="text-center p-6 rounded-2xl bg-dark-900/50 border border-dark-800" style={{ transform: 'translateY(-8px)' }}>
              <div className="text-3xl font-bold text-primary-400 font-mono">4</div>
              <div className="text-xs text-dark-500 mt-1">Alert Types</div>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-900/50 border border-dark-800">
              <div className="text-3xl font-bold text-gold-400 font-mono">5</div>
              <div className="text-xs text-dark-500 mt-1">Channels</div>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-900/50 border border-dark-800" style={{ transform: 'translateY(-16px)' }}>
              <div className="text-3xl font-bold text-white font-mono">3</div>
              <div className="text-xs text-dark-500 mt-1">Trigger Types</div>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-900/50 border border-dark-800" style={{ transform: 'translateY(-4px)' }}>
              <div className="text-3xl font-bold text-primary-400 font-mono">&lt;1s</div>
              <div className="text-xs text-dark-500 mt-1">Latency</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`mt-12 text-center ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
          <Link
            href="/alerts"
            className="inline-flex items-center gap-2 text-primary-400 font-medium hover:text-primary-300 transition-colors group"
          >
            Configure Automations
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* CSS for flow animations */}
      <style jsx>{`
        @keyframes flow-in {
          0% { left: 0; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: calc(100% - 12px); opacity: 0; }
        }
        @keyframes flow-out {
          0% { right: calc(100% - 12px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { right: 0; opacity: 0; }
        }
      `}</style>
    </section>
  );
}
