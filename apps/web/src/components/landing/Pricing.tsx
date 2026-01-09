'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const pricingTiers = [
  {
    name: 'Free',
    description: 'Essential tools for developers exploring Movement Network',
    price: '$0',
    period: '/month',
    cta: 'Start for Free',
    ctaLink: '/auth/signin',
    highlighted: false,
    features: [
      { text: '1 team member', included: true },
      { text: 'Community support', included: true },
      { text: '500 simulations/month', included: true },
      { text: '100 Guardian analyses/month', included: true },
      { text: '5 alert rules', included: true },
      { text: '3 automated actions', included: true },
      { text: 'Webhook notifications', included: true },
      { text: 'Basic API access', included: true },
    ],
  },
  {
    name: 'Starter',
    description: 'Full toolkit for indie developers and small projects',
    price: '$29',
    period: '/month',
    cta: 'Start Free Trial',
    ctaLink: '/auth/signin?plan=starter',
    highlighted: false,
    badge: 'Popular',
    features: [
      { text: '3 team members', included: true },
      { text: '<24h email support', included: true },
      { text: '5,000 simulations/month', included: true },
      { text: '1,000 Guardian analyses/month', included: true },
      { text: '25 alert rules', included: true },
      { text: '15 automated actions', included: true },
      { text: 'All notification channels', included: true },
      { text: 'Full API access', included: true },
    ],
  },
  {
    name: 'Pro',
    description: 'Scalable infrastructure for production dApps and teams',
    price: '$149',
    period: '/month',
    cta: 'Start Free Trial',
    ctaLink: '/auth/signin?plan=pro',
    highlighted: true,
    features: [
      { text: '10 team members', included: true },
      { text: '<2h priority support', included: true },
      { text: '50,000 simulations/month', included: true },
      { text: '10,000 Guardian analyses/month', included: true },
      { text: 'Unlimited alert rules', included: true },
      { text: 'Unlimited actions', included: true },
      { text: 'All channels + custom webhooks', included: true },
      { text: 'Advanced API + rate limits', included: true },
    ],
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large teams and protocols',
    price: 'Custom',
    period: '',
    cta: 'Contact Us',
    ctaLink: '/contact',
    highlighted: false,
    features: [
      { text: 'Unlimited team members', included: true },
      { text: '24/7 dedicated support', included: true },
      { text: 'Custom simulation limits', included: true },
      { text: 'Unlimited Guardian analyses', included: true },
      { text: 'Custom alert configurations', included: true },
      { text: 'Custom action workflows', included: true },
      { text: 'SLA guarantees', included: true },
      { text: 'On-premise deployment option', included: true },
    ],
  },
];

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function Pricing() {
  const [isVisible, setIsVisible] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(true);
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

  const getPrice = (tier: typeof pricingTiers[number]) => {
    if (tier.price === 'Custom' || tier.price === '$0') return tier.price;
    const monthlyPrice = parseInt(tier.price.replace('$', ''));
    const annualPrice = Math.round(monthlyPrice * 0.8); // 20% discount
    return billingAnnual ? `$${annualPrice}` : tier.price;
  };

  return (
    <section id="pricing" ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-12 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <h2 className="text-display-lg text-white mb-6">
            Simple, Transparent{' '}
            <span className="gradient-text">Pricing</span>
          </h2>
          <p className="text-lg text-dark-400 max-w-2xl mx-auto mb-8">
            Start free and scale as you grow. All plans include core features with generous limits.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 p-1 rounded-full bg-dark-800 border border-dark-700">
            <button
              onClick={() => setBillingAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !billingAnnual
                  ? 'bg-primary-500 text-white'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingAnnual
                  ? 'bg-primary-500 text-white'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div
          className={`grid md:grid-cols-2 lg:grid-cols-4 gap-6 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '100ms' }}
        >
          {pricingTiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-primary-500/10 to-dark-900 border-2 border-primary-500/50 shadow-glow-sm scale-105 lg:scale-110 z-10'
                  : 'bg-dark-900/50 border border-dark-800 hover:border-dark-700'
              }`}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary-500 text-white text-xs font-semibold">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="p-6 pb-0">
                <h3 className={`text-xl font-bold mb-2 ${tier.highlighted ? 'text-primary-400' : 'text-white'}`}>
                  {tier.name}
                </h3>
                <p className="text-sm text-dark-400 mb-6 min-h-[40px]">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{getPrice(tier)}</span>
                  <span className="text-dark-500">{tier.period}</span>
                  {billingAnnual && tier.price !== '$0' && tier.price !== 'Custom' && (
                    <div className="text-xs text-dark-500 mt-1">Billed annually</div>
                  )}
                </div>

                {/* CTA */}
                <Link
                  href={tier.ctaLink}
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${
                    tier.highlighted
                      ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-dark-800 hover:bg-dark-700 text-white border border-dark-700'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>

              {/* Divider */}
              <div className="px-6 py-4">
                <div className="h-px bg-dark-700" />
              </div>

              {/* Features */}
              <div className="p-6 pt-0 flex-1">
                <div className="text-xs text-dark-500 uppercase tracking-wider mb-4">
                  {index === 0 ? "What's included" : `All ${pricingTiers[index - 1]?.name || ''} features, plus:`}
                </div>
                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckIcon />
                      <span className="text-sm text-dark-300">{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Agent API Note */}
        <div
          className={`mt-16 ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '500ms' }}
        >
          <div className="glass-panel p-8 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 mb-4">
              <span className="text-xs font-medium text-gold-400 uppercase tracking-wider">For AI Agents</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">x402 Protocol for Autonomous Agents</h3>
            <p className="text-dark-400 mb-4">
              Building AI agents that need to simulate transactions? Our x402-compatible API allows agents
              to pay per simulation with MOVE tokens—no subscription required.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-primary-400 font-mono">0.001 MOVE</span>
                <span className="text-dark-500">per simulation</span>
              </div>
              <div className="h-4 w-px bg-dark-700" />
              <div className="flex items-center gap-2">
                <span className="text-primary-400 font-mono">0.005 MOVE</span>
                <span className="text-dark-500">per Guardian check</span>
              </div>
            </div>
            <Link
              href="/docs/x402"
              className="inline-flex items-center gap-2 mt-6 text-gold-400 font-medium hover:text-gold-300 transition-colors"
            >
              Learn about x402 integration
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* FAQ teaser */}
        <div
          className={`mt-12 text-center ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '600ms' }}
        >
          <p className="text-dark-500">
            Have questions?{' '}
            <Link href="/contact" className="text-primary-400 hover:text-primary-300 transition-colors">
              Contact our sales team
            </Link>
            {' '}or check out our{' '}
            <Link href="/docs/pricing" className="text-primary-400 hover:text-primary-300 transition-colors">
              pricing FAQ
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
