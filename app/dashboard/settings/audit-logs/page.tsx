'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Search,
  Clock,
  ChevronDown,
  Activity,
  Hash,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { fetchAuditLogs, type AuditLogRow } from '@/lib/automation';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  SearchInput,
} from '@/components/dashboard/shared';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  } catch {
    return '--';
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ─── Expandable JSON block ───────────────────────────────────────────────────

function JsonBlock({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: Record<string, unknown> | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isEmpty = !data || Object.keys(data).length === 0;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          {label}
          {isEmpty && <span className="text-muted-foreground/60">(empty)</span>}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && !isEmpty && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-auto border-t border-border/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/80"
          >
            {prettyJson(data)}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

function TimelineItem({ log, index }: { log: AuditLogRow; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="relative pl-8"
    >
      {/* Vertical line */}
      <div className="absolute left-[11px] top-0 h-full w-px bg-border/60" />
      {/* Node */}
      <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      </div>

      <Card className="glass glass-hover mb-4 p-4">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                'bg-primary/10 font-mono text-xs text-primary',
              )}
            >
              {log.action}
            </Badge>
            {log.entity_type && (
              <Badge variant="outline" className="text-xs">
                {log.entity_type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span title={formatTimestamp(log.created_at)}>
              {formatRelative(log.created_at)}
            </span>
          </div>
        </div>

        {/* Entity ID */}
        {log.entity_id && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span className="font-mono">{log.entity_id}</span>
          </div>
        )}

        {/* Before / After state comparison */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <JsonBlock label="Before State" data={log.before_state} />
          <JsonBlock label="After State" data={log.after_state} defaultOpen />
        </div>

        {/* Footer: IP + User Agent */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {log.ip_address && (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span className="font-mono">{log.ip_address}</span>
            </span>
          )}
          {log.user_agent && (
            <span className="truncate font-mono opacity-70" title={log.user_agent}>
              {log.user_agent}
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(200);
      setLogs(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load audit logs.';
      setError(msg);
      toast({ title: 'Failed to load audit logs', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter by action (case-insensitive search)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => l.action.toLowerCase().includes(q));
  }, [logs, query]);

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const uniqueActions = new Set(logs.map((l) => l.action)).size;
    const latest = logs.length > 0 ? logs[0].created_at : null;
    return { total, uniqueActions, latest };
  }, [logs]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Audit Logs"
        description="Security-focused timeline of configuration changes and state transitions."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <Activity className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Events"
          value={stats.total}
          icon={Activity}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Unique Actions"
          value={stats.uniqueActions}
          icon={Hash}
          color="text-accent-foreground"
          bg="bg-accent/10"
          delay={0.05}
        />
        <StatCard
          label="Latest Event"
          value={stats.latest ? formatRelative(stats.latest) : '--'}
          icon={Clock}
          color="text-foreground"
          bg="bg-muted"
          change={stats.latest ? formatTimestamp(stats.latest) : undefined}
          delay={0.1}
        />
      </div>

      {/* Filter */}
      <div className="max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Filter by action (e.g. user.update, api_key.create)..."
        />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading audit logs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={query ? 'No matching events' : 'No audit logs yet'}
          description={
            query
              ? 'No events match your filter. Try a different action keyword.'
              : 'Security events will appear here once changes are made to your workspace.'
          }
          action={
            query ? (
              <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                Clear filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="glass p-4 md:p-6">
          <ScrollArea className="h-[600px] pr-3">
            <div className="relative">
              {filtered.map((log, i) => (
                <TimelineItem key={log.id} log={log} index={i} />
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
