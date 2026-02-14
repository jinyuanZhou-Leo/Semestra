import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, BookOpen, GraduationCap, LogIn, Percent, Search } from 'lucide-react';

import GradientBlinds from '@/components/GradientBlinds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface LandingHeroProps {
  reducedMotion: boolean;
}

export const LandingHero = ({ reducedMotion }: LandingHeroProps) => {
  const isMobile = useIsMobile();
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const foregroundY = useTransform(scrollYProgress, [0, 1], [0, -65]);
  const rightCardY = useTransform(scrollYProgress, [0, 1], [0, -72]);
  const rightCardRotate = useTransform(scrollYProgress, [0, 1], [0, -10]);
  const smoothCardY = useSpring(rightCardY, { stiffness: 110, damping: 18, mass: 0.25 });
  const smoothCardRotate = useSpring(rightCardRotate, { stiffness: 110, damping: 18, mass: 0.25 });
  const shouldAnimatePreview = !reducedMotion && !isMobile;

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

      <div className="relative z-10 mx-auto grid w-full max-w-[80rem] gap-8 px-4 sm:px-6 min-h-[calc(100svh-7.25rem)] items-center md:min-h-[calc(100svh-8rem)] md:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
        <motion.div
          className="space-y-6"
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

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 36, scale: 0.97 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={
            !shouldAnimatePreview
              ? undefined
              : {
                y: smoothCardY,
                rotateX: -3,
                rotateY: smoothCardRotate,
              }
          }
          className="origin-bottom mx-auto w-full min-w-0 max-w-[34rem] md:max-w-[39rem] lg:justify-self-end lg:max-w-[49rem] [transform-style:preserve-3d]"
        >
          <Card className="w-full min-w-0 overflow-hidden border-border/50 bg-background/72 shadow-2xl backdrop-blur-xl">
            <CardHeader className="pb-3 md:pb-4">
              <CardTitle className="landing-font-display text-xl font-semibold text-foreground">Program Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-w-0 overflow-hidden md:space-y-4">
              <section className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold tracking-tight">Overview</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Card className="min-w-0 border-border/60 bg-background/70">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium sm:text-sm">CGPA (Scaled)</CardTitle>
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold sm:text-2xl">3.82</div>
                      <p className="mt-1 hidden text-xs text-muted-foreground 2xl:block">Cumulative Grade Point Average</p>
                    </CardContent>
                  </Card>

                  <Card className="min-w-0 border-border/60 bg-background/70">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium sm:text-sm">Average</CardTitle>
                      <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold sm:text-2xl">
                        91.4
                        <span className="ml-1 text-sm font-normal text-muted-foreground sm:text-base">%</span>
                      </div>
                      <p className="mt-1 hidden text-xs text-muted-foreground 2xl:block">Overall score percentage</p>
                    </CardContent>
                  </Card>

                  <Card className="col-span-2 min-w-0 border-border/60 bg-background/70 sm:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium sm:text-sm">Credits Progress</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold sm:text-2xl">
                        128
                        <span className="mx-1 text-sm font-normal text-muted-foreground sm:text-base">/</span>
                        <span className="text-sm font-normal text-muted-foreground sm:text-base">150</span>
                      </div>
                      <Progress value={85.3} className="mt-2 h-2" />
                    </CardContent>
                  </Card>
                </div>
              </section>

              <section className="hidden min-w-0 space-y-3 md:block">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Semesters</h3>
                  <div className="relative hidden w-full min-w-0 xl:block xl:max-w-sm">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search semesters..." readOnly className="h-10 pl-9" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
                  <Card className="h-full min-w-0 border-border/60 bg-background/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="truncate pr-8 text-base font-semibold lg:text-lg">Fall 2025</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mt-2 grid grid-cols-2 gap-3 lg:gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">GPA</p>
                          <p className="text-lg font-semibold">3.76</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Average</p>
                          <p className="text-lg font-semibold">89.8%</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                        <span>6 Courses</span>
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hidden h-full min-w-0 border-border/60 bg-background/70 2xl:block">
                    <CardHeader className="pb-2">
                      <CardTitle className="truncate pr-8 text-base font-semibold lg:text-lg">Spring 2026</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mt-2 grid grid-cols-2 gap-3 lg:gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">GPA</p>
                          <p className="text-lg font-semibold">3.84</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Average</p>
                          <p className="text-lg font-semibold">92.1%</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                        <span>5 Courses</span>
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};
