import {
  Hero,
  TrustBar,
  SimulatorShowcase,
  GuardianShowcase,
  AutomationShowcase,
  SupportingFeatures,
  HowItWorks,
  Pricing,
  CLIComingSoon,
  CTASection,
  Footer,
} from '@/components/landing';

// Visual divider between sections
function SectionDivider({ variant = 'gradient' }: { variant?: 'gradient' | 'dots' | 'wave' }) {
  if (variant === 'dots') {
    return (
      <div className="relative py-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500/40" />
          <div className="w-2 h-2 rounded-full bg-primary-500/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500/40" />
        </div>
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div className="wave-divider h-20 bg-dark-900/50" />
    );
  }

  return (
    <div className="relative py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-dark-700 to-transparent" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Hero with "Simulate. Secure. Automate." tagline */}
      <Hero />
      <TrustBar />

      {/* The Three Pillars with visual breaks */}
      <SimulatorShowcase />      {/* Pillar 1: Simulate */}
      <SectionDivider variant="dots" />
      <GuardianShowcase />       {/* Pillar 2: Secure */}
      <SectionDivider variant="dots" />
      <AutomationShowcase />     {/* Pillar 3: Automate (Alerts + Actions) */}

      {/* Supporting Features */}
      <SectionDivider />
      <SupportingFeatures />

      {/* Conversion Sections */}
      <HowItWorks />
      <Pricing />
      <CLIComingSoon />
      <CTASection />
      <Footer />
    </>
  );
}
