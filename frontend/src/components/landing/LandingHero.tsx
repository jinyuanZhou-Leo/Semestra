import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, LogIn } from 'lucide-react';

import GradientBlinds from '@/components/GradientBlinds';
import { Button } from '@/components/ui/button';

interface LandingHeroProps {
  reducedMotion: boolean;
}

export const LandingHero = ({ reducedMotion }: LandingHeroProps) => {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const foregroundY = useTransform(scrollYProgress, [0, 1], [0, -65]);

  const gradientColors = useMemo(
    () => ['#0b1020', '#1d4ed8', '#0ea5e9', '#fb923c', '#7c3aed'],
    [],
  );

  return (
    <section ref={heroRef} className="relative isolate min-h-screen overflow-hidden pb-8 md:pb-12">
      <motion.div aria-hidden className="absolute inset-0">
        <GradientBlinds
          gradientColors={gradientColors}
          blindMinWidth={80}
          blindCount={24}
          noise={0.3}
          followCursor={true}
          mouseDampening={0.8}
          distortAmount={1}
          spotlightRadius={0.6}
          spotlightSoftness={1.4}
          spotlightOpacity={1.2}
          filter="saturate(1.28) contrast(1.12) brightness(1.02)"
          mixBlendMode="screen"
        />
      </motion.div>

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.28),rgba(2,6,23,0.62))]"
      />

      <header className="relative z-10 pt-5 md:pt-6">
        <div className="mx-auto flex w-full max-w-[80rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/landing" className="landing-font-display inline-flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Semestra
          </Link>

          <Button asChild variant="outline" className="bg-background/70 backdrop-blur-md">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          </Button>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[80rem] gap-8 px-4 sm:px-6 min-h-[calc(100svh-7.25rem)] items-center md:min-h-[calc(100svh-8rem)] lg:px-8">
        <motion.div
          className="max-w-3xl space-y-6"
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={reducedMotion ? undefined : { y: foregroundY }}
        >
          <div className="space-y-3">
            <h1 className="landing-font-display text-balance text-5xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl">
              School feels lighter when everything lives in one place.
            </h1>
            <p className="landing-font-body max-w-xl text-pretty text-base leading-7 text-foreground/85 md:text-lg">
              Plan your week, finish tasks faster, and see progress without jumping between apps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm font-semibold shadow-lg shadow-primary/25">
              <Link to="/register">
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-full border-border/60 bg-background/70 px-6 backdrop-blur-md">
              <a href="#pillars">See how it works</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
