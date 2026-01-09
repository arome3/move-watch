import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // MoveWatch brand colors - Turquoise primary
        primary: {
          50: '#ecfdfb',
          100: '#d1faf6',
          200: '#a8f3ec',
          300: '#71e7de',
          400: '#3ad2c8',
          500: '#178582',
          600: '#146e6b',
          700: '#155857',
          800: '#164646',
          900: '#173b3b',
        },
        // Gold accent palette
        gold: {
          50: '#fdfaf5',
          100: '#faf3e8',
          200: '#f4e4cb',
          300: '#edd0a8',
          400: '#e3b883',
          500: '#BFA181',
          600: '#a88a6a',
          700: '#8c7155',
          800: '#745c46',
          900: '#604c3a',
        },
        // Dark classic blue background palette
        dark: {
          50: '#F5F8FB',
          100: '#E2EAF2',
          200: '#B8CADC',
          300: '#8AA2BC',
          400: '#5A7A9C',
          500: '#3A5A7C',
          600: '#254565',
          700: '#1A3550',
          800: '#122840',
          900: '#0D1F32',
          950: '#0A1828',
        },
        // Accent shortcuts
        accent: {
          gold: '#BFA181',
          highlight: '#e3b883',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        display: ['Clash Display', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-x': 'gradient-x 15s ease infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-scale': 'fadeInScale 0.5s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'typing': 'typing 4s steps(40) infinite',
        'blink': 'blink 1s step-end infinite',
        'scan': 'scan 2s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'shimmer-slow': 'shimmer 3s linear infinite',
        'draw': 'draw 1.5s ease-out forwards',
        'particle-drift': 'particleDrift 20s linear infinite',
        'particle-float': 'particleFloat 15s ease-in-out infinite',
        'hex-pulse': 'hexPulse 3s ease-in-out infinite',
        'ring-pulse': 'ringPulse 2s ease-out infinite',
        'data-flow': 'dataFlow 3s linear infinite',
        'orbit': 'orbit 20s linear infinite',
        'orbit-reverse': 'orbit 25s linear infinite reverse',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'counter': 'counter 2s ease-out forwards',
        'typewriter': 'typewriter 2s steps(40) forwards',
        'cursor-blink': 'cursorBlink 0.8s step-end infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'wave': 'wave 2.5s ease-in-out infinite',
        // Scroll-triggered reveal animations
        'reveal-up': 'revealUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-left': 'revealLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-right': 'revealRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-scale': 'revealScale 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-blur': 'revealBlur 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        // Stagger effects
        'stagger-1': 'revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards',
        'stagger-2': 'revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
        'stagger-3': 'revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
        'stagger-4': 'revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards',
        // 3D effects
        'tilt-in': 'tiltIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'parallax-slow': 'parallaxFloat 20s ease-in-out infinite',
        'parallax-medium': 'parallaxFloat 15s ease-in-out infinite reverse',
        'grain': 'grain 8s steps(10) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(23, 133, 130, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(23, 133, 130, 0.6)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(23, 133, 130, 0.4), 0 0 40px rgba(23, 133, 130, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(23, 133, 130, 0.6), 0 0 60px rgba(23, 133, 130, 0.3)' },
        },
        typing: {
          '0%': { width: '0' },
          '50%': { width: '100%' },
          '100%': { width: '100%' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        draw: {
          '0%': { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: '0%' },
        },
        particleDrift: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(10px, -10px) rotate(90deg)' },
          '50%': { transform: 'translate(0, -20px) rotate(180deg)' },
          '75%': { transform: 'translate(-10px, -10px) rotate(270deg)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg)' },
        },
        particleFloat: {
          '0%, 100%': { transform: 'translate(0, 0)', opacity: '0.5' },
          '25%': { transform: 'translate(20px, -30px)', opacity: '0.8' },
          '50%': { transform: 'translate(-10px, -50px)', opacity: '0.6' },
          '75%': { transform: 'translate(-30px, -20px)', opacity: '0.9' },
        },
        hexPulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.05)' },
        },
        ringPulse: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        dataFlow: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(100px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(100px) rotate(-360deg)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        counter: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typewriter: {
          '0%': { width: '0', borderRight: '2px solid' },
          '100%': { width: '100%', borderRight: '2px solid' },
        },
        cursorBlink: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'currentColor' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(20deg)' },
          '75%': { transform: 'rotate(-15deg)' },
        },
        // Scroll reveal keyframes
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(60px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        revealLeft: {
          '0%': { opacity: '0', transform: 'translateX(-60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        revealRight: {
          '0%': { opacity: '0', transform: 'translateX(60px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        revealScale: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        revealBlur: {
          '0%': { opacity: '0', filter: 'blur(10px)', transform: 'translateY(20px)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
        tiltIn: {
          '0%': { opacity: '0', transform: 'perspective(1000px) rotateX(-10deg) translateY(20px)' },
          '100%': { opacity: '1', transform: 'perspective(1000px) rotateX(0) translateY(0)' },
        },
        parallaxFloat: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-15px) rotate(1deg)' },
          '50%': { transform: 'translateY(-5px) rotate(-1deg)' },
          '75%': { transform: 'translateY(-20px) rotate(0.5deg)' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -10%)' },
          '20%': { transform: 'translate(-15%, 5%)' },
          '30%': { transform: 'translate(7%, -25%)' },
          '40%': { transform: 'translate(-5%, 25%)' },
          '50%': { transform: 'translate(-15%, 10%)' },
          '60%': { transform: 'translate(15%, 0%)' },
          '70%': { transform: 'translate(0%, 15%)' },
          '80%': { transform: 'translate(3%, 35%)' },
          '90%': { transform: 'translate(-10%, 10%)' },
        },
      },
      backgroundSize: {
        '200%': '200% 200%',
        '300%': '300% 300%',
        '400%': '400% 400%',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hex-pattern': `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23178582' stroke-opacity='0.1' stroke-width='1'/%3E%3C/svg%3E")`,
        'grid-pattern': `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23178582' stroke-opacity='0.05'%3E%3Cpath d='M0 20h40M20 0v40'/%3E%3C/g%3E%3C/svg%3E")`,
        'dot-pattern': `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1' fill='%23178582' fill-opacity='0.1'/%3E%3C/svg%3E")`,
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(23, 133, 130, 0.3)',
        'glow-md': '0 0 30px rgba(23, 133, 130, 0.4)',
        'glow-lg': '0 0 50px rgba(23, 133, 130, 0.5)',
        'glow-xl': '0 0 80px rgba(23, 133, 130, 0.6)',
        'glow-gold': '0 0 30px rgba(191, 161, 129, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(23, 133, 130, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(23, 133, 130, 0.1)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.4), 0 0 60px rgba(23, 133, 130, 0.2)',
      },
      blur: {
        'xs': '2px',
        '4xl': '72px',
        '5xl': '100px',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      scale: {
        '102': '1.02',
        '103': '1.03',
      },
    },
  },
  plugins: [],
};

export default config;
