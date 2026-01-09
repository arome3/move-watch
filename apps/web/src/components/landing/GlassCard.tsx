'use client';

import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'primary' | 'gold' | 'turquoise' | 'none';
  padding?: 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  className = '',
  hover = false,
  glow = 'none',
  padding = 'md',
}: GlassCardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const glowClasses = {
    none: '',
    primary: 'glow-primary',
    gold: 'glow-gold',
    turquoise: 'glow-turquoise',
  };

  return (
    <div
      className={`
        rounded-2xl bg-dark-800/40 backdrop-blur-md
        border border-dark-700/50
        ${hover ? 'hover:border-primary-500/50 hover:bg-dark-800/60 hover-lift cursor-pointer' : ''}
        ${glowClasses[glow]}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
