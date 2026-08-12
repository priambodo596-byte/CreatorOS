'use client';

import { motion } from 'framer-motion';
import {
  Search,
  Sparkles,
  Film,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { STEPS } from '@/lib/landing-data';

const iconMap: Record<string, LucideIcon> = {
  Search,
  Sparkles,
  Film,
  Rocket,
};

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            From idea to upload in
            <span className="gradient-text"> four steps</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our AI workflow handles the heavy lifting so you can focus on what
            matters — creating great content.
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line */}
          <div className="absolute left-0 top-12 hidden h-px w-full bg-gradient-to-r from-primary via-accent to-info lg:block" />

          {STEPS.map((step, i) => {
            const Icon = iconMap[step.icon];
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white neon-glow">
                  {Icon && <Icon className="h-6 w-6" />}
                </div>
                <span className="font-display text-sm font-bold text-primary">
                  STEP {step.number}
                </span>
                <h3 className="mt-1 font-display text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
