import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BookOpen, Calendar, Database, FileText, LayoutDashboard, Settings } from 'lucide-react';

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
  const gradebookFrame = getViewportFrame(viewport.width, viewport.height, 700, 450);

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
        .fromTo('.messy-canvas', { xPercent: 0, rotate: 0 }, { xPercent: 118, rotate: 22, duration: 2 })
        .to('.canvas-container', { autoAlpha: 1, duration: 3 })
        .to('.canvas-container', { autoAlpha: 0, duration: 1 });

      // SCENE 4: Calendar
      tl.to('.text-scene-4', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-4', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-4', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.calendar-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        .to('.switch-bg', { backgroundColor: 'rgba(249,115,22,1)', duration: 1 })
        .to('.switch-knob', { x: 56, duration: 1 }, '<')
        .to('.calendar-item', { filter: 'grayscale(100%)', autoAlpha: 0.5, duration: 1 }, '<0.2')
        .to('.strikethrough-line', { scaleX: 1, duration: 1 }, '<')
        .to('.calendar-container', { autoAlpha: 1, duration: 3 })
        .to('.calendar-container', { autoAlpha: 0, duration: 1 });

      // SCENE 5: Gradebook
      tl.to('.text-scene-5', { autoAlpha: 1, y: 0, duration: 1 })
        .to('.text-scene-5', { autoAlpha: 1, duration: 1.5 })
        .to('.text-scene-5', { autoAlpha: 0, y: -20, duration: 1 })

        .fromTo('.gradebook-container', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 })
        .to('.plan-mode-btn', { borderColor: 'rgba(249,115,22,0.5)', backgroundColor: 'rgba(249,115,22,0.1)', duration: 1 })
        .to('.plan-mode-icon', { color: 'rgba(249,115,22,1)', duration: 1 }, '<')
        .to('.plan-mode-switch-bg', { backgroundColor: 'rgba(249,115,22,1)', duration: 1 }, '<')
        .to('.plan-mode-knob', { x: 18, duration: 1 }, '<')
        .to('.gpa-box', { borderColor: 'rgba(249,115,22,1)', backgroundColor: 'rgba(249,115,22,0.1)', duration: 1 })
        .to('.target-score', { color: 'rgba(249,115,22,1)', duration: 1 }, '<0.5')
        .to('.gradebook-container', { autoAlpha: 1, duration: 3 })
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
          <div className="calendar-container opacity-0 invisible flex flex-col items-center justify-center gap-10">
            <div style={{ width: calendarFrame.width, height: calendarFrame.height, transform: `scale(${calendarFrame.scale})`, transformOrigin: 'center' }}>
              <div className="flex flex-col items-center justify-center gap-10 h-full w-full">
                <div className="text-center text-sm font-bold text-muted-foreground">Skip Manager</div>
                <div className="relative flex h-[64px] w-[120px] items-center rounded-full border border-border/50 bg-muted p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                  <div className="switch-bg absolute inset-0 rounded-full bg-muted" />
                  <div className="switch-knob relative z-10 h-[52px] w-[52px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]" />
                </div>
                <div className="calendar-item relative flex w-full flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] filter-none opacity-100">
                  <div className="strikethrough-line absolute left-6 right-6 top-1/2 z-10 h-1 origin-left rounded-full bg-foreground opacity-70 transform scale-x-0" />
                  <div className="mb-2 flex items-center justify-between opacity-80">
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500 ring-1 ring-blue-500/20 dark:text-blue-400">LECTURE</span>
                    <span className="text-sm font-bold text-muted-foreground">Mon 09:00 - 10:00</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tight text-foreground">Computer Science 101</h3>
                  <div className="mt-1 flex items-center gap-3 text-lg font-medium text-muted-foreground">
                    <span>Dr. Smith</span>
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    <span>Room 404</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GRADEBOOK SCENE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="gradebook-container opacity-0 invisible">
            <div style={{ width: gradebookFrame.width, height: gradebookFrame.height, transform: `scale(${gradebookFrame.scale})`, transformOrigin: 'center' }}>
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
                <div className="mb-8 flex flex-wrap items-end justify-between border-b border-border/50 pb-6">
                  <div>
                    <div className="text-3xl font-black text-foreground">Assessments</div>
                    <div className="mt-1 text-lg font-medium text-muted-foreground">Calculus II</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="plan-mode-btn flex items-center gap-3 rounded-xl border border-white/10 bg-transparent px-4 py-2 text-foreground shadow-sm transition-colors">
                      <svg className="plan-mode-icon text-muted-foreground transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1-1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      </svg>
                      <span className="text-sm font-bold tracking-tight">Plan Mode</span>
                      <div className="plan-mode-switch-bg relative flex h-6 w-10 items-center rounded-full bg-muted shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors">
                        <div className="plan-mode-knob absolute left-[2px] size-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
                      </div>
                    </div>

                    <div className="gpa-box flex items-center gap-3 rounded-xl border border-transparent bg-transparent px-4 py-2 text-[13px] font-bold text-muted-foreground shadow-sm transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-orange-500">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                      Target GPA
                      <div className="ml-2 w-16 rounded-md border border-border bg-background px-3 py-1 text-center text-lg text-foreground shadow-inner">4.0</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="mb-2 flex border-b border-border/50 pb-3 text-sm font-bold tracking-wide text-muted-foreground">
                    <div className="w-[30%]">Assessment</div>
                    <div className="w-[20%]">Category</div>
                    <div className="w-[20%] text-right">Weight</div>
                    <div className="w-[30%] pr-4 text-right">What If</div>
                  </div>

                  <div className="flex items-center border-b border-border/30 py-5 text-lg">
                    <div className="w-[30%] font-bold text-foreground">Midterm Exam</div>
                    <div className="w-[20%]">
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-600 ring-1 ring-blue-500/20 shadow-sm dark:text-blue-400">Exam</span>
                    </div>
                    <div className="w-[20%] text-right font-bold text-muted-foreground opacity-80">40.00%</div>
                    <div className="flex w-[30%] justify-end text-right">
                      <span className="rounded-lg bg-muted px-4 py-1.5 font-black text-foreground/80 shadow-inner">85.0</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-5 text-lg shadow-[inset_0_0_50px_rgba(249,115,22,0.05)]">
                    <div className="flex w-[30%] items-center gap-3 font-black text-foreground">
                      Final Project
                      <div className="size-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse" />
                    </div>
                    <div className="w-[20%]">
                      <span className="rounded-full bg-orange-500/10 px-3 py-1 text-sm font-bold text-orange-600 ring-1 ring-orange-500/30 shadow-sm dark:text-orange-400">Project</span>
                    </div>
                    <div className="w-[20%] text-right font-bold text-muted-foreground">60.00%</div>
                    <div className="flex w-[30%] justify-end text-right">
                      <div className="target-score text-gray-400 min-w-[120px] rounded-lg border-2 border-orange-500/50 bg-background px-6 py-2 text-center text-2xl font-black shadow-lg ring-4 ring-orange-500/10 transition-colors">
                        92.0
                      </div>
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
