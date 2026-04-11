import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

import SemestraLogo from '@/assets/semestra-logo-circ.webp';

// Component to render brand icons from SimpleIcons CDN using brand colors
const SimpleIcon = ({ name, className, darkWhite }: { name: string, className?: string, darkWhite?: boolean }) => (
  <div className={`relative flex items-center justify-center border border-border bg-card shadow-sm ${className}`}>
    <img
      src={`https://cdn.simpleicons.org/${name}`}
      alt={`${name} Icon`}
      width={24}
      height={24}
      loading="lazy"
      className={`w-[56%] h-[56%] object-contain ${darkWhite ? 'dark:invert dark:grayscale dark:brightness-200' : ''}`}
    />
  </div>
);

export const LandingScrollytelling = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Section Opacities
  const opacityImg1 = useTransform(smoothProgress, [0, 0.25, 0.33, 0.4], [1, 1, 0, 0]);
  const opacityImg2 = useTransform(smoothProgress, [0.25, 0.33, 0.58, 0.66], [0, 1, 1, 0]);
  const opacityImg3 = useTransform(smoothProgress, [0.58, 0.66, 0.9, 1], [0, 1, 1, 1]);

  // Scene 1: Orbiting Plugins
  const rotateCore = useTransform(smoothProgress, [0, 0.33], [0, 240]);
  const counterRotate = useTransform(smoothProgress, [0, 0.33], [0, -240]);
  
  // Scene 2: Convergence
  const pullDistance = 280; // Doubled for bolder motion
  const pullX1 = useTransform(smoothProgress, [0.33, 0.66], [-pullDistance, 0]);
  const pullY1 = useTransform(smoothProgress, [0.33, 0.66], [-pullDistance, 0]);
  const pullX2 = useTransform(smoothProgress, [0.33, 0.66], [pullDistance, 0]);
  const pullY2 = useTransform(smoothProgress, [0.33, 0.66], [pullDistance, 0]);
  const pullX3 = useTransform(smoothProgress, [0.33, 0.66], [-pullDistance, 0]);
  const pullY3 = useTransform(smoothProgress, [0.33, 0.66], [pullDistance, 0]);
  const pullX4 = useTransform(smoothProgress, [0.33, 0.66], [pullDistance, 0]);
  const pullY4 = useTransform(smoothProgress, [0.33, 0.66], [-pullDistance, 0]);
  const pullY5 = useTransform(smoothProgress, [0.33, 0.66], [-320, 0]);
  const scaleCenter = useTransform(smoothProgress, [0.33, 0.45, 0.66], [0.5, 1, 1.25]);
  const mergeOpacity = useTransform(smoothProgress, [0.33, 0.58, 0.66], [1, 1, 0]);

  // Background Parallax
  const bgX = useTransform(smoothProgress, [0, 1], ['0%', '15%']);
  const bgY = useTransform(smoothProgress, [0, 1], ['0%', '10%']);

  // Scene 3: 3D Isometric Assembly
  const mockScale = useTransform(smoothProgress, [0.66, 0.75], [0.8, 1]);
  // Start from a tilted 3D angle and land flat
  const mockRotateX = useTransform(smoothProgress, [0.66, 0.75], [30, 0]);
  const mockRotateY = useTransform(smoothProgress, [0.66, 0.75], [-20, 0]);
  const mockRotateZ = useTransform(smoothProgress, [0.66, 0.75], [10, 0]);
  const mockY = useTransform(smoothProgress, [0.66, 0.75], [80, 0]);
  const mockOpacity = useTransform(smoothProgress, [0.65, 0.69], [0, 1]);

  // Exploded Layers flying in from different Z-depths
  const headerZ = useTransform(smoothProgress, [0.66, 0.75], [180, 0]);
  const sidebarZ = useTransform(smoothProgress, [0.66, 0.75], [100, 0]);
  const contentZ = useTransform(smoothProgress, [0.66, 0.75], [-80, 0]);
  
  // Parallax & Polish (Scroll 0.75 to 1)
  const innerScrollY1 = useTransform(smoothProgress, [0.75, 1], [0, -35]);
  const innerScrollY2 = useTransform(smoothProgress, [0.75, 1], [0, -15]);
  const flareOpacity = useTransform(smoothProgress, [0.75, 0.82, 0.9], [0, 0.5, 0]);
  const flareX = useTransform(smoothProgress, [0.75, 0.95], ['-100%', '200%']);

  // Narrative Text Animations (hoisted to avoid creating new MotionValues on every render)
  const opacityNarrative1 = useTransform(smoothProgress, [0, 0.25, 0.33], [1, 1, 0]);
  const yNarrative1 = useTransform(smoothProgress, [0, 0.33], [0, -40]);
  const opacityNarrative2 = useTransform(smoothProgress, [0.25, 0.33, 0.58, 0.66], [0, 1, 1, 0]);
  const yNarrative2 = useTransform(smoothProgress, [0.25, 0.33, 0.58, 0.66], [40, 0, 0, -40]);
  const opacityNarrative3 = useTransform(smoothProgress, [0.58, 0.66, 1], [0, 1, 1]);
  const yNarrative3 = useTransform(smoothProgress, [0.58, 0.66, 1], [40, 0, 0]);

  return (
    <section ref={containerRef} className="relative h-[400vh] w-full bg-background text-foreground">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[80rem] grid-cols-1 items-center gap-8 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          
          {/* Left Side: Visual Storytelling Area (No wrapper) */}
          <div className="relative aspect-[4/3] w-full max-w-xl mx-auto">
            
            {/* Background Parallax Layer */}
            <motion.div 
              style={{ x: bgX, y: bgY }}
              className="absolute -inset-40 opacity-20 dark:opacity-40 pointer-events-none"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] blur-[120px]" />
            </motion.div>

            {/* --- Scene 1: Modular Canvas --- */}
            <motion.div 
              style={{ opacity: opacityImg1 }} 
              className="absolute inset-0 flex items-center justify-center overflow-visible"
            >
               <motion.div style={{ rotate: rotateCore }} className="relative size-56">
                  {/* Semestra Core */}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="size-24 rounded-full bg-card border border-border flex items-center justify-center shadow-lg dark:shadow-[0_0_60px_rgba(255,255,255,0.03)] backdrop-blur-xl overflow-hidden p-3 z-20">
                         <img src={SemestraLogo} alt="Semestra Logo" className="w-full h-full object-contain drop-shadow-md" />
                     </div>
                  </div>
                  {/* Floating Satellites Using SimpleIcons */}
                  <motion.div style={{ rotate: counterRotate }} className="absolute z-10 -top-2 -left-2 shadow-xl">
                      <SimpleIcon name="canvas" className="size-16 rounded-2xl bg-card border border-border backdrop-blur-xl" />
                  </motion.div>
                  <motion.div style={{ rotate: counterRotate }} className="absolute z-10 -bottom-2 -right-2 shadow-xl">
                      <SimpleIcon name="obsidian" className="size-14 rounded-2xl bg-card border border-border backdrop-blur-xl" darkWhite />
                  </motion.div>
                  <motion.div style={{ rotate: counterRotate }} className="absolute z-10 -bottom-2 -left-2 shadow-xl">
                      <SimpleIcon name="github" className="size-16 rounded-2xl bg-card border border-border backdrop-blur-xl" darkWhite />
                  </motion.div>
                  <motion.div style={{ rotate: counterRotate }} className="absolute z-10 -top-2 -right-2 shadow-xl">
                      <SimpleIcon name="notion" className="size-14 rounded-2xl bg-card border border-border backdrop-blur-xl" darkWhite />
                  </motion.div>
               </motion.div>
            </motion.div>

            {/* --- Scene 2: All in One --- */}
            <motion.div 
              style={{ opacity: opacityImg2 }} 
              className="absolute inset-0 flex items-center justify-center overflow-visible"
            >
                {/* Central Hub */}
                <motion.div style={{ scale: scaleCenter }} className="z-20 size-28 rounded-full bg-card border border-border flex items-center justify-center shadow-2xl dark:shadow-[0_0_80px_rgba(212,188,160,0.08)] backdrop-blur-2xl overflow-hidden p-3">
                    <img src={SemestraLogo} alt="Semestra Hub" className="w-full h-full object-contain drop-shadow-lg" />
                </motion.div>

                {/* Converging Platforms */}
                <motion.div style={{ x: pullX1, y: pullY1, opacity: mergeOpacity }} className="absolute z-10 text-background shadow-xl">
                    <SimpleIcon name="todoist" className="size-16 rounded-[1.25rem] bg-card/60 dark:bg-[#2a2622]/60 border border-border backdrop-blur-xl" />
                </motion.div>
                <motion.div style={{ x: pullX2, y: pullY2, opacity: mergeOpacity }} className="absolute z-10 text-background shadow-xl">
                    <SimpleIcon name="googlecalendar" className="size-16 rounded-[1.25rem] bg-card/60 dark:bg-[#2a2622]/60 border border-border backdrop-blur-xl" />
                </motion.div>
                <motion.div style={{ x: pullX3, y: pullY3, opacity: mergeOpacity }} className="absolute z-10 text-background shadow-xl">
                    <SimpleIcon name="canvas" className="size-16 rounded-[1.25rem] bg-card/60 dark:bg-[#2a2622]/60 border border-border backdrop-blur-xl" />
                </motion.div>
                <motion.div style={{ x: pullX4, y: pullY4, opacity: mergeOpacity }} className="absolute z-10 text-background shadow-xl">
                    <SimpleIcon name="microsoftexcel" className="size-16 rounded-[1.25rem] bg-card/60 dark:bg-[#2a2622]/60 border border-border backdrop-blur-xl" />
                </motion.div>
                <motion.div style={{ y: pullY5, opacity: mergeOpacity }} className="absolute z-10 text-background shadow-xl">
                    <SimpleIcon name="icloud" className="size-16 rounded-[1.25rem] bg-card/60 dark:bg-[#2a2622]/60 border border-border backdrop-blur-xl" />
                </motion.div>
            </motion.div>

            {/* --- Scene 3: Clean UI Layout --- */}
            <motion.div 
              className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8"
              style={{ opacity: opacityImg3, perspective: 1500 }}
            >
               {/* Assembled 3D UI */}
               <motion.div 
                  style={{ 
                    opacity: mockOpacity, 
                    scale: mockScale,
                    rotateX: mockRotateX,
                    rotateY: mockRotateY,
                    rotateZ: mockRotateZ,
                    y: mockY,
                    transformStyle: "preserve-3d"
                  }} 
                  className="w-full h-full relative group"
               >
                   {/* Mockup Container Background/Base */}
                   <div className="absolute inset-0 bg-background/80 text-foreground rounded-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] dark:shadow-[0_40px_100px_-20px_rgba(255,255,255,0.05)] border border-border overflow-hidden backdrop-blur-3xl" />

                   {/* Sweeping Flare (Only visible after assembly) */}
                   <motion.div 
                       style={{ opacity: flareOpacity, left: flareX }}
                       className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent skew-x-[20deg] z-50 pointer-events-none mix-blend-overlay"
                   />
                   
                   {/* Assembly Parts */}
                   <div className="absolute inset-0 flex flex-col pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
                      
                      {/* Header Layer */}
                      <motion.div style={{ translateZ: headerZ }} className="relative z-40 bg-card border-b border-border rounded-t-xl shadow-sm text-[9px] font-medium leading-none tracking-tight">
                         {/* Top Header */}
                         <div className="w-full h-10 flex items-center px-4 justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-[10px] tracking-tight">Semestra</span>
                              <div className="flex items-center gap-1 border border-border rounded px-1.5 py-0.5 bg-muted">
                                 <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                                 Personal ▾
                              </div>
                              <span className="text-muted-foreground ml-1">Semesters &gt; Spring 2026</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <div className="px-2 py-0.5 border border-border rounded-full flex gap-4 items-center">
                                 <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                 <span className="opacity-50">/</span>
                              </div>
                              <div className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[7px] font-bold">U</div>
                            </div>
                         </div>
                         
                         {/* Sub-header Tabs */}
                         <div className="w-full h-12 border-t border-border flex items-center px-4 justify-between">
                             <span className="font-bold text-sm tracking-tight text-foreground">Spring 2026</span>
                             <div className="flex bg-muted rounded-full p-0.5 text-[8px] font-medium text-muted-foreground">
                                 <div className="bg-background text-foreground shadow-sm rounded-full px-2.5 py-1 flex items-center gap-1">
                                     <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                     Dashboard
                                 </div>
                                 <div className="px-2.5 py-1 flex items-center gap-1"><span className="opacity-70">Todo</span></div>
                                 <div className="px-2.5 py-1 flex items-center gap-1"><span className="opacity-70">Calendar</span></div>
                                 <div className="px-2.5 py-1 flex items-center gap-1"><span className="opacity-70">Settings</span></div>
                             </div>
                         </div>
                      </motion.div>

                      {/* Main Content Dashboard */}
                      <div className="flex-1 overflow-hidden p-3 relative flex flex-col gap-3" style={{ transformStyle: 'preserve-3d' }}>
                          <div className="absolute inset-0 bg-muted/40 z-0 rounded-b-xl" />
                          
                          {/* Top Stats Row Skeleton */}
                          <motion.div style={{ translateZ: sidebarZ }} className="grid grid-cols-3 gap-3 h-10 w-full shrink-0 relative z-30">
                              <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center gap-1.5 shadow-lg">
                                  <div className="w-8 h-1.5 bg-muted rounded-full" />
                                  <div className="w-12 h-2.5 bg-primary/30 rounded-full" />
                              </div>
                              <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center gap-1.5 shadow-lg">
                                  <div className="w-10 h-1.5 bg-muted rounded-full" />
                                  <div className="w-14 h-2.5 bg-primary/30 rounded-full" />
                              </div>
                              <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center gap-1.5 shadow-lg">
                                  <div className="w-6 h-1.5 bg-muted rounded-full" />
                                  <div className="w-10 h-2.5 bg-primary/30 rounded-full" />
                              </div>
                          </motion.div>

                          <div className="flex gap-3 flex-1 overflow-visible relative" style={{ transformStyle: 'preserve-3d' }}>
                              {/* Left Column Skeleton */}
                              <motion.div style={{ translateZ: sidebarZ }} className="w-[120px] bg-card border border-border rounded-md overflow-hidden flex flex-col shadow-lg relative z-20">
                                  <motion.div style={{ y: innerScrollY2 }} className="flex flex-col">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="flex justify-between items-center p-2.5 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="w-12 h-2 bg-muted-foreground/30 rounded-full" />
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`size-2 rounded-[2px] ${['bg-blue-500/80', 'bg-indigo-500/80', 'bg-rose-500/80', 'bg-teal-500/80', 'bg-orange-500/80'][i % 5]}`} />
                                                    <div className="w-6 h-1.5 bg-muted rounded-full" />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5 items-end">
                                                <div className="w-8 h-2 bg-muted-foreground/50 rounded-full" />
                                                <div className="w-10 h-1.5 bg-muted rounded-full" />
                                            </div>
                                        </div>
                                      ))}
                                  </motion.div>
                              </motion.div>

                              {/* Central Feed Skeleton */}
                              <motion.div style={{ translateZ: contentZ }} className="flex-1 flex flex-col gap-3 relative z-10">
                                  <div className="flex-1 bg-card border border-border rounded-md flex flex-col p-3 gap-3 overflow-hidden shadow-lg relative">
                                      <div className="w-20 h-2 bg-muted-foreground/40 rounded-full" />
                                      <motion.div style={{ y: innerScrollY1 }} className="flex flex-col gap-2 absolute top-8 left-3 right-3">
                                          {Array.from({ length: 4 }).map((_, i) => (
                                              <div key={i} className={`flex items-center gap-2.5 p-2 rounded bg-muted/60 border border-border/50 backdrop-blur-sm ${i === 3 ? 'opacity-50' : ''}`}>
                                                  <div className="size-3 rounded-full border border-primary/40 shrink-0" />
                                                  <div className="flex flex-col gap-1.5 w-full">
                                                      <div className="w-3/4 h-2 bg-muted-foreground/40 rounded-full" />
                                                      <div className="w-1/3 h-1.5 bg-muted rounded-full" />
                                                  </div>
                                              </div>
                                          ))}
                                      </motion.div>
                                  </div>
                                  <div className="h-[75px] grid grid-cols-2 gap-3 shrink-0">
                                      <div className="bg-card border border-border rounded-md relative p-2 flex flex-col items-center justify-center shadow-lg gap-2">
                                          <div className="w-8 h-3 border border-border rounded-full" />
                                          <div className="w-16 h-4 bg-primary/30 rounded-full" />
                                      </div>
                                      <div className="bg-card border border-border rounded-md flex flex-col items-center justify-center shadow-lg gap-2">
                                          <div className="w-6 h-2 bg-muted rounded-full" />
                                          <div className="w-20 h-4 bg-muted-foreground/30 rounded-full" />
                                      </div>
                                  </div>
                              </motion.div>
                          </div>
                      </div>
                   </div>
               </motion.div>
            </motion.div>

          </div>

          {/* Right Side: Text Narrative */}
          <div className="relative h-[50vh] w-full mx-auto md:h-[60vh] max-w-lg">
            {/* Narrative 1 */}
            <motion.div
              style={{
                opacity: opacityNarrative1,
                y: yNarrative1,
              }}
              className="absolute inset-0 flex flex-col justify-center space-y-4"
            >
              <h2 className="landing-font-cursive text-4xl text-primary/80 dark:text-[#dcd1c4] md:text-5xl">Infinite possibilities.</h2>
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">Extensible Plugin Architecture</h3>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Why settle for a rigid system? Semestra is built with a powerful plugin engine that adapts to your unique workflow. From custom themes to advanced productivity tools, the possibilities are entirely in your hands.
              </p>
            </motion.div>

            {/* Narrative 2 */}
            <motion.div
              style={{
                opacity: opacityNarrative2,
                y: yNarrative2,
              }}
              className="absolute inset-0 flex flex-col justify-center space-y-4"
            >
              <h2 className="landing-font-cursive text-4xl text-primary/80 dark:text-[#e2c7a5] md:text-5xl">All your tools, united.</h2>
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">The Ultimate All-in-One Hub</h3>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Say goodbye to context switching. Semestra replaces your scattered Todo lists, complex Excel spreadsheets, disconnected LMS portals, Calendars, and Reminders, bringing everything together into one seamless pane of glass.
              </p>
            </motion.div>

            {/* Narrative 3 */}
            <motion.div
              style={{
                opacity: opacityNarrative3,
                y: yNarrative3,
              }}
              className="absolute inset-0 flex flex-col justify-center space-y-4"
            >
              <h2 className="landing-font-cursive text-4xl text-primary/90 dark:text-white/90 md:text-5xl">Clarity over clutter.</h2>
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl text-foreground">100% Modern UI. 0 Clunky Menus.</h3>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Traditional LMS systems feel like they were built in the 2000s. We designed Semestra from the ground up with a modern, artistic focus. Enjoy vibrant visuals, buttery smooth interactions, and a layout that naturally guides your focus.
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};
