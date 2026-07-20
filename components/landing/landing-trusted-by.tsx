'use client';

import { motion } from 'framer-motion';
import { TRUSTED_BY } from '@/lib/landing-data';

export default function LandingTrustedBy() {
  return (
    <section className="border-y border-border/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-medium text-muted-foreground">
          Trusted by 50,000+ creators and agencies worldwide
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {TRUSTED_BY.map((brand, i) => (
            <motion.span
              key={brand}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="font-display text-xl font-bold text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {brand}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
