'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored) setCollapsed(stored === 'true');
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 264 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border/50 glass-strong md:flex"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent neon-glow">
              <Youtube className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight">
                CreatorOS<span className="text-primary"> AI</span>
              </span>
            )}
          </Link>
          <button
            onClick={toggle}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="mb-4">
              {!collapsed && section.title && (
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section.title}
                </p>
              )}
              {collapsed && section.title && <div className="mb-2 mt-4 border-t border-border/30" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                        />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      {collapsed && (
                        <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md glass-strong px-2 py-1 text-xs group-hover:block z-50">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Upgrade card */}
        {!collapsed && (
          <div className="m-3 rounded-xl gradient-border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Upgrade to Pro</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Unlock unlimited AI generations and advanced analytics.
            </p>
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-primary to-accent text-white"
            >
              Upgrade Now
            </Button>
          </div>
        )}
      </motion.aside>

      {/* Mobile sidebar */}
      <MobileSidebar pathname={pathname} />
    </>
  );
}

function MobileSidebar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg glass-strong md:hidden"
      >
        <Youtube className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col glass-strong md:hidden"
            >
              <div className="flex h-16 items-center justify-between px-4">
                <Link href="/dashboard" className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                    <Youtube className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-display text-lg font-bold">
                    CreatorOS<span className="text-primary"> AI</span>
                  </span>
                </Link>
                <button onClick={() => setOpen(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
                {NAV_SECTIONS.map((section, sIdx) => (
                  <div key={sIdx} className="mb-4">
                    {section.title && (
                      <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {section.title}
                      </p>
                    )}
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
