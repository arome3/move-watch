'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatedCounter } from './AnimatedCounter';

// Unique blockchain visualization - NOT a generic particle field
// This creates a stylized "transaction flow" visualization
function TransactionFlowViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Track mouse for interactive effect
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Transaction "block" class - stylized hexagonal nodes
    class Block {
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      size: number;
      opacity: number;
      pulsePhase: number;
      speed: number;
      trail: { x: number; y: number; opacity: number }[];

      constructor(width: number, height: number) {
        this.x = Math.random() * width;
        this.y = height + 50;
        this.targetX = this.x + (Math.random() - 0.5) * 200;
        this.targetY = -100;
        this.size = Math.random() * 8 + 4;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 0.5 + 0.3;
        this.trail = [];
      }

      update(time: number, width: number, height: number, mouseX: number, mouseY: number) {
        // Save trail
        this.trail.push({ x: this.x, y: this.y, opacity: this.opacity * 0.3 });
        if (this.trail.length > 15) this.trail.shift();

        // Move toward target with slight curve
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        // Mouse influence - blocks curve away from cursor
        const distToMouse = Math.sqrt(Math.pow(this.x - mouseX, 2) + Math.pow(this.y - mouseY, 2));
        if (distToMouse < 200) {
          const repelStrength = (200 - distToMouse) / 200 * 0.5;
          this.x += (this.x - mouseX) * repelStrength * 0.02;
        }

        this.x += dx * 0.002 * this.speed;
        this.y += dy * 0.008 * this.speed;

        // Pulse
        this.opacity = 0.3 + Math.sin(time * 0.003 + this.pulsePhase) * 0.2;

        // Reset when off screen
        if (this.y < -100) {
          this.y = height + 50;
          this.x = Math.random() * width;
          this.targetX = this.x + (Math.random() - 0.5) * 200;
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        // Draw trail
        this.trail.forEach((point, i) => {
          const trailOpacity = (i / this.trail.length) * point.opacity * 0.5;
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.size * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(58, 210, 200, ${trailOpacity})`;
          ctx.fill();
        });

        // Draw hexagonal block shape
        ctx.save();
        ctx.translate(this.x, this.y);

        // Outer glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
        gradient.addColorStop(0, `rgba(23, 133, 130, ${this.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(23, 133, 130, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-this.size * 2, -this.size * 2, this.size * 4, this.size * 4);

        // Hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const px = Math.cos(angle) * this.size;
          const py = Math.sin(angle) * this.size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(58, 210, 200, ${this.opacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(191, 161, 129, ${this.opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }
    }

    // Connection lines between nearby blocks
    class ConnectionLine {
      startBlock: Block;
      endBlock: Block;
      progress: number;
      active: boolean;

      constructor(start: Block, end: Block) {
        this.startBlock = start;
        this.endBlock = end;
        this.progress = 0;
        this.active = true;
      }

      update() {
        this.progress += 0.02;
        if (this.progress > 1) this.active = false;
      }

      draw(ctx: CanvasRenderingContext2D) {
        const dx = this.endBlock.x - this.startBlock.x;
        const dy = this.endBlock.y - this.startBlock.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 200) {
          this.active = false;
          return;
        }

        const currentX = this.startBlock.x + dx * this.progress;
        const currentY = this.startBlock.y + dy * this.progress;

        ctx.beginPath();
        ctx.moveTo(this.startBlock.x, this.startBlock.y);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = `rgba(191, 161, 129, ${0.3 * (1 - this.progress)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pulse at current position
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(191, 161, 129, ${0.8 * (1 - this.progress)})`;
        ctx.fill();
      }
    }

    // Create blocks
    const blocks: Block[] = [];
    const blockCount = 25;
    for (let i = 0; i < blockCount; i++) {
      blocks.push(new Block(canvas.width, canvas.height));
    }

    // Connection management
    let connections: ConnectionLine[] = [];
    let lastConnectionTime = 0;

    // Animation loop
    let time = 0;
    const animate = () => {
      time++;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Update and draw blocks
      blocks.forEach((block) => {
        block.update(time, width, height, mouseRef.current.x, mouseRef.current.y);
        block.draw(ctx);
      });

      // Create new connections occasionally
      if (time - lastConnectionTime > 30 && connections.length < 5) {
        const start = blocks[Math.floor(Math.random() * blocks.length)];
        const end = blocks[Math.floor(Math.random() * blocks.length)];
        if (start !== end) {
          connections.push(new ConnectionLine(start, end));
          lastConnectionTime = time;
        }
      }

      // Update and draw connections
      connections = connections.filter((c) => c.active);
      connections.forEach((c) => {
        c.update();
        c.draw(ctx);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10"
      style={{ opacity: 0.7 }}
    />
  );
}

// Magnetic button component with physics-based hover
function MagneticButton({
  children,
  href,
  className = '',
  variant = 'primary'
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Magnetic pull toward cursor
    const deltaX = (e.clientX - centerX) * 0.2;
    const deltaY = (e.clientY - centerY) * 0.2;

    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const baseStyles = variant === 'primary'
    ? 'bg-gradient-to-r from-primary-500 via-primary-400 to-primary-500 bg-[length:200%_100%] text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/40'
    : 'bg-dark-800/50 border border-dark-600 text-dark-300 hover:text-white hover:border-primary-500/50';

  return (
    <Link
      ref={buttonRef}
      href={href}
      className={`relative px-8 py-4 rounded-2xl font-semibold text-center transition-all duration-300 ${baseStyles} ${className}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Link>
  );
}

// Floating code snippet with typewriter effect - shows REAL code
function FloatingCodeSnippet() {
  const [visibleChars, setVisibleChars] = useState(0);
  const code = `movewatch simulate \\
  --function 0x1::coin::transfer \\
  --args '["0x7a3f...", 1000000]'

✓ Success | Gas: 847 | Events: 1`;

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= code.length) return prev;
        return prev + 1;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [code.length]);

  return (
    <div className="absolute -right-4 top-1/4 max-w-xs hidden xl:block animate-float-delayed">
      <div className="glass-panel p-4 font-mono text-xs leading-relaxed">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dark-700/50">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-dark-500">terminal</span>
        </div>
        <pre className="text-primary-300 whitespace-pre-wrap">
          {code.slice(0, visibleChars)}
          <span className="animate-blink text-gold-400">▌</span>
        </pre>
      </div>
    </div>
  );
}

// Stats with visual interest - not just numbers
function StatBlock({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="group relative">
      <div className={`text-3xl lg:text-4xl font-bold font-mono mb-1 transition-transform group-hover:scale-110 ${accent ? 'gradient-text' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-sm text-dark-500 group-hover:text-dark-400 transition-colors">{label}</div>
      {/* Underline accent on hover */}
      <div className="absolute -bottom-2 left-0 w-0 h-0.5 bg-gradient-to-r from-primary-500 to-gold-500 group-hover:w-full transition-all duration-300" />
    </div>
  );
}

export function Hero() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setIsVisible(true);

    // Parallax scroll effect
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Unique transaction flow background */}
      <TransactionFlowViz />

      {/* Gradient mesh - but more subtle and varied */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        {/* Top-left accent - gold tint */}
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(191, 161, 129, 0.15) 0%, transparent 70%)',
            transform: `translateY(${scrollY * 0.1}px)`,
          }}
        />
        {/* Bottom-right accent - primary tint */}
        <div
          className="absolute -bottom-20 -right-20 w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{
            background: 'radial-gradient(circle, rgba(23, 133, 130, 0.12) 0%, transparent 70%)',
            transform: `translateY(${-scrollY * 0.05}px)`,
          }}
        />
      </div>

      {/* Grid pattern - but diagonal for visual interest */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(23, 133, 130, 0.5) 1px, transparent 1px),
            linear-gradient(-45deg, rgba(23, 133, 130, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: `translateY(${scrollY * 0.02}px)`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 relative z-10 w-full">
        {/* ASYMMETRIC LAYOUT - Content offset to left, visual elements floating */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Main content - takes 7 columns, offset with negative margin for asymmetry */}
          <div
            className={`lg:col-span-7 lg:-ml-8 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
          >
            {/* Status badge - smaller, more refined */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-dark-300 font-medium tracking-wide">Movement Mainnet</span>
            </div>

            {/* Headline - Using display font with visual break */}
            <h1 className="mb-6">
              <span className="block text-display-xl text-white">
                Ship Move Code
              </span>
              <span className="block text-display-xl mt-2">
                <span className="gradient-text-shine">Without Fear</span>
              </span>
            </h1>

            {/* Tagline with visual rhythm */}
            <div className="flex items-center gap-4 mb-6 font-mono text-lg sm:text-xl">
              <span className="text-primary-400">Simulate</span>
              <span className="w-8 h-px bg-gradient-to-r from-primary-500 to-transparent" />
              <span className="text-gold-400">Secure</span>
              <span className="w-8 h-px bg-gradient-to-r from-gold-500 to-transparent" />
              <span className="text-primary-400">Automate</span>
            </div>

            {/* Description - shorter, punchier */}
            <p className="text-lg text-dark-400 mb-10 max-w-lg leading-relaxed">
              The essential toolkit for Movement developers. Test transactions,
              detect exploits, and automate everything—before you deploy.
            </p>

            {/* CTA Buttons - with magnetic effect */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <MagneticButton href="/auth/signin" variant="primary">
                <span className="flex items-center gap-2">
                  Start Building Free
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </MagneticButton>
              <MagneticButton href="/simulator" variant="secondary">
                Try the Simulator
              </MagneticButton>
            </div>

            {/* Stats - horizontal with visual separators */}
            <div className="flex flex-wrap items-center gap-8 lg:gap-12">
              <StatBlock value="50K+" label="Simulations" />
              <div className="hidden sm:block w-px h-12 bg-dark-700" />
              <StatBlock value="1M+" label="Events Tracked" />
              <div className="hidden sm:block w-px h-12 bg-dark-700" />
              <StatBlock value="23" label="Security Patterns" accent />
              <div className="hidden sm:block w-px h-12 bg-dark-700" />
              <StatBlock value="99.9%" label="Uptime" />
            </div>
          </div>

          {/* Right side - Visual terminal floating with depth */}
          <div
            className={`lg:col-span-5 relative ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{
              animationDelay: '200ms',
              transform: `translateY(${-scrollY * 0.08}px)`,
            }}
          >
            {/* Main terminal - tilted for visual interest */}
            <div
              className="relative"
              style={{ transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)' }}
            >
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary-500/20 via-transparent to-gold-500/10 rounded-3xl blur-2xl" />

              {/* Terminal */}
              <div className="relative glass-panel overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-dark-700/50 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs text-dark-500 font-mono">movewatch-cli</span>
                </div>

                {/* Content - animated transaction simulation */}
                <div className="p-6 font-mono text-sm space-y-3 min-h-[280px]">
                  <div className="text-dark-400">
                    <span className="text-gold-400">$</span> movewatch simulate
                  </div>
                  <div className="text-dark-500 text-xs">
                    → Connecting to Movement Mainnet...
                  </div>
                  <div className="h-px bg-dark-700/50 my-4" />

                  {/* Simulated result */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Simulation successful
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center p-3 rounded-lg bg-dark-800/50">
                        <div className="text-lg font-bold text-white">847</div>
                        <div className="text-xs text-dark-500">Gas</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-dark-800/50">
                        <div className="text-lg font-bold text-primary-400">2</div>
                        <div className="text-xs text-dark-500">Changes</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-dark-800/50">
                        <div className="text-lg font-bold text-gold-400">1</div>
                        <div className="text-xs text-dark-500">Event</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 text-dark-500 text-xs">
                    Share: <span className="text-primary-400">movewatch.dev/sim/a7x9k</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating code snippet */}
            <FloatingCodeSnippet />

            {/* Floating decorative elements */}
            <div
              className="absolute -bottom-8 -left-8 w-16 h-16 rounded-2xl glass-panel flex items-center justify-center animate-float"
              style={{ transform: `translateY(${scrollY * 0.05}px)` }}
            >
              <span className="text-2xl">🛡️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator - more refined */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
        <div className="w-5 h-9 rounded-full border border-dark-600 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-primary-400 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
