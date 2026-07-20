import { Suspense } from 'react';
import LandingNav from '@/components/landing/landing-nav';
import LandingHero from '@/components/landing/landing-hero';
import LandingTrustedBy from '@/components/landing/landing-trusted-by';
import LandingFeatures from '@/components/landing/landing-features';
import LandingHowItWorks from '@/components/landing/landing-how-it-works';
import {
  LandingPricing,
  LandingTestimonials,
  LandingFAQ,
} from '@/components/landing/landing-sections';
import LandingFooter from '@/components/landing/landing-footer';
import { OAuthCallbackHandler } from '@/components/youtube/oauth-callback-handler';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <OAuthCallbackHandler />
      </Suspense>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingTrustedBy />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPricing />
        <LandingTestimonials />
        <LandingFAQ />
      </main>
      <LandingFooter />
    </div>
  );
}
