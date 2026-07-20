'use client';

import { motion } from 'framer-motion';
import {
  Search,
  PenLine,
  Image as ImageIcon,
  Video,
  TrendingUp,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { FEATURES } from '@/lib/landing-data';

const iconMap: Record<string, LucideIcon> = {
  Search,
  PenLine,
  Image: ImageIcon,
  Video,
  TrendingUp,
  Upload,
};

export default function LandingFeatures() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Everything you need to
            <span className="gradient-text"> create &amp; grow</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One AI-powered platform replaces a dozen tools. Research, write,
            edit, optimize, and publish — all in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = iconMap[feature.icon];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl glass glass-hover p-6"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-${feature.color}/10 text-${feature.color}`}
                >
                  {Icon && <Icon className="h-6 w-6" />}
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
