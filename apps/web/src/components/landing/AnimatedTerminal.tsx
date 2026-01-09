'use client';

import { useEffect, useState, useRef } from 'react';

const terminalLines = [
  { type: 'command', text: '$ movewatch simulate --function 0x1::coin::transfer' },
  { type: 'info', text: 'Simulating on Movement Mainnet...' },
  { type: 'empty', text: '' },
  { type: 'success', text: 'Simulation successful' },
  { type: 'result', text: 'Gas Used: 847 units' },
  { type: 'result', text: 'State Changes: 2 resources modified' },
  { type: 'result', text: 'Events: 1 TransferEvent emitted' },
  { type: 'empty', text: '' },
  { type: 'link', text: 'Share: https://movewatch.dev/sim/abc123' },
];

export function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const currentLine = terminalLines[visibleLines];

    if (!currentLine) {
      // Animation complete, restart after delay
      const restartTimeout = setTimeout(() => {
        setVisibleLines(0);
        setCurrentChar(0);
        setIsTyping(true);
      }, 3000);
      return () => clearTimeout(restartTimeout);
    }

    if (currentLine.type === 'command' && isTyping) {
      // Type out command character by character
      if (currentChar < currentLine.text.length) {
        const timeout = setTimeout(() => {
          setCurrentChar((prev) => prev + 1);
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        // Finished typing command
        const timeout = setTimeout(() => {
          setIsTyping(false);
          setVisibleLines((prev) => prev + 1);
          setCurrentChar(0);
        }, 500);
        return () => clearTimeout(timeout);
      }
    } else {
      // Show other lines instantly with delay
      const delay = currentLine.type === 'empty' ? 100 : 300;
      const timeout = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [isVisible, visibleLines, currentChar, isTyping]);

  const getLineColor = (type: string) => {
    switch (type) {
      case 'command':
        return 'text-dark-100';
      case 'info':
        return 'text-dark-400';
      case 'success':
        return 'text-green-400';
      case 'result':
        return 'text-primary-400';
      case 'link':
        return 'text-gold-400';
      default:
        return 'text-dark-300';
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Terminal window */}
      <div className="rounded-xl overflow-hidden border border-dark-700/50 bg-dark-900/80 backdrop-blur-sm shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-dark-800/50 border-b border-dark-700/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-dark-500 ml-2 font-mono">terminal</span>
        </div>

        {/* Terminal content */}
        <div className="p-4 font-mono text-sm min-h-[240px]">
          {terminalLines.slice(0, visibleLines).map((line, index) => (
            <div key={index} className={`${getLineColor(line.type)} leading-relaxed`}>
              {line.text}
            </div>
          ))}

          {/* Currently typing line */}
          {isTyping && visibleLines < terminalLines.length && terminalLines[visibleLines].type === 'command' && (
            <div className="text-dark-100 leading-relaxed">
              {terminalLines[visibleLines].text.slice(0, currentChar)}
              <span className="animate-blink">|</span>
            </div>
          )}

          {/* Cursor when idle */}
          {!isTyping && visibleLines >= terminalLines.length && (
            <div className="text-dark-100 leading-relaxed mt-1">
              $ <span className="animate-blink">|</span>
            </div>
          )}
        </div>
      </div>

      {/* Glow effect behind terminal */}
      <div className="absolute -inset-4 -z-10 bg-gradient-to-r from-primary-500/20 via-gold-500/20 to-primary-400/20 blur-3xl opacity-50" />
    </div>
  );
}
