import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowRight, LogIn, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NGA_OPEN_ACCESS_IMAGE_POOL, type NgaOpenAccessImageEntry } from '@/assets/ngaOpenAccessImagePool';
import SemestraLogo from '@/assets/semestra-logo-circ.webp';

interface LandingHeroProps {
  reducedMotion: boolean;
}

const buildIiifAsset = (entry: NgaOpenAccessImageEntry) => ({
  alt: 'Open-access artwork from the National Gallery of Art collection.',
  src: `https://api.nga.gov/iiif/${entry.uuid}/full/!1200,1600/0/default.jpg`,
  srcSet: [
    `https://api.nga.gov/iiif/${entry.uuid}/full/!640,960/0/default.jpg 640w`,
    `https://api.nga.gov/iiif/${entry.uuid}/full/!960,1280/0/default.jpg 960w`,
    `https://api.nga.gov/iiif/${entry.uuid}/full/!1200,1600/0/default.jpg 1200w`,
  ].join(', '),
  artworkLine: `${entry.title} by ${entry.artist}`,
});

const getRandomArtworkEntry = () => {
  return NGA_OPEN_ACCESS_IMAGE_POOL[Math.floor(Math.random() * NGA_OPEN_ACCESS_IMAGE_POOL.length)];
};

export const LandingHero = ({ reducedMotion }: LandingHeroProps) => {
  const heroRef = useRef<HTMLElement | null>(null);
  const [artwork, setArtwork] = useState<NgaOpenAccessImageEntry>(() => getRandomArtworkEntry());
  const [isImageLoading, setIsImageLoading] = useState(true);

  const asset = useMemo(() => buildIiifAsset(artwork), [artwork]);

  useEffect(() => {
    // Reset loading state and start robust preloading matching AuthArtPanel
    setIsImageLoading(true);
    const preloadImage = new Image();
    preloadImage.decoding = 'async';
    preloadImage.src = asset.src;
    preloadImage.onload = () => setIsImageLoading(false);
    preloadImage.onerror = () => setIsImageLoading(false);
  }, [asset.src]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const foregroundY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacityFade = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const artRotate = useTransform(scrollYProgress, [0, 1], [2, 10]);

  return (
    <section ref={heroRef} className="relative isolate min-h-screen overflow-hidden bg-background selection:bg-primary/20">
      {/* Dynamic Background Elements */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        style={{ y: backgroundY }}
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary/20 to-secondary/20 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}
        />
      </motion.div>

      <header className="relative z-20 pt-5 md:pt-6">
        <div className="mx-auto flex w-full max-w-[80rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/landing" className="group flex items-center gap-3 text-xl font-bold tracking-tight text-foreground">
            <img src={SemestraLogo} alt="Semestra Logo" className="h-9 w-9 object-contain transition-transform group-hover:scale-105" />
            Semestra
          </Link>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="outline" className="border-border bg-background/50 text-foreground backdrop-blur-md hover:bg-muted">
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-2" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between min-h-[calc(100svh-7.25rem)] md:min-h-[calc(100svh-8rem)] py-12 lg:py-0 gap-16 lg:gap-8">

          {/* Left Side: Content */}
          <motion.div
            className="flex-1 max-w-2xl"
            initial={reducedMotion ? false : { opacity: 0, x: -30 }}
            animate={reducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={reducedMotion ? undefined : { y: foregroundY, opacity: opacityFade }}
          >
            <div className="space-y-6">
              <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground md:text-6xl xl:text-7xl leading-[1.1]">
                <span>School feels lighter</span>
                <br />
                <span className="landing-font-cursive font-normal text-muted-foreground/80 italic">when everything lives</span>
                <br />
                <span className="text-primary italic">in one place.</span>
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-8 text-muted-foreground md:text-xl">
                Plan your week, finish tasks faster, and see progress without jumping between apps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-10">
              <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base font-semibold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                <Link to="/login">
                  Start for free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-14 rounded-2xl px-8 text-base text-foreground hover:bg-muted/50 transition-all duration-300">
                <a href="#scrollytelling">See how it works</a>
              </Button>
            </div>
          </motion.div>

          {/* Right Side: Artistic Showcase */}
          <motion.div
            className="flex-1 relative w-full max-w-[540px] perspective-1000"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.9, rotateY: 5 }}
            animate={reducedMotion ? {} : { opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={reducedMotion ? undefined : { rotate: artRotate, opacity: opacityFade }}
          >
            <div className="relative group p-4 bg-card border border-border rounded-[2rem] shadow-[0_22px_70px_4px_rgba(0,0,0,0.12)] dark:shadow-[0_22px_70px_4px_rgba(0,0,0,0.45)] transition-all duration-700">
              <div className="aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-muted/20 relative animate-in fade-in fill-mode-both duration-1000">
                <AnimatePresence mode="wait">
                  {!isImageLoading && (
                    <motion.img
                      key={artwork.uuid}
                      src={asset.src}
                      srcSet={asset.srcSet}
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      alt={asset.alt}
                      className="absolute max-w-none object-cover"
                      decoding="async"
                      fetchPriority="high"
                      style={{
                        width: '140%',
                        height: '140%',
                        left: 0,
                        top: 0,
                        transformOrigin: 'center center',
                      }}
                      initial={{ opacity: 0, x: '-2%', y: '-1%', scale: 1.05 }}
                      animate={{
                        opacity: 1,
                        x: '-20%',
                        y: '-15%',
                        scale: 1.2,
                      }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{
                        opacity: { duration: 0.8, ease: 'easeOut' },
                        x: { duration: 40, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
                        y: { duration: 40, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
                        scale: { duration: 40, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Artwork Overlays */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />
                
                {/* Info Tooltip */}
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-4 right-4 inline-flex size-8 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white/82 backdrop-blur-sm transition-colors hover:bg-black/42 hover:text-white focus-visible:outline-none"
                        aria-label="Artwork citation"
                      >
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="end" className="max-w-72 text-xs leading-5 bg-card border-border shadow-2xl">
                      <div className="flex flex-col gap-1">
                          <p className="font-medium text-foreground">{artwork.title} by {artwork.artist}</p>
                          <p className="text-muted-foreground/80">Source: National Gallery of Art Open Data, open-access IIIF image.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Subtle Decorative Elements */}
              <div className="absolute -top-6 -right-6 h-24 w-24 bg-primary/5 rounded-full blur-2xl -z-10" />
              <div className="absolute -bottom-10 -left-10 h-32 w-32 bg-secondary/5 rounded-full blur-3xl -z-10" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
