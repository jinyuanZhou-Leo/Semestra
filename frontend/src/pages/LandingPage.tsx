// input:  [landing section components, reduced-motion preference]
// output: [`LandingPage` route component]
// pos:    [Public marketing route shown before authentication]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useEffect } from 'react';

import { LandingHero } from '@/components/landing/LandingHero';
import { LandingScrollytelling } from '@/components/landing/LandingScrollytelling';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export const LandingPage = () => {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <main className="landing-font-body relative min-h-screen bg-background text-foreground">
      <LandingHero reducedMotion={reducedMotion} />
      
      <div id="scrollytelling">
        <LandingScrollytelling />
      </div>

      <footer className="border-t border-border/70 py-8 relative z-10 bg-background">
        <div className="landing-font-body mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-xs text-muted-foreground sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <p>Semestra</p>
          <p>Plan less. Finish more.</p>
        </div>
      </footer>
    </main>
  );
};
