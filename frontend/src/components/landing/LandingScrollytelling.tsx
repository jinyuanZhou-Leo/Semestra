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

  // Scene 3: Clean UI Layout - The Assembly Process
  const clutterOpacity = useTransform(smoothProgress, [0.66, 0.71], [1, 0]);
  
  // Clutter straightening out to form the UI framing
  const clutterAngle1 = useTransform(smoothProgress, [0.66, 0.73], [6, 0]);
  const clutterAngle2 = useTransform(smoothProgress, [0.66, 0.73], [-3, 0]);
  const clutterAngle3 = useTransform(smoothProgress, [0.66, 0.73], [12, 0]);
  const clutterAngle4 = useTransform(smoothProgress, [0.66, 0.73], [-6, 0]);
  const clutterAngle5 = useTransform(smoothProgress, [0.66, 0.73], [2, 0]);

  const cleanOpacity = useTransform(smoothProgress, [0.69, 0.75], [0, 1]);
  const cleanY = useTransform(smoothProgress, [0.66, 0.75], [20, 0]);
  const cleanScale = useTransform(smoothProgress, [0.66, 0.75], [0.95, 1]);

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
              style={{ opacity: opacityImg3 }} 
              className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 lg:p-8"
            >
               {/* Assembly Process: Clutter aligning into pure layout */}
               <motion.div style={{ opacity: clutterOpacity }} className="absolute inset-0 p-8 flex flex-wrap gap-4 items-center justify-center pointer-events-none">
                   <motion.div style={{ rotate: clutterAngle1 }} className="w-[35%] h-24 bg-card border border-border rounded-md shadow-2xl p-2 flex flex-col gap-1.5 overflow-hidden">
                       <div className="w-2/3 h-2 bg-muted rounded-full opacity-60" />
                       <div className="w-4/5 h-2 bg-muted rounded-full opacity-40" />
                       <div className="w-1/2 h-2 bg-muted rounded-full opacity-60" />
                   </motion.div>
                   <motion.div style={{ rotate: clutterAngle2 }} className="w-[45%] h-16 bg-card border border-border rounded-md shadow-xl p-2 flex items-center justify-between">
                       <div className="size-6 rounded bg-primary/10" />
                       <div className="w-1/2 h-2.5 bg-muted rounded-full" />
                       <div className="size-5 rounded-full bg-muted" />
                   </motion.div>
                   <motion.div style={{ rotate: clutterAngle3 }} className="w-[30%] h-32 bg-card border border-border rounded-md shadow-2xl p-3 flex flex-col gap-3">
                       <div className="w-full h-8 bg-muted/30 rounded border border-border/50" />
                       <div className="w-full h-8 bg-muted/30 rounded border border-border/50" />
                       <div className="w-full h-8 bg-muted/30 rounded border border-border/50" />
                   </motion.div>
                   <motion.div style={{ rotate: clutterAngle4 }} className="w-[50%] h-12 bg-card border border-border rounded-md shadow-lg p-2.5 flex gap-2">
                       <div className="h-full w-full bg-primary/10 rounded-sm relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-2/3 bg-primary/20" />
                       </div>
                   </motion.div>
                   <motion.div style={{ rotate: clutterAngle5 }} className="w-[35%] h-28 bg-card border border-border rounded-md shadow-2xl drop-shadow-2xl p-3 grid grid-cols-3 gap-1.5">
                       {Array.from({ length: 9 }).map((_, i) => (
                           <div key={i} className="aspect-square rounded-[2px] bg-muted/40" />
                       ))}
                   </motion.div>
               </motion.div>

               {/* Exact Semestra UI High-fidelity Mockup */}
               <motion.div 
                  style={{ opacity: cleanOpacity, y: cleanY, scale: cleanScale }} 
                  className="w-full h-full flex flex-col bg-background text-foreground rounded-xl shadow-2xl border border-border overflow-hidden"
               >
                   {/* Top Header */}
                   <div className="w-full h-10 border-b border-border flex items-center px-4 justify-between bg-card text-[9px] font-medium leading-none tracking-tight">
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
                   <div className="w-full h-12 border-b border-border flex items-center px-4 justify-between">
                       <span className="font-bold text-sm tracking-tight">Spring 2026</span>
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

                   {/* Main Content Dashboard */}
                   <div className="flex-1 p-3 bg-muted/30 overflow-hidden flex flex-col gap-3">
                       
                       {/* Top Stats Row */}
                       <div className="grid grid-cols-3 gap-3 h-10 w-full shrink-0">
                           <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center">
                               <span className="text-[7px] text-muted-foreground">Credits</span>
                               <span className="text-[10px] font-bold mt-0.5">15.0</span>
                           </div>
                           <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center">
                               <span className="text-[7px] text-muted-foreground">% Average</span>
                               <span className="text-[10px] font-bold mt-0.5">88.5%</span>
                           </div>
                           <div className="bg-card border border-border rounded-md p-2 flex flex-col justify-center">
                               <span className="text-[7px] text-muted-foreground">GPA</span>
                               <span className="text-[10px] font-bold mt-0.5">3.82</span>
                           </div>
                       </div>

                       <div className="flex gap-3 flex-1 overflow-hidden">
                           {/* Courses Left Column */}
                           <div className="w-[120px] bg-card border border-border rounded-md overflow-hidden flex flex-col">
                               {[
                                 { name: 'CS101', score: '94.5%', gpa: '4.00', col: 'bg-blue-500' },
                                 { name: 'MAT201', score: '88.0%', gpa: '3.70', col: 'bg-indigo-500' },
                                 { name: 'ENG200', score: '82.0%', gpa: '3.30', col: 'bg-rose-500' },
                                 { name: 'HIS104', score: '90.0%', gpa: '4.00', col: 'bg-teal-500' }
                               ].map((c, i) => (
                                 <div key={i} className="flex justify-between items-center p-2 border-b border-border/50 last:border-0">
                                     <div>
                                         <div className="text-[9px] font-bold">{c.name}</div>
                                         <div className="flex items-center gap-1 mt-0.5">
                                             <div className={`px-1 py-[1px] rounded-[2px] ${c.col} text-white text-[5px] leading-tight`}>{c.name.slice(0,3)}</div>
                                             <div className="text-[6px] text-muted-foreground">3.0 cr</div>
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-[9px] font-bold">{c.score}</div>
                                         <div className="text-[6px] text-muted-foreground mt-0.5">GPA: {c.gpa}</div>
                                     </div>
                                 </div>
                               ))}
                           </div>

                           {/* Central Feed & Bottom Widgets */}
                           <div className="flex-1 flex flex-col gap-3">
                               <div className="flex-1 bg-card border border-border rounded-md flex flex-col p-3 gap-2 overflow-hidden">
                                   <span className="text-[9px] font-bold">Upcoming Tasks</span>
                                   <div className="flex flex-col gap-1.5">
                                      <div className="flex items-center gap-2 p-1.5 rounded bg-muted/50 border border-border/50">
                                          <div className="size-2.5 rounded-full border border-primary/50" />
                                          <div className="flex flex-col">
                                              <span className="text-[7px] font-medium leading-none">Compile Error Debugging</span>
                                              <span className="text-[5px] text-muted-foreground mt-0.5">CS101 • Tomorrow</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2 p-1.5 rounded bg-muted/50 border border-border/50">
                                          <div className="size-2.5 rounded-full border border-primary/50" />
                                          <div className="flex flex-col">
                                              <span className="text-[7px] font-medium leading-none">Read Chapter 4 Notes</span>
                                              <span className="text-[5px] text-muted-foreground mt-0.5">HIS104 • In 2 Days</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2 p-1.5 rounded bg-muted/50 border border-border/50">
                                          <div className="size-2.5 rounded-full border border-primary/50" />
                                          <div className="flex flex-col">
                                              <span className="text-[7px] font-medium leading-none">Submit Essay Draft</span>
                                              <span className="text-[5px] text-muted-foreground mt-0.5">ENG200 • Due Friday</span>
                                          </div>
                                      </div>
                                   </div>
                               </div>
                               <div className="h-[75px] grid grid-cols-2 gap-3 shrink-0">
                                   <div className="bg-card border border-border rounded-md relative p-2 flex flex-col items-center justify-center">
                                       <span className="absolute top-2 right-2 text-[6px] text-muted-foreground">Completed Focus: 4</span>
                                       <div className="px-2 py-0.5 rounded-full border border-border text-[7px] mb-1">Focus</div>
                                       <span className="text-xl font-bold font-mono tracking-tighter">25:00</span>
                                   </div>
                                   <div className="bg-card border border-border rounded-md flex flex-col items-center justify-center">
                                       <span className="text-[7px] text-muted-foreground mb-0.5">UTC</span>
                                       <span className="text-xl font-bold font-mono tracking-tighter">01:31:17</span>
                                   </div>
                               </div>
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
