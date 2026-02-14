import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Layers3, Puzzle, SlidersHorizontal } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { LandingSection } from './LandingSection';

interface LandingPillarsProps {
  reducedMotion: boolean;
}

const pillars = [
  {
    icon: Layers3,
    title: 'One-stop',
    description: 'Classes, tasks, and deadlines stay in one clear flow.',
  },
  {
    icon: Puzzle,
    title: 'Extensible',
    description: 'Add new tools when your semester gets more complex.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Customizable',
    description: 'Set up each semester and course the way you like to work.',
  },
] as const;

export const LandingPillars = ({ reducedMotion }: LandingPillarsProps) => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardY0 = useTransform(scrollYProgress, [0, 1], [58, -48]);
  const cardY1 = useTransform(scrollYProgress, [0, 1], [16, -16]);
  const cardY2 = useTransform(scrollYProgress, [0, 1], [-56, 44]);
  const cardRotate0 = useTransform(scrollYProgress, [0, 1], [5.5, -3.5]);
  const cardRotate1 = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const cardRotate2 = useTransform(scrollYProgress, [0, 1], [-5.2, 3.4]);
  const yTransforms = [cardY0, cardY1, cardY2];
  const rotateTransforms = [cardRotate0, cardRotate1, cardRotate2];

  return (
    <LandingSection
      id="pillars"
      eyebrow="Why students like it"
      title="Simple on day one, flexible when you need more"
      description="You can start fast and still shape the workspace as your needs change."
      reducedMotion={reducedMotion}
    >
      <div ref={sectionRef} className="grid gap-4 md:grid-cols-3">
        {pillars.map((pillar, index) => (
          <motion.div
            key={pillar.title}
            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={reducedMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: reducedMotion ? 0 : index * 0.07, duration: 0.35 }}
            style={
              reducedMotion
                ? undefined
                : {
                    y: yTransforms[index],
                    rotateZ: rotateTransforms[index],
                  }
            }
          >
            <Card className="h-full border-border/60 bg-card/70 backdrop-blur-sm">
              <CardContent className="space-y-3 py-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <p className="landing-font-display text-xl font-semibold tracking-tight text-foreground">{pillar.title}</p>
                <p className="landing-font-body text-sm leading-relaxed text-muted-foreground">{pillar.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </LandingSection>
  );
};
