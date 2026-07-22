'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  Play,
  TrendingUp,
  Youtube,
  PenLine,
  Image as ImageIcon,
  Video,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATS } from '@/lib/landing-data';

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Animated background */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute right-0 top-40 -z-10 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[100px]" />
      <div className="absolute left-0 top-60 -z-10 h-[400px] w-[400px] rounded-full bg-info/15 blur-[100px]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Powered by GPT-4o &amp; Claude 3.5 Sonnet
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Your entire YouTube studio,
            <br />
            <span className="gradient-text">supercharged by AI</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            From trend research to publishing — CreatorOS AI handles script
            writing, thumbnails, SEO, video editing, and analytics. One
            platform. Endless content.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 sm:w-auto"
              >
                Start Creating Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <Play className="mr-2 h-4 w-4" />
              Watch Demo
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · Free forever plan
          </p>
        </motion.div>

        {/* AI Assistant Illustration / Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-primary via-accent to-info opacity-20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl glass-strong p-1">
            <div className="rounded-xl bg-background/80 p-6">
              {/* Mock dashboard preview */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
                <div className="ml-3 flex-1 rounded-md bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                  app.creatoros.ai/dashboard
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { icon: TrendingUp, label: 'Total Views', value: '2.4M', change: '+18%', color: 'text-primary' },
                  { icon: Youtube, label: 'Subscribers', value: '184K', change: '+12%', color: 'text-accent' },
                  { icon: Video, label: 'Watch Time', value: '48K hrs', change: '+24%', color: 'text-info' },
                  { icon: PenLine, label: 'AI Scripts', value: '1,240', change: '+45%', color: 'text-success' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="rounded-xl glass p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      <span className="text-xs font-medium text-success">{stat.change}</span>
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="rounded-xl glass p-4 md:col-span-2"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">AI Copilot</span>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Generate a script about &ldquo;AI in 2026&rdquo; with a strong hook...
                    </div>
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                      <span className="text-primary">AI:</span> Here&apos;s a 3-hook
                      opener for your video...
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="rounded-xl glass p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Thumbnails</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="aspect-video rounded-lg bg-gradient-to-br from-primary/20 to-accent/20"
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 grid grid-cols-2 gap-8 border-t border-border/50 pt-12 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-3xl font-bold gradient-text">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
