// input:  [section copy props, reduced-motion preference, children section content]
// output: [`LandingSection` reusable wrapper component]
// pos:    [Shared section scaffold used by landing sub-sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LandingSectionProps extends PropsWithChildren {
  id?: string;
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
  reducedMotion?: boolean;
}

export const LandingSection = ({
  id,
  eyebrow,
  title,
  description,
  className,
  reducedMotion = false,
  children,
}: LandingSectionProps) => {
  return (
    <section id={id} className={cn('relative py-16 md:py-24', className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24, filter: 'blur(8px)', scale: 0.985 }}
          whileInView={reducedMotion ? {} : { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {eyebrow ? (
            <p className="landing-font-body text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="landing-font-display text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            {title}
          </h2>
          <p className="landing-font-body max-w-3xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
            {description}
          </p>
        </motion.div>

        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
};
