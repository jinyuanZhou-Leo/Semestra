import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LogIn, Image as ImageIcon } from 'lucide-react';

import SemestraLogo from '@/assets/semestra-logo-circ.webp';
import RotatingText from '@/components/RotatingText';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

interface LandingHeroProps {
  reducedMotion: boolean;
}

export const LandingHero = ({ reducedMotion }: LandingHeroProps) => {
  const sectionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (reducedMotion || !sectionRef.current) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      const introTimeline = gsap.timeline({
        defaults: { duration: 0.9, ease: 'power3.out' },
      });

      introTimeline
        .from('[data-hero-reveal="nav"]', { y: -24, autoAlpha: 0 })
        .from('[data-hero-reveal="copy"]', { y: 28, autoAlpha: 0, stagger: 0.12 }, '-=0.55')
        .from('[data-hero-reveal="panel"]', { y: 48, autoAlpha: 0, rotateX: -10 }, '-=0.55');

      gsap.to('[data-hero-layer="back-orb"]', {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('[data-hero-layer="front-orb"]', {
        yPercent: -14,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      gsap.to('[data-hero-layer="device"]', {
        yPercent: -10,
        autoAlpha: 0.35,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_34%),radial-gradient(circle_at_80%_18%,_rgba(234,88,12,0.16),_transparent_28%),linear-gradient(180deg,_var(--color-background)_0%,_color-mix(in_oklab,var(--color-muted)_20%,transparent)_100%)]"
    >
      <div
        aria-hidden
        data-hero-layer="back-orb"
        className="absolute left-[-12rem] top-[-10rem] size-[30rem] rounded-full bg-primary/12 blur-3xl"
      />
      <div
        aria-hidden
        data-hero-layer="front-orb"
        className="absolute right-[-8rem] top-20 size-[22rem] rounded-full bg-orange-500/14 blur-3xl"
      />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

      <header data-hero-reveal="nav" className="relative z-20 pt-5 md:pt-6">
        <div className="mx-auto flex w-full max-w-[82rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/landing" className="group flex items-center gap-3 text-xl font-semibold tracking-tight text-foreground">
            <img src={SemestraLogo} alt="Semestra logo" className="size-10 object-contain transition-transform duration-300 group-hover:scale-105" />
            <span className="landing-font-display text-2xl">Semestra</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur-md hover:bg-background">
              <Link to="/login">
                <LogIn className="size-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-[82rem] gap-14 px-4 pb-18 pt-12 sm:px-6 md:pb-24 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)] lg:items-center lg:gap-10 lg:px-8">
        <div className="max-w-[38rem] flex flex-col justify-center">
          <h1 data-hero-reveal="copy" className="landing-font-display flex flex-col gap-1 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            <span className="max-w-[12ch] leading-[1.1]">Your school workspace that</span>
            <RotatingText
              texts={['tracks courses', 'plans assignments', 'manages deadlines', 'calculates GPA', 'organizes schedule']}
              mainClassName="text-orange-500 inline-flex overflow-hidden landing-font-cursive text-5xl sm:text-6xl lg:text-7xl mt-2 font-normal italic drop-shadow-[0_2px_10px_rgba(249,115,22,0.3)] pb-2"
              staggerDuration={0.02}
              splitBy="characters"
              rotationInterval={4500}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            />
          </h1>
        </div>

        <div data-hero-layer="device" className="relative flex w-full min-h-[30rem] items-center justify-center lg:min-h-[38rem]">
          <div
            data-hero-reveal="panel"
            className="flex h-[32rem] w-full max-w-[38rem] flex-col items-center justify-center space-y-4 rounded-[2rem] border-2 border-dashed border-border/60 bg-muted/20 backdrop-blur-md"
          >
            <ImageIcon className="size-12 text-muted-foreground/50" />
            <span className="text-sm font-medium text-muted-foreground/70">Image Placeholder</span>
          </div>
        </div>
      </div>
    </section>
  );
};
