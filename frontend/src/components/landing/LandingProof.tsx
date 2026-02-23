// input:  [reduced-motion flag, section/page scroll signals, scramble-text helper pipeline]
// output: [`LandingProof` component]
// pos:    [Landing proof/CTA section that demonstrates usage outcomes]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { LandingSection } from './LandingSection';

interface LandingProofProps {
  reducedMotion: boolean;
}

const focusLines = [
  'Know what is due this week',
  'Focus on next best task',
  'Track progress without extra setup',
] as const;

const adaptableLines = ['Adjust layout', 'Choose what you see', 'Add tools when needed'] as const;

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*@?+=';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const mapRangeToUnit = (value: number, start: number, end: number) => {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
};

const scrambleText = (text: string, revealRatio: number, seed: number) => {
  const ratio = clamp01(revealRatio);
  if (ratio >= 1) return text;

  const revealableCount = text.replace(/\s/g, '').length;
  const visibleChars = Math.floor(revealableCount * ratio);
  let resolvedChars = 0;

  return text
    .split('')
    .map((char, index) => {
      if (char === ' ') return char;
      if (resolvedChars < visibleChars) {
        resolvedChars += 1;
        return char;
      }
      const hash = Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233));
      const scrambleIndex = Math.floor(hash * SCRAMBLE_CHARS.length) % SCRAMBLE_CHARS.length;
      return SCRAMBLE_CHARS[scrambleIndex];
    })
    .join('');
};

export const LandingProof = ({ reducedMotion }: LandingProofProps) => {
  const isMobile = useIsMobile();
  const applyMotion = !reducedMotion && !isMobile;
  const proofRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: proofRef,
    offset: ['start end', 'end start'],
  });
  const { scrollYProgress: pageScrollYProgress } = useScroll();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [pageScrollProgress, setPageScrollProgress] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setScrollProgress(latest);
  });
  useMotionValueEvent(pageScrollYProgress, 'change', (latest) => {
    setPageScrollProgress(latest);
  });

  const leftCardX = useTransform(scrollYProgress, [0, 1], [-44, -8]);
  const leftCardY = useTransform(scrollYProgress, [0, 1], [36, -28]);
  const rightCardX = useTransform(scrollYProgress, [0, 1], [44, 8]);
  const rightCardY = useTransform(scrollYProgress, [0, 1], [32, -24]);
  const pageBottomReveal = mapRangeToUnit(clamp01(pageScrollProgress), 0.92, 0.985);
  const normalizedProgress = reducedMotion ? 1 : Math.max(clamp01(scrollProgress), pageBottomReveal);
  const leftDecodeProgress = mapRangeToUnit(normalizedProgress, 0.14, 0.58);
  const rightDecodeProgress = mapRangeToUnit(normalizedProgress, 0.42, 0.9);
  const leftDescription = scrambleText('A calm workspace that nudges everything into rhythm.', leftDecodeProgress, 11);
  const rightDescription = scrambleText('Start simple, then layer in what helps you move faster.', rightDecodeProgress, 23);

  return (
    <>
      <LandingSection
        id="experience"
        eyebrow="How it feels"
        title="Less chaos. More progress."
        description="See what matters now, decide faster, and finish work with less stress."
        reducedMotion={reducedMotion}
      >
        <div ref={proofRef} className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.32 }}
            style={
              !applyMotion
                ? undefined
                : {
                    x: leftCardX,
                    y: leftCardY,
                  }
            }
          >
            <Card className="flex h-full flex-col border-border/60 bg-card/75">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="landing-font-display text-2xl">From noise to momentum</CardTitle>
                <p className="landing-font-body text-sm text-muted-foreground">{leftDescription}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {focusLines.map((line, index) => (
                  <div key={line} className="landing-font-body inline-flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/45 px-3 py-2 text-sm text-foreground/85">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{scrambleText(line, leftDecodeProgress, 40 + index * 17)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.32 }}
            transition={{ delay: reducedMotion ? 0 : 0.08 }}
            style={
              !applyMotion
                ? undefined
                : {
                    x: rightCardX,
                    y: rightCardY,
                  }
            }
          >
            <Card className="flex h-full flex-col border-border/60 bg-card/75">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="landing-font-display text-2xl">Make it yours</CardTitle>
                <p className="landing-font-body text-sm text-muted-foreground">{rightDescription}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {adaptableLines.map((item, index) => (
                  <div key={item} className="landing-font-body inline-flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/45 px-3 py-2 text-sm text-foreground/85">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{scrambleText(item, rightDecodeProgress, 90 + index * 19)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </LandingSection>

      <section className="relative pb-20 pt-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Card className="relative overflow-hidden border-border/65 bg-gradient-to-r from-primary/10 via-background to-orange-500/12">
            <CardContent className="flex flex-col items-start justify-between gap-5 py-8 md:flex-row md:items-center">
              <div className="space-y-2">
                <p className="landing-font-display text-3xl font-semibold tracking-tight text-foreground">Ready to feel more in control this semester?</p>
                <p className="landing-font-body text-sm text-muted-foreground">Start free and set up your workspace in minutes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 rounded-full px-6">
                  <Link to="/register">
                    Start for free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
};
