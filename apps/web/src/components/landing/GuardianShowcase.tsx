'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const securityPatterns = [
  { id: 'rug', label: 'Rug Pull', risk: 'critical', angle: 0 },
  { id: 'exploit', label: 'Exploits', risk: 'high', angle: 45 },
  { id: 'perms', label: 'Permission', risk: 'medium', angle: 90 },
  { id: 'gas', label: 'Gas Anomaly', risk: 'low', angle: 135 },
  { id: 'reentry', label: 'Reentrancy', risk: 'high', angle: 180 },
  { id: 'overflow', label: 'Overflow', risk: 'medium', angle: 225 },
  { id: 'frontrun', label: 'Frontrun', risk: 'low', angle: 270 },
  { id: 'oracle', label: 'Oracle', risk: 'medium', angle: 315 },
];

const threatLevels = [
  { level: 'Critical', count: 0, color: 'bg-red-500', textColor: 'text-red-400' },
  { level: 'High', count: 0, color: 'bg-orange-500', textColor: 'text-orange-400' },
  { level: 'Medium', count: 0, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
  { level: 'Low', count: 0, color: 'bg-green-500', textColor: 'text-green-400' },
];

// Animated radar sweep
function RadarSweep() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 origin-center"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(191, 161, 129, 0.15) 30deg, transparent 60deg)',
          animation: 'spin 4s linear infinite',
        }}
      />
    </div>
  );
}

// Central shield with pulse
function CentralShield({ isScanning, patternsChecked }: { isScanning: boolean; patternsChecked: number }) {
  return (
    <div className="relative w-40 h-40 mx-auto">
      {/* Outer glow rings */}
      <div className={`absolute inset-0 rounded-full transition-all duration-700 ${isScanning ? 'animate-pulse' : ''}`}>
        <div className="absolute inset-0 rounded-full bg-gold-500/20 blur-2xl" />
        <div className="absolute inset-4 rounded-full bg-primary-500/30 blur-xl" />
      </div>

      {/* Main shield */}
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-dark-800 to-dark-900 border border-gold-500/30 flex items-center justify-center overflow-hidden">
        {/* Inner glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-gold-500/10 to-transparent" />

        {/* Shield icon */}
        <svg className="w-16 h-16 text-gold-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>

        {/* Scan line */}
        {isScanning && (
          <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent animate-scan-vertical" />
        )}
      </div>

      {/* Counter */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700">
        <span className="text-xs font-mono text-gold-400">{patternsChecked}/23</span>
      </div>
    </div>
  );
}

// Pattern node positioned around the shield
function PatternNode({
  pattern,
  isActive,
  isChecked,
  radius
}: {
  pattern: typeof securityPatterns[0];
  isActive: boolean;
  isChecked: boolean;
  radius: number;
}) {
  const angleRad = (pattern.angle - 90) * (Math.PI / 180);
  const x = Math.cos(angleRad) * radius;
  const y = Math.sin(angleRad) * radius;

  const riskColors = {
    critical: { bg: 'bg-red-500/20', border: 'border-red-500/40', dot: 'bg-red-500' },
    high: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', dot: 'bg-orange-500' },
    medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', dot: 'bg-yellow-500' },
    low: { bg: 'bg-green-500/20', border: 'border-green-500/40', dot: 'bg-green-500' },
  };

  const colors = riskColors[pattern.risk as keyof typeof riskColors];

  return (
    <div
      className={`absolute transition-all duration-500 ${isActive ? 'scale-110 z-10' : isChecked ? 'opacity-70' : 'opacity-30'}`}
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Connection line to center */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          width: radius,
          height: 2,
          transformOrigin: '0 50%',
          transform: `rotate(${pattern.angle + 180}deg)`,
        }}
      >
        <line
          x1="0"
          y1="1"
          x2={radius - 30}
          y2="1"
          className={`${isActive || isChecked ? 'stroke-gold-500/40' : 'stroke-dark-700'} transition-colors duration-300`}
          strokeWidth="1"
          strokeDasharray={isActive ? "none" : "4 4"}
        />
      </svg>

      {/* Node */}
      <div className={`relative px-3 py-1.5 rounded-lg ${colors.bg} border ${colors.border} backdrop-blur-sm whitespace-nowrap`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot} ${isActive ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-medium text-white">{pattern.label}</span>
        </div>
        {isActive && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-dark-400">
            Checking...
          </div>
        )}
      </div>
    </div>
  );
}

export function GuardianShowcase() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentPattern, setCurrentPattern] = useState(-1);
  const [checkedPatterns, setCheckedPatterns] = useState<Set<string>>(new Set());
  const [patternsCount, setPatternsCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-cycle through patterns when visible
  useEffect(() => {
    if (!isVisible) return;

    let patternIndex = 0;
    let count = 0;
    let isPaused = false;

    const scanInterval = setInterval(() => {
      // Skip if paused (during reset delay)
      if (isPaused) return;

      // Check if we've completed a full cycle
      if (count >= 23) {
        setScanComplete(true);
        isPaused = true;

        setTimeout(() => {
          setCheckedPatterns(new Set());
          setCurrentPattern(-1);
          setPatternsCount(0);
          setScanComplete(false);
          patternIndex = 0;
          count = 0;
          isPaused = false;
        }, 3000);
        return;
      }

      // Wrap around pattern index
      if (patternIndex >= securityPatterns.length) {
        patternIndex = 0;
      }

      // Update current pattern
      const currentId = securityPatterns[patternIndex].id;
      setCurrentPattern(patternIndex);
      setCheckedPatterns(prev => {
        const newSet = new Set(prev);
        newSet.add(currentId);
        return newSet;
      });

      // Increment pattern count
      count = Math.min(count + 3, 23);
      setPatternsCount(count);

      patternIndex++;
    }, 400);

    return () => clearInterval(scanInterval);
  }, [isVisible]);

  return (
    <section id="guardian" ref={ref} className="relative py-32 overflow-hidden">
      {/* UNIQUE BACKGROUND: Concentric circles grid */}
      <div className="absolute inset-0 -z-10">
        {/* Radial gradient base */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(191, 161, 129, 0.03) 0%, transparent 50%)',
          }}
        />

        {/* Concentric circles */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border border-gold-500"
              style={{
                width: `${i * 200}px`,
                height: `${i * 200}px`,
              }}
            />
          ))}
        </div>

        {/* Cross-hairs */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.05]">
          <div className="absolute w-px h-full bg-gold-500" />
          <div className="absolute w-full h-px bg-gold-500" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* UNIQUE LAYOUT: Centered radial design */}

        {/* Top header - centered but with offset accent */}
        <div className={`relative text-center mb-20 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="inline-block relative">
            {/* Floating badge - positioned offset */}
            <div className="absolute -top-8 -right-16 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 rotate-12">
              <span className="text-xs font-medium text-gold-400">Pillar Two</span>
            </div>

            <h2 className="text-display-lg text-white">
              Security That{' '}
              <span className="relative">
                <span className="gradient-text-warm">Never Sleeps</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M0 4 Q 50 8 100 4 T 200 4" stroke="url(#goldGradient)" strokeWidth="2" fill="none" />
                  <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#BFA181" stopOpacity="0" />
                      <stop offset="50%" stopColor="#BFA181" />
                      <stop offset="100%" stopColor="#BFA181" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h2>
          </div>

          <p className="mt-6 text-lg text-dark-400 max-w-2xl mx-auto">
            Guardian scans every transaction for 23 exploit patterns before you sign.
            AI-powered threat detection in under 50ms.
          </p>
        </div>

        {/* Main radar visualization - centered */}
        <div className={`relative mx-auto ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ width: '500px', height: '500px', animationDelay: '200ms' }}>
          {/* Radar sweep effect */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <RadarSweep />
          </div>

          {/* Circular track */}
          <div className="absolute inset-0 rounded-full border border-dark-700/50" />
          <div className="absolute inset-[60px] rounded-full border border-dark-700/30" />
          <div className="absolute inset-[120px] rounded-full border border-dark-700/20" />

          {/* Pattern nodes */}
          {securityPatterns.map((pattern) => (
            <PatternNode
              key={pattern.id}
              pattern={pattern}
              isActive={securityPatterns[currentPattern]?.id === pattern.id}
              isChecked={checkedPatterns.has(pattern.id)}
              radius={200}
            />
          ))}

          {/* Central shield */}
          <div className="absolute inset-0 flex items-center justify-center">
            <CentralShield isScanning={!scanComplete && isVisible} patternsChecked={patternsCount} />
          </div>

          {/* Completion overlay */}
          {scanComplete && (
            <div className="absolute inset-0 flex items-center justify-center animate-fade-in-up">
              <div className="glass-panel px-8 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-green-400">All Clear</div>
                  <div className="text-xs text-dark-400">No threats detected</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom stats - asymmetric cards */}
        <div className={`mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
          {threatLevels.map((threat, index) => (
            <div
              key={threat.level}
              className="relative p-4 rounded-xl bg-dark-900/50 border border-dark-800 group hover:border-dark-700 transition-colors"
              style={{ transform: index % 2 === 0 ? 'translateY(0)' : 'translateY(8px)' }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${threat.color}`} />
                <div>
                  <div className={`text-2xl font-bold ${threat.textColor}`}>{threat.count}</div>
                  <div className="text-xs text-dark-500">{threat.level}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={`mt-12 text-center ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
          <Link
            href="/guardian"
            className="inline-flex items-center gap-2 text-gold-400 font-medium hover:text-gold-300 transition-colors group"
          >
            Explore Guardian Security
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
