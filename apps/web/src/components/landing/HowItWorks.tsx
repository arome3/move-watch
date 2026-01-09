'use client';

import { useEffect, useRef, useState } from 'react';

const steps = [
  {
    number: 1,
    title: 'Connect',
    description: 'Link your Petra wallet or sign in with email. Get started in under 30 seconds.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: 'primary',
  },
  {
    number: 2,
    title: 'Configure',
    description: 'Set up alerts, actions, and monitoring for your contracts and wallets.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'gold',
  },
  {
    number: 3,
    title: 'Build',
    description: 'Simulate transactions, analyze security, and test safely before going live.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'primary',
  },
  {
    number: 4,
    title: 'Deploy',
    description: 'Ship with confidence knowing your contracts are monitored 24/7.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    color: 'gold',
  },
];

export function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
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

  // Auto-cycle through steps
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section id="how-it-works" ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-dark-900/50 to-dark-950" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-display-lg text-white mb-6">
            Get Started in{' '}
            <span className="gradient-text">Minutes</span>
          </h2>
          <p className="text-lg text-dark-400 max-w-2xl mx-auto">
            No complex setup required. Connect your wallet and start building immediately.
          </p>
        </div>

        {/* Steps - Desktop */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-20 left-0 right-0 h-px">
              <div className="h-full bg-dark-700" />
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 via-gold-500 to-primary-500 transition-all duration-500"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-4 gap-8">
              {steps.map((step, index) => {
                const isActive = index <= activeStep;
                const isCurrent = index === activeStep;

                return (
                  <div
                    key={step.number}
                    className={`relative text-center ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
                    style={{ animationDelay: `${index * 150}ms` }}
                    onClick={() => setActiveStep(index)}
                  >
                    {/* Step circle */}
                    <div className="relative mx-auto w-40 h-40 mb-6 cursor-pointer group">
                      {/* Outer ring */}
                      <div
                        className={`absolute inset-0 rounded-full transition-all duration-500 ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <div className={`absolute inset-0 rounded-full ${step.color === 'primary' ? 'bg-primary-500/20' : 'bg-gold-500/20'} blur-xl`} />
                      </div>

                      {/* Main circle */}
                      <div
                        className={`relative w-full h-full rounded-full flex items-center justify-center transition-all duration-500 ${
                          isActive
                            ? step.color === 'primary'
                              ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-glow-md'
                              : 'bg-gradient-to-br from-gold-500 to-gold-600 shadow-glow-gold'
                            : 'bg-dark-800 border-2 border-dark-700'
                        } ${isCurrent ? 'scale-110' : 'group-hover:scale-105'}`}
                      >
                        <div className={`transition-colors duration-500 ${isActive ? 'text-white' : 'text-dark-500'}`}>
                          {step.icon}
                        </div>
                      </div>

                      {/* Step number badge */}
                      <div
                        className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                          isActive
                            ? 'bg-dark-900 border-2 border-primary-500 text-primary-400'
                            : 'bg-dark-800 border-2 border-dark-600 text-dark-500'
                        }`}
                      >
                        {step.number}
                      </div>

                      {/* Pulse ring for current step */}
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-full border-2 border-primary-500/50 animate-ring-pulse" />
                      )}
                    </div>

                    {/* Content */}
                    <h3
                      className={`text-xl font-semibold mb-2 transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-dark-500'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={`text-sm leading-relaxed transition-colors duration-300 ${
                        isActive ? 'text-dark-400' : 'text-dark-600'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Steps - Mobile */}
        <div className="lg:hidden space-y-6">
          {steps.map((step, index) => {
            const isActive = index <= activeStep;

            return (
              <div
                key={step.number}
                className={`flex gap-4 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 150}ms` }}
                onClick={() => setActiveStep(index)}
              >
                {/* Step indicator */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? step.color === 'primary'
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-glow-sm'
                          : 'bg-gradient-to-br from-gold-500 to-gold-600 shadow-glow-gold'
                        : 'bg-dark-800 border-2 border-dark-700'
                    }`}
                  >
                    <div className={`w-5 h-5 ${isActive ? 'text-white' : 'text-dark-500'}`}>
                      {step.icon}
                    </div>
                  </div>

                  {/* Connecting line */}
                  {index < steps.length - 1 && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-px h-6">
                      <div
                        className={`w-full h-full transition-colors duration-300 ${
                          index < activeStep ? 'bg-primary-500' : 'bg-dark-700'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="pt-2 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium transition-colors duration-300 ${
                        isActive ? 'text-primary-400' : 'text-dark-600'
                      }`}
                    >
                      Step {step.number}
                    </span>
                  </div>
                  <h3
                    className={`text-lg font-semibold mb-1 transition-colors duration-300 ${
                      isActive ? 'text-white' : 'text-dark-500'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={`text-sm leading-relaxed transition-colors duration-300 ${
                      isActive ? 'text-dark-400' : 'text-dark-600'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
