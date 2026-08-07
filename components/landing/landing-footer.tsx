'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Youtube,
  Twitter,
  Github,
  Linkedin,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const FOOTER_LINKS = {
  Product: ['Features', 'Pricing', 'Changelog', 'Roadmap', 'API Docs'],
  Company: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
  Resources: ['Documentation', 'Tutorials', 'Community', 'Support', 'Status'],
  Legal: ['Privacy', 'Terms', 'Security', 'Cookies', 'GDPR'],
};

export default function LandingFooter() {
  return (
    <footer className="border-t border-border/50 pt-20 pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* CTA banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mb-20 overflow-hidden rounded-3xl glass-strong p-8 text-center md:p-16"
        >
          <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Ready to create your
            <br />
            <span className="gradient-text">next viral video?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join 50,000+ creators using CreatorOS AI to research, script, edit,
            and publish YouTube content at scale.
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
              Book a Demo
            </Button>
          </div>
        </motion.div>

        {/* Footer links */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                <Youtube className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-lg font-bold">
                CreatorOS<span className="text-primary">AI</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              The all-in-one AI-powered YouTube content studio.
            </p>
            <div className="mt-4 flex gap-3">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg glass transition-colors hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-sm font-semibold">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 CreatorOS AI. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with AI for creators worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}
