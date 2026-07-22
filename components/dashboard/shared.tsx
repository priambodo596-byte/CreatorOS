'use client';

import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Search, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

// ─── PageHeader ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No data yet',
  description = 'Data will appear here once available.',
  action,
}: {
  icon?: typeof Inbox;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="glass p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Card>
  );
}

// ─── ErrorState ──────────────────────────────────────────────────────────────
export function ErrorState({
  message = 'Something went wrong',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="glass p-5">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium">Error loading data</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── LoadingState ─────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <Card className="glass p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </Card>
  );
}

// ─── SkeletonGrid ─────────────────────────────────────────────────────────────
export function SkeletonGrid({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass p-5">
          <div className="mb-4 h-32 w-full animate-pulse rounded-lg bg-muted/40" />
          <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-muted/40" />
          <div className="mb-1 h-3 w-1/2 animate-pulse rounded bg-muted/30" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted/30" />
        </Card>
      ))}
    </div>
  );
}

// ─── SkeletonTable ────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="glass p-5">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 animate-pulse rounded bg-muted/40"
                style={{ maxWidth: `${100 / cols}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-primary',
  bg = 'bg-primary/10',
  change,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: typeof Inbox;
  color?: string;
  bg?: string;
  change?: string;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="glass glass-hover p-5">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          {change && <span className="text-xs font-medium text-muted-foreground">{change}</span>}
        </div>
        <p className="mt-4 font-display text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </Card>
    </motion.div>
  );
}

// ─── formatNumber ────────────────────────────────────────────────────────────
export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── formatBytes ──────────────────────────────────────────────────────────────
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── parseDuration ────────────────────────────────────────────────────────────
export function parseDuration(duration: string): string {
  const match = duration?.match?.(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '--';
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2]?.padStart(2, '0') || '00';
  const s = match[3]?.padStart(2, '0') || '00';
  return `${h}${m}:${s}`;
}
