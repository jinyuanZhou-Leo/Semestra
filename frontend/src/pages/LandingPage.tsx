// input:  [landing section components, framer-motion scroll progress, reduced-motion preference]
// output: [`LandingPage` route component]
// pos:    [Public marketing route shown before authentication]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

import { LandingHero } from '@/components/landing/LandingHero';
import { LandingPillars } from '@/components/landing/LandingPillars';
import { LandingProof } from '@/components/landing/LandingProof';
import { SemesterDashboardMock } from '@/components/landing/ProgramDashboardMock';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const buildPlaceholderImage = (label: string, start: string, end: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${start}"/>
          <stop offset="100%" stop-color="${end}"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="720" fill="url(#bg)"/>
      <rect x="88" y="84" width="1424" height="552" rx="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" stroke-dasharray="18 14"/>
      <text x="800" y="360" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="64" font-family="DM Sans, sans-serif">${label}</text>
    </svg>`,
  )}`;

const placeholderRight = buildPlaceholderImage('Image Placeholder', '#1f2937', '#f97316');

export const LandingPage = () => {
  const reducedMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 30,
    mass: 0.2,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <main className="landing-font-body dark relative min-h-screen overflow-x-hidden bg-background text-foreground" style={{ colorScheme: 'dark' }}>
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[70] h-1 origin-left bg-gradient-to-r from-sky-500 via-indigo-500 to-orange-500"
        style={reducedMotion ? undefined : { scaleX: smoothProgress }}
      />
      <LandingHero reducedMotion={reducedMotion} />
      <motion.div
        className="my-6 md:my-10"
        initial={reducedMotion ? false : { opacity: 0, x: -72, y: 84, scale: 0.94, filter: 'blur(10px)' }}
        whileInView={reducedMotion ? {} : { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.3, margin: '0px 0px -6% 0px' }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <SemesterDashboardMock />
      </motion.div>
      <LandingPillars reducedMotion={reducedMotion} />
      <motion.img
        src={placeholderRight}
        alt="Landing placeholder"
        className="mx-auto my-6 h-auto w-[min(100%-2rem,72rem)] rounded-2xl border border-border/60 object-cover shadow-xl md:my-10"
        initial={reducedMotion ? false : { opacity: 0, x: 72, y: 84, scale: 0.94, filter: 'blur(10px)' }}
        whileInView={reducedMotion ? {} : { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.3, margin: '0px 0px -6% 0px' }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      />
      <LandingProof reducedMotion={reducedMotion} />

      <footer className="border-t border-border/70 py-8">
        <div className="landing-font-body mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-xs text-muted-foreground sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <p>Semestra</p>
          <p>Plan less. Finish more.</p>
        </div>
      </footer>
    </main>
  );
};
