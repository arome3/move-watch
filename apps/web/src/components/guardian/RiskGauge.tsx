'use client';

import { useEffect, useState } from 'react';
import type { RiskSeverity } from '@movewatch/shared';

interface RiskGaugeProps {
  score: number; // 0-100
  severity: RiskSeverity;
  showAnimation?: boolean;
}

const SEVERITY_CONFIG: Record<RiskSeverity, { color: string; glow: string; label: string }> = {
  LOW: {
    color: '#22c55e',
    glow: 'shadow-green-500/50',
    label: 'Low Risk',
  },
  MEDIUM: {
    color: '#eab308',
    glow: 'shadow-yellow-500/50',
    label: 'Medium Risk',
  },
  HIGH: {
    color: '#f97316',
    glow: 'shadow-orange-500/50',
    label: 'High Risk',
  },
  CRITICAL: {
    color: '#ef4444',
    glow: 'shadow-red-500/50',
    label: 'Critical Risk',
  },
};

export function RiskGauge({ score, severity, showAnimation = true }: RiskGaugeProps) {
  const [displayScore, setDisplayScore] = useState(showAnimation ? 0 : score);
  const config = SEVERITY_CONFIG[severity];

  // Animate score counting up
  useEffect(() => {
    if (!showAnimation) {
      setDisplayScore(score);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(interval);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [score, showAnimation]);

  // Calculate arc path
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      {/* Gauge SVG */}
      <div className="relative">
        <svg height={radius + 20} width={radius * 2 + 20} className="transform -rotate-90">
          {/* Background arc */}
          <circle
            stroke="#122840"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius + 10}
            cy={radius + 10}
            strokeDasharray={`${circumference} ${circumference}`}
            className="origin-center"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
          {/* Animated progress arc */}
          <circle
            stroke={config.color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius + 10}
            cy={radius + 10}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-300 origin-center ${config.glow}`}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              filter: `drop-shadow(0 0 8px ${config.color}40)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span
            className="text-4xl font-bold tabular-nums transition-colors duration-300"
            style={{ color: config.color }}
          >
            {displayScore}
          </span>
          <span className="text-xs text-dark-400 mt-1">Risk Score</span>
        </div>
      </div>

      {/* Severity badge */}
      <div
        className={`mt-4 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300
                   border ${severity === 'CRITICAL' ? 'animate-pulse' : ''}`}
        style={{
          color: config.color,
          borderColor: `${config.color}50`,
          backgroundColor: `${config.color}15`,
        }}
      >
        {config.label}
      </div>

      {/* Risk scale */}
      <div className="mt-4 flex items-center gap-1 w-full max-w-[180px]">
        <span className="text-[10px] text-dark-500">Safe</span>
        <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500 opacity-30" />
        <span className="text-[10px] text-dark-500">Danger</span>
      </div>
    </div>
  );
}

// Compact version for lists
export function RiskBadge({ severity, score }: { severity: RiskSeverity; score: number }) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-sm font-medium"
      style={{
        color: config.color,
        borderColor: `${config.color}40`,
        backgroundColor: `${config.color}10`,
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
      <span>{score}</span>
    </div>
  );
}
