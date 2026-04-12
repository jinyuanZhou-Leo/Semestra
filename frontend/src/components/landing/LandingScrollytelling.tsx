import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BookOpen, Calendar, Database, FileText, LayoutDashboard, Settings, GraduationCap, Target, Sparkles, ArrowUpDown, Pencil, Trash } from 'lucide-react';

import SemestraLogo from '@/assets/semestra-logo-circ.webp';
import Aurora from '@/components/Aurora';
import { CanvasIntegratedMockShell, CanvasLegacyMockPanel } from '@/components/canvas/CanvasReferenceMock';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

interface StoryScene {
  key: string;
  title: string;
  accent: string;
  subtitle: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

const STORY_SCENES: StoryScene[] = [
  {
    key: 'scatter',
    title: 'Infinite',
    accent: 'possibilities.',
    subtitle: 'Scattered context.',
  },
  {
    key: 'gather',
    title: 'All your tools,',
    accent: 'united.',
    subtitle: 'The ultimate academic hub.',
  },
  {
    key: 'dashboard',
    title: 'Clarity over',
    accent: 'clutter.',
    subtitle: '100% Modern UI.',
  },
  {
    key: 'canvas',
    title: 'Painful interfaces,',
    accent: 'eradicated.',
    subtitle: 'A completely reimagined Canvas.',
    titleClassName: 'text-5xl md:text-6xl',
    subtitleClassName: 'text-2xl md:text-3xl',
  },
  {
    key: 'calendar',
    title: 'Reclaim your',
    accent: 'schedule.',
    subtitle: 'Intelligent skip tracking.',
    titleClassName: 'text-5xl md:text-6xl',
    subtitleClassName: 'text-2xl md:text-3xl',
  },
  {
    key: 'gradebook',
    title: 'Eliminate grade',
    accent: 'anxiety.',
    subtitle: 'Auto Plan your success.',
    titleClassName: 'text-5xl md:text-6xl',
    subtitleClassName: 'text-2xl md:text-3xl',
  },
];

const VIEWPORT_PADDING = 48;

const SimpleIcon = ({ darkWhite, name, className }: { darkWhite?: boolean; name: string; className?: string }) => (
  <div className={`relative flex items-center justify-center bg-card shadow-sm ${className ?? ''}`}>
    <img
      src={`https://cdn.simpleicons.org/${name}`}
      alt={`${name} Icon`}
      loading="lazy"
      className={`h-[56%] w-[56%] object-contain ${darkWhite ? 'dark:invert dark:grayscale dark:brightness-200' : ''}`}
    />
  </div>
);

const useViewportSize = () => {
  const [viewport, setViewport] = useState(() => ({
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewport = () => setViewport({ height: window.innerHeight, width: window.innerWidth });
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
};

const getViewportFrame = (viewportWidth: number, viewportHeight: number, width: number, height: number) => {
  const availableWidth = Math.max(viewportWidth - VIEWPORT_PADDING, 320);
  const availableHeight = Math.max(viewportHeight - VIEWPORT_PADDING, 320);
  const scale = Math.min(availableWidth / width, availableHeight / height, 1);
  return { height, scale, width };
};

export const LandingScrollytelling = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useViewportSize();

  const dashboardFrame = getViewportFrame(viewport.width, viewport.height, 980, 620);
  const canvasFrame = getViewportFrame(viewport.width, viewport.height, 800, 550);
  const calendarFrame = getViewportFrame(viewport.width, viewport.height, 500, 500);
  const gradebookFrame = getViewportFrame(viewport.width, viewport.height, 980, 620);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=16000', // Very long scrub to keep narrative deliberately slow
          scrub: 1, // Smoothens the timeline scrub slightly
          pin: true,
        }
      });

      // Initially set some states
      tl.set('.strikethrough-line', { scaleX: 0 });

      // SCENE 0: Scatter
      tl.to('.text-scene-0', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-0', { autoAlpha: 1, duration: 1.5 }) // Hold
        .to('.text-scene-0', { autoAlpha: 0, y: -20, duration: 1 })
        
        .to('.hud-bg', { autoAlpha: 1, duration: 1 })
        .to('.hub-logo', { autoAlpha: 1, scale: 0.9, duration: 1 }, '<')
        .fromTo('.scatter-container', { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 1 }, '<')
        .fromTo('.scatter-icon-0', { x: 0 }, { x: -320, duration: 2 }, '<')
        .fromTo('.scatter-icon-1', { x: 0 }, { x: -224, duration: 2 }, '<')
        .fromTo('.scatter-icon-2', { x: 0 }, { x: -128, duration: 2 }, '<')
        .fromTo('.scatter-icon-3', { x: 0 }, { x: 128, duration: 2 }, '<')
        .fromTo('.scatter-icon-4', { x: 0 }, { x: 224, duration: 2 }, '<')
        .fromTo('.scatter-icon-5', { x: 0 }, { x: 320, duration: 2 }, '<')
        .to('.scatter-container', { autoAlpha: 1, duration: 2 })
        .to('.hub-logo', { autoAlpha: 0, scale: 0.88, duration: 1 })
        .to('.scatter-container', { autoAlpha: 0, scale: 0.88, duration: 1 }, '<');

      // SCENE 1: Gather
      tl.to('.text-scene-1', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-1', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-1', { autoAlpha: 0, y: -20, duration: 1 })

        .to('.hub-logo', { autoAlpha: 1, scale: 1, duration: 1 })
        .fromTo('.gather-container', { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 1 }, '<')
        .fromTo('.gather-icon-0', { x: 0, y: -220 }, { x: 0, y: 0, duration: 2 }, '<')
        .fromTo('.gather-icon-1', { x: 209, y: -68 }, { x: 0, y: 0, duration: 2 }, '<')
        .fromTo('.gather-icon-2', { x: 129, y: 178 }, { x: 0, y: 0, duration: 2 }, '<')
        .fromTo('.gather-icon-3', { x: -129, y: 178 }, { x: 0, y: 0, duration: 2 }, '<')
        .fromTo('.gather-icon-4', { x: -209, y: -68 }, { x: 0, y: 0, duration: 2 }, '<')
        .to('.hub-logo', { scale: 1.15, duration: 0.5, yoyo: true, repeat: 1 })
        .to('.gather-container', { autoAlpha: 1, duration: 2 })
        .to('.hub-logo', { autoAlpha: 0, scale: 0.88, duration: 1 })
        .to('.gather-container', { autoAlpha: 0, scale: 0.88, duration: 1 }, '<');

      // SCENE 2: Dashboard
      tl.to('.text-scene-2', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-2', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-2', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.dashboard-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        .fromTo('.dashboard-skeleton', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, '<')
        .fromTo('.course-widget, .focus-widget, .habit-widget', 
          { autoAlpha: 0, z: 280, scale: 1.35, filter: 'blur(16px)' }, 
          { autoAlpha: 1, z: 0, scale: 1, filter: 'blur(0px)', duration: 2, stagger: { each: 0.3, from: 'random' } }
        )
        .to('.dashboard-container', { autoAlpha: 1, duration: 3 })
        .to('.dashboard-container', { autoAlpha: 0, duration: 1 });

      // SCENE 3: Canvas
      tl.to('.text-scene-3', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-3', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-3', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.canvas-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        
        // Emphasize contrast instead of big physical displacement:
        // A subtle shift while fading out the messy old canvas to reveal the integrated Semestra Canvas behind it.
        .fromTo('.messy-canvas', 
          { xPercent: 0, rotate: 0, scale: 1, opacity: 1 }, 
          { xPercent: 12, rotate: 6, scale: 0.95, autoAlpha: 0, duration: 1.5, ease: 'power2.inOut' }, 
          '+=0.5'
        )
        
        .to('.canvas-container', { autoAlpha: 1, duration: 3 })
        .to('.canvas-container', { autoAlpha: 0, duration: 1 });

      // SCENE 4: Calendar
      tl.to('.text-scene-4', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-4', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-4', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.calendar-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        .to('.switch-bg', { backgroundColor: 'rgba(249,115,22,1)', duration: 1 })
        .to('.switch-knob', { x: 28, duration: 1 }, '<')
        .to('.calendar-item', { opacity: 0.5, scale: 0.98, duration: 1, transformOrigin: 'center' }, '<0.2')
        .to('.card-accent', { backgroundColor: 'rgba(156,163,175,0.4)', duration: 1 }, '<')
        .to('.strikethrough-line', { scaleX: 1, duration: 0.6, ease: 'power3.out' }, '<0.1')
        .fromTo('.skip-badge', { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power2.out' }, '<0.1')
        .to('.calendar-container', { autoAlpha: 1, duration: 3 })
        .to('.calendar-container', { autoAlpha: 0, duration: 1 });

      // SCENE 5: Gradebook
      tl.to('.text-scene-5', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-5', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-5', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.gradebook-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        
        // 1) Focus & Toggle Plan Mode (HERO ACTION 1 - SLOWED DOWN)
        .to('.gradebook-container', { scale: 1.05, duration: 1.5, ease: 'power2.out' })
        .to('.plan-mode-btn-gb', { scale: 1.15, boxShadow: '0 0 50px rgba(249,115,22,0.5)', duration: 0.8 }, '<0.2')
        .to('.plan-mode-switch', { backgroundColor: 'rgba(249,115,22,1)', duration: 0.6 }, '<0.2')
        .to('.plan-mode-knob-gb', { x: 14, duration: 0.6 }, '<')
        .to('.plan-mode-icon-gb', { color: 'rgba(249,115,22,1)', duration: 0.6 }, '<')
        .to('.plan-mode-btn-gb', { scale: 1, duration: 0.6, ease: 'back.out(2)' }, '+=0.6') // Long pause of emphasis
        
        // 2) Buttons morph
        .to('.add-btn', { autoAlpha: 0, duration: 0.5 }, '<')
        .to('.add-btn', { display: 'none', duration: 0 })
        .to('.target-gpa-box', { display: 'flex', duration: 0 })
        .to('.autofill-btn', { display: 'flex', duration: 0 })
        .to('.target-gpa-box, .autofill-btn', { autoAlpha: 1, duration: 0.6 }, '<0.2')
        .to('.score-header-lbl', { autoAlpha: 0, duration: 0.4 }, '<')
        .to('.score-header-whatif', { autoAlpha: 1, duration: 0.4 }, '<0.2')

        // 4) Click Autofill (bounce) (HERO PAUSE 2)
        .to('.autofill-btn', { scale: 0.95, duration: 0.2 }, '+=1.2') // explicit long pause to draw anticipation
        .to('.autofill-btn', { scale: 1.05, duration: 0.5, ease: 'back.out(3)', boxShadow: '0 0 60px rgba(249,115,22,0.8)' })
        .to('.autofill-btn', { scale: 1, duration: 0.3 }, '+=0.3')

        // 5) Hero Burst of Auto-filled Scores (Camera Zoom & SCROLL)
        // Zoom dramatically ONLY to the table list making it the core screen element
        .to('.gradebook-container', { scale: 1.4, y: -70, duration: 1.5, ease: 'power3.inOut' }, '+=0.2')
        
        // Table scroll with past item dissolving so it doesn't overlap header
        .to('.table-scroll-area', { y: -50, duration: 1.2, ease: 'power2.inOut' }, '<0.6')
        .to('.past-item', { autoAlpha: 0, y: -20, duration: 0.8 }, '<')
        
        // Magic scrolling sequence: Rows scroll from bottom
        .fromTo('.autofill-row', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.2, ease: 'power3.out' }, '<0.2')

        // Score highlights jump out sequentially
        .to('.whatif-input-wrapper', { 
            z: 200, 
            scale: 1.4, 
            x: -5,
            y: -5,
            backgroundColor: 'rgba(249,115,22,0.15)', 
            borderColor: 'rgba(249,115,22,1)',
            boxShadow: '0 20px 60px -10px rgba(249,115,22,0.8)',
            duration: 1, 
            ease: 'back.out(1.5)',
            stagger: 0.4 
        }, '<0.5')
        .to('.whatif-val', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.4 }, '<0.1')
        
        .to('.gradebook-container', { autoAlpha: 1, duration: 4.5 })
        .to('.gradebook-container', { autoAlpha: 0, duration: 1 });

      // CTA
      tl.to('.hud-bg', { autoAlpha: 0, duration: 1 })
        .fromTo('.cta-container', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.5 })
        .to('.cta-container', { autoAlpha: 1, duration: 3 });

    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full bg-background h-screen">
      <div className="absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden perspective-[2000px]">
        {/* HUD BG */}
        <div
          className="hud-bg pointer-events-none absolute left-1/2 top-1/2 z-0 h-[800px] w-[120vw] -translate-x-1/2 -translate-y-1/2 mix-blend-plus-lighter opacity-0 invisible"
          style={{
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 60%)',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 60%)',
          }}
        >
          <Aurora colorStops={['#f97316', '#fbbf24', '#fb7185']} blend={0.5} amplitude={1.0} speed={1} />
        </div>

        {/* SCATTER & GATHER SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="relative flex h-[300px] w-[300px] items-center justify-center">
            
            <div className="scatter-container absolute inset-0 flex items-center justify-center opacity-0 invisible">
              {[FileText, Calendar, Database, Settings, BookOpen, LayoutDashboard].map((Icon, idx) => (
                <div key={idx} className={`scatter-icon-${idx} absolute z-10`}>
                  <div className="flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-background text-muted-foreground shadow-lg">
                    <Icon size={28} strokeWidth={2.5} />
                  </div>
                </div>
              ))}
            </div>

            <div className="gather-container absolute inset-0 flex items-center justify-center opacity-0 invisible">
              {['microsoftexcel', 'microsofttodo', 'icloud', 'canvas', 'googlecalendar'].map((name, idx) => (
                <div key={idx} className={`gather-icon-${idx} absolute z-20`}>
                  <SimpleIcon name={name} className="size-16 rounded-2xl border-2 border-border/50 bg-background/50 backdrop-blur-md" />
                </div>
              ))}
            </div>

            <div className="hub-logo absolute z-30 flex size-32 items-center justify-center overflow-hidden rounded-[2.5rem] border border-border/80 bg-background p-3 shadow-2xl shadow-primary/30 ring-8 ring-primary/10 opacity-0 invisible">
              <img src={SemestraLogo} alt="Semestra Logo" className="h-full w-full rounded-2xl object-contain drop-shadow-md" />
            </div>

          </div>
        </div>

        {/* DASHBOARD SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="dashboard-container opacity-0 invisible">
            <div style={{ width: dashboardFrame.width, height: dashboardFrame.height, transform: `scale(${dashboardFrame.scale})`, transformOrigin: 'center' }}>
              <div className="dashboard-skeleton relative flex h-full w-full origin-center flex-col gap-4 rounded-[2rem] border-[1.5px] border-border/40 bg-[#0a0a0c]/90 p-5 text-foreground shadow-2xl backdrop-blur-3xl">
                {/* Dashboard top bar */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-4">
                    <div className="text-xl font-extrabold text-white">26W</div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60">
                      <LayoutDashboard size={12} /> Dashboard
                    </div>
                  </div>
                  <div className="flex gap-2 text-white/50">
                    <div className="flex size-8 items-center justify-center rounded-full bg-white/5">
                      <div className="size-3 rounded-full border-2 border-white/40" />
                    </div>
                    <div className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-bold text-black">L</div>
                  </div>
                </div>

                <div className="grid h-[70px] shrink-0 grid-cols-3 gap-4">
                  <div className="flex flex-col justify-center rounded-xl bg-[#121214] px-5">
                    <span className="mb-1 flex items-center gap-2 text-[10px] font-bold text-white/40">
                      <BookOpen size={10} /> Credits
                    </span>
                    <span className="text-xl font-black text-white">3.00</span>
                  </div>
                  <div className="flex flex-col justify-center rounded-xl bg-[#121214] px-5">
                    <span className="mb-1 text-[10px] font-bold text-white/40">% Average</span>
                    <span className="text-xl font-black text-white">29.1%</span>
                  </div>
                  <div className="flex flex-col justify-center rounded-xl bg-[#121214] px-5">
                    <span className="mb-1 text-[10px] font-bold text-white/40">GPA</span>
                    <span className="text-xl font-black text-white">1.28</span>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-12 gap-4">
                  <div className="col-span-4 flex flex-col gap-4">
                    <div className="course-widget relative flex flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-white/5 bg-[#121214] p-4">
                      <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">APS105</span>
                          <span className="text-[10px] font-medium text-blue-400">0.5 cr</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-white">84.5%</span>
                          <span className="text-[10px] text-white/50">GPA: 3.70</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">APS112</span>
                          <span className="text-[10px] font-medium text-blue-400">0.5 cr</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-white">0.0%</span>
                          <span className="text-[10px] text-white/50">GPA: 0.00</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white/5 p-2 opacity-50">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">ECE191</span>
                          <span className="text-[10px] font-medium text-rose-400">0.5 cr</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-white">0.0%</span>
                          <span className="text-[10px] text-white/50">GPA: 0.00</span>
                        </div>
                      </div>
                    </div>
                    <div className="habit-widget flex h-[140px] flex-col justify-between rounded-xl border border-orange-500/20 bg-gradient-to-b from-[#b45309] to-[#991b1b] p-4 shadow-inner">
                      <div className="text-sm font-bold text-white drop-shadow-sm">Untitled habit</div>
                      <div className="mt-1 flex justify-between gap-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                          <div key={day + index} className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold text-white/80">{day}</span>
                            <div className={`flex size-6 items-center justify-center rounded-full text-xs shadow-sm ${index === 6 ? 'border-2 border-white bg-[#b45309] text-white' : 'bg-black/20 text-white/30'}`}>
                              {index === 6 ? '11' : '✨'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 w-full rounded-lg bg-white py-1.5 text-center text-xs font-bold text-[#d97706] shadow-sm">✨ Check In</div>
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col gap-4">
                    <div className="focus-widget relative flex h-[180px] flex-col items-center justify-center rounded-xl border border-white/5 bg-[#121214] p-5">
                      <span className="mb-3 text-[10px] font-bold text-white/40">Focus</span>
                      <span className="mb-4 text-6xl font-black tracking-tighter text-white">25:00</span>
                      <div className="flex w-full gap-2 px-2">
                        <div className="flex-1 rounded-lg bg-white py-2 text-center text-xs font-bold text-black shadow-md">▷ Start</div>
                        <div className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-center text-xs font-bold text-white">↻ Reset</div>
                      </div>
                    </div>
                    <div className="habit-widget relative flex flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#121214] p-4">
                      <span className="mb-1 text-[10px] font-bold text-white/40">Today</span>
                      <span className="mb-4 text-sm font-bold text-white">Saturday · Apr 11</span>
                      <div className="flex flex-1 flex-col items-center justify-center gap-2">
                        <span className="w-full px-4 text-center text-xs font-medium text-white/30">No events scheduled for today.</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col gap-4">
                    <div className="course-widget flex h-[140px] flex-col items-center justify-center rounded-xl border border-white/5 bg-[#121214]">
                      <span className="mb-1 flex items-center gap-1 text-[9px] font-bold tracking-widest text-white/40">🌐 New York</span>
                      <span className="mb-2 text-5xl font-light tracking-tight text-white">20:14</span>
                      <span className="text-xs font-medium text-white/40">Apr 11 · Saturday</span>
                    </div>
                    <div className="focus-widget flex flex-1 flex-col rounded-xl border border-white/5 bg-[#121214] p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-3.5 w-1 rounded-sm bg-orange-500" />
                        <span className="text-sm font-bold text-white">Title</span>
                      </div>
                      <span className="text-xs font-medium leading-relaxed text-white/40">Write your note here...</span>
                      <div className="mt-auto w-full text-right text-[10px] text-white/30">0 chars</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CANVAS SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="canvas-container opacity-0 invisible">
            <div style={{ width: canvasFrame.width, height: canvasFrame.height, transform: `scale(${canvasFrame.scale})`, transformOrigin: 'center' }}>
              <CanvasIntegratedMockShell showTopChrome className="absolute inset-0 z-20 h-full w-full" />
              <div className="messy-canvas absolute -inset-4 z-30 origin-bottom-right">
                <CanvasLegacyMockPanel className="h-full w-full rounded-r-[2.5rem]" />
              </div>
            </div>
          </div>
        </div>

        {/* CALENDAR SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="calendar-container opacity-0 invisible flex flex-col items-center justify-center gap-8">
            <div style={{ width: calendarFrame.width, height: calendarFrame.height, transform: `scale(${calendarFrame.scale})`, transformOrigin: 'center' }}>
              <div className="flex flex-col items-center justify-center gap-10 h-full w-full">
                
                {/* Modern Switch UI */}
                <div className="flex items-center gap-4 rounded-3xl border border-border/60 bg-background/80 p-3 pr-6 shadow-sm backdrop-blur-md">
                  <div className="relative flex h-[38px] w-[66px] items-center rounded-full border border-border/50 bg-muted p-1">
                    <div className="switch-bg absolute inset-0 rounded-full bg-muted transition-colors" />
                    <div className="switch-knob relative z-10 size-[28px] rounded-full bg-white shadow-md border border-black/5" />
                  </div>
                  <span className="font-semibold text-foreground">Skip this class</span>
                </div>

                {/* Event Card */}
                <div className="calendar-item relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl transition-all">
                  {/* Left accent stripe */}
                  <div className="card-accent absolute bottom-0 left-0 top-0 w-2.5 bg-blue-500" />
                  
                  <div className="p-7 pl-10">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">Lecture</span>
                        <span className="skip-badge opacity-0 invisible rounded-md border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-500">
                          Skipped
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">Mon 09:00 - 10:00</span>
                    </div>
                    
                    <div className="relative inline-block">
                      <div className="strikethrough-line absolute left-0 right-0 top-1/2 z-10 h-[2.5px] -translate-y-1/2 origin-left rounded-full bg-orange-500/80 transform scale-x-0" />
                      <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Computer Science 101</h3>
                    </div>
                    
                    <div className="mt-4 flex flex-wrap items-center gap-5 text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <svg className="size-4.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Dr. Smith
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="size-4.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Room 404
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* GRADEBOOK SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="gradebook-container opacity-0 invisible flex flex-col items-center justify-center">
            <div style={{ width: '850px', transformOrigin: 'center' }}>
              
              {/* Simplified & Focused App Window */}
              <div className="fake-app-window flex flex-col rounded-[2.5rem] border-[1.5px] border-border/40 bg-[#0a0a0c]/98 text-foreground shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl p-10 transform-style-preserve-3d relative">
                
                <h2 className="text-3xl font-black tracking-tight text-white mb-8 whitespace-nowrap">Assessments</h2>

                {/* ACTIONS ROW */}
                <div className="flex items-center justify-between mb-6 relative h-[48px] shrink-0">
                  <div className="flex items-center gap-6">
                    
                    {/* The PLAN MODE Button (HERO TARGET 1) */}
                    <div className="plan-mode-btn-gb flex items-center gap-4 rounded-xl border border-white/10 bg-[#1a1a1c] px-5 py-3 transform-gpu transition-shadow relative z-20">
                      <Sparkles className="plan-mode-icon-gb text-white/40 size-5" />
                      <span className="text-base font-bold text-white/70 whitespace-nowrap">Plan Mode</span>
                      <div className="plan-mode-switch relative flex h-[24px] w-[40px] items-center rounded-full bg-white/20 ml-2">
                        <div className="plan-mode-knob-gb absolute left-[3px] size-4.5 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                    
                    {/* Target GPA INPUT (Hidden initially) */}
                    <div className="target-gpa-box flex items-center gap-4 rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-3 opacity-0 invisible">
                       <Target className="text-orange-500 size-5" />
                       <span className="text-base font-bold text-white/80 whitespace-nowrap">Target GPA</span>
                       <div className="w-20 rounded-md bg-black/40 px-3 py-1 text-center text-[16px] font-black text-white border border-white/10 shadow-inner">3.9</div>
                       <span className="text-sm font-bold text-white/40 whitespace-nowrap">GPA / %</span>
                    </div>
                  </div>

                  <div className="flex items-center h-full relative w-[180px] justify-end">
                    <div className="add-btn absolute right-0 flex items-center rounded-xl bg-white text-black px-6 py-3 text-base font-bold shadow-md opacity-100 whitespace-nowrap">
                      + Add Assessment
                    </div>
                    <div className="autofill-btn absolute right-0 flex items-center gap-2 rounded-xl bg-orange-500 text-black px-6 py-3 text-base font-bold shadow-md shadow-orange-500/20 opacity-0 invisible whitespace-nowrap">
                      <Sparkles className="size-5" /> Auto-fill
                    </div>
                  </div>
                </div>

                {/* TABLE */}
                <div className="flex flex-col flex-1 border border-white/5 rounded-2xl bg-[#121214]/50 shadow-inner">
                  <div className="flex items-center border-b border-white/5 px-8 py-5 text-sm font-bold text-white/40 bg-[#121214]/80 rounded-t-2xl">
                    <div className="w-[28%] flex items-center gap-1.5 whitespace-nowrap">Assessment <ArrowUpDown className="size-3.5"/></div>
                    <div className="w-[17%] flex items-center gap-1.5 whitespace-nowrap">Category <ArrowUpDown className="size-3.5"/></div>
                    <div className="w-[20%] flex items-center gap-1.5 whitespace-nowrap">Due <ArrowUpDown className="size-3.5"/></div>
                    <div className="w-[15%] flex items-center gap-1.5 whitespace-nowrap">Weight <ArrowUpDown className="size-3.5"/></div>
                    <div className="w-[15%] relative h-5">
                      <span className="score-header-lbl absolute left-0 top-0 flex items-center gap-1.5 opacity-100 whitespace-nowrap">Score <ArrowUpDown className="size-3.5"/></span>
                      <span className="score-header-whatif absolute left-0 top-0 flex items-center gap-1.5 text-white opacity-0 invisible whitespace-nowrap">What If <ArrowUpDown className="size-3.5"/></span>
                    </div>
                    <div className="w-[5%] text-right pr-2 whitespace-nowrap">Actions</div>
                  </div>
                  
                  <div className="relative flex-1 py-1">
                    <div className="table-scroll-area flex flex-col relative transform-style-preserve-3d" style={{ top: 0 }}>
                      
                      {/* Past item */}
                      <div className="past-item flex items-center px-8 py-4 border-b border-white/5">
                        <div className="w-[28%] text-base font-bold text-white whitespace-nowrap truncate pr-2">Midterm Exam</div>
                        <div className="w-[17%]"><span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400 whitespace-nowrap">Exam</span></div>
                        <div className="w-[20%] text-sm font-medium text-white/70 whitespace-nowrap">Oct 14, 2025<br/><span className="text-[11px] text-white/30 font-bold uppercase mt-1 inline-block">1 month ago</span></div>
                        <div className="w-[15%] text-base font-black text-white/90 whitespace-nowrap">30.00%</div>
                        <div className="w-[15%]"><div className="w-16 rounded-md bg-white/5 px-2 py-1.5 text-center text-[15px] font-black text-white border border-white/5 shadow-inner">78.5</div></div>
                        <div className="w-[5%] flex justify-end gap-4 text-white/30 pr-2"><Pencil size={15}/><Trash size={15}/></div>
                      </div>
                      
                      {/* Auto-fill items (initially hidden, will fade up as if scrolling) */}
                      {[
                        { name: 'Assignment 3', cat: 'Homework', due: 'Nov 02', weight: '10.00%', score: '95.0' },
                        { name: 'Final Project', cat: 'Project', due: 'Dec 01', weight: '20.00%', score: '92.0' },
                        { name: 'Final Exam', cat: 'Exam', due: 'Dec 15', weight: '40.00%', score: '88.0' },
                      ].map((item, i) => (
                        <div key={i} className="autofill-row opacity-0 invisible relative flex items-center px-8 py-4 border-b border-white/5 z-0 transform-style-preserve-3d">
                          <div className="w-[28%] text-base font-bold text-white whitespace-nowrap truncate pr-2">{item.name}</div>
                          <div className="w-[17%]"><span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-bold text-white/50 whitespace-nowrap">{item.cat}</span></div>
                          <div className="w-[20%] text-sm font-medium text-white/70 whitespace-nowrap">{item.due}</div>
                          <div className="w-[15%] text-base font-black text-white/90 whitespace-nowrap">{item.weight}</div>
                          <div className="w-[15%] relative z-50 transform-style-preserve-3d">
                            <div className="whatif-input-wrapper w-16 rounded-md bg-white/5 px-2 py-1.5 text-center text-[15px] font-black text-transparent border border-white/5 relative z-50 will-change-transform transform-gpu shadow-inner">
                               <span className="whatif-val absolute inset-0 flex items-center justify-center opacity-0 translate-y-3 text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.9)]">
                                 {item.score}
                               </span>
                            </div>
                          </div>
                          <div className="w-[5%] flex justify-end gap-4 text-white/30 pr-2"><Pencil size={15}/><Trash size={15}/></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* TEXT OVERLAYS */}
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          {STORY_SCENES.map((scene, i) => (
            <div key={scene.key} className={`text-scene-${i} absolute flex max-w-[min(88vw,56rem)] flex-col items-center px-6 text-center opacity-0 invisible translate-y-[20px] will-change-transform`}>
              <h2 className={`text-4xl font-black tracking-tight text-foreground drop-shadow-[0_0_40px_rgba(255,255,255,1)] dark:drop-shadow-[0_0_40px_rgba(0,0,0,1)] md:text-6xl ${scene.titleClassName ?? ''}`.trim()}>
                <span>{scene.title}</span>{' '}
                <span className="landing-font-cursive bg-gradient-to-r from-orange-500 via-amber-400 to-rose-400 bg-clip-text font-normal italic text-transparent drop-shadow-[0_2px_10px_rgba(249,115,22,0.3)]">
                  {scene.accent}
                </span>
              </h2>
              <h3 className={`mt-3 rounded-full border border-border/50 bg-background/40 px-6 py-2 text-xl font-medium text-foreground backdrop-blur-md drop-shadow-lg md:text-2xl ${scene.subtitleClassName ?? ''}`.trim()}>{scene.subtitle}</h3>
            </div>
          ))}
        </div>

        {/* CTA SECTION */}
        <div
          className="cta-container absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 p-8 backdrop-blur-sm opacity-0 invisible translate-y-[50px] will-change-transform"
        >
          <h2 className="mb-6 text-center text-6xl font-black tracking-tight text-foreground drop-shadow-[0_0_40px_rgba(255,255,255,1)] dark:drop-shadow-[0_0_40px_rgba(0,0,0,1)] md:text-8xl">
            <span>Regain your</span>{' '}
            <span className="landing-font-cursive bg-gradient-to-r from-orange-500 via-amber-400 to-rose-400 bg-clip-text font-normal italic text-transparent drop-shadow-[0_2px_10px_rgba(249,115,22,0.3)]">
              focus.
            </span>
          </h2>
          <h3 className="mb-12 max-w-2xl text-center text-xl font-medium text-muted-foreground md:text-2xl">
            Join Semestra today and experience the next generation of academic productivity.
          </h3>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row pointer-events-auto">
            <Button asChild size="lg" className="h-14 rounded-2xl px-10 text-lg font-bold shadow-xl transition-transform hover:scale-105">
              <Link to="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
