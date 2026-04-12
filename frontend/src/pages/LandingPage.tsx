// input:  [landing section components, reduced-motion preference]
// output: [`LandingPage` route component]
// pos:    [Public marketing route shown before authentication]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

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



      {/* Expanded Footer */}
      <footer className="border-t border-border/70 py-12 relative z-10 bg-background">
        <div className="landing-font-body mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-6">
             <div className="flex flex-col items-center md:items-start gap-2">
                 <span className="font-bold text-lg tracking-tight">Semestra</span>
                 <p className="text-sm text-muted-foreground text-center md:text-left max-w-xs">The unified operating system for your academic life.</p>
             </div>
             
             <div className="flex gap-8 text-sm text-muted-foreground">
                 <a href="https://github.com/jinyuanZhou-Leo/Semestra" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
             </div>
          </div>
          
          <div className="border-t border-border/50 pt-8 flex items-center justify-center text-xs text-muted-foreground">
             <p>© {new Date().getFullYear()} Semestra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
};
