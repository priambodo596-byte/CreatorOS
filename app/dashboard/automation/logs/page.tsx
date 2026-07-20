'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  SearchInput,
} from '@/components/dashboard/shared';
import {
  fetchActivityLogs,
  deleteActivityLog,
  insertActivityLog,
  type ActivityLogRow,
} from '@/lib/automation';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

type LogLevel = ActivityLogRow['level'];

const MODULE_OPTIONS = [
  'all',
  'workflows',
  'agents',
  'jobs',
  'webhooks',
  'integrations',
  'assets',
  'system',
] as const;
type ModuleFilter = (typeof MODULE_OPTIONS)[number];

const LEVEL_OPTIONS = ['all', 'info', 'success', 'warning', 'error'] as const;
type LevelFilter = (typeof LEVEL_OPTIONS)[number];

const LEVEL_META: Record<
  LogLevel,
  { icon: typeof Info; color: string; bg: string; ring: string; label: string }
> = {
  info: {
    icon: Info,
    color: 'text-info',
    bg: 'bg-info/10',
    ring: 'ring-info/20',
    label: 'Info',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10',
    ring: 'ring-success/20',
    label: 'Success',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    label: 'Warning',
  },
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    ring: 'ring-destructive/20',
    label: 'Error',
  },
};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// ---------------------------------------------------------------------------
// Timeline entry component
// ---------------------------------------------------------------------------

function TimelineEntry({
  log,
  index,
  onDelete,
  busy,
}: {
  log: ActivityLogRow;
  index: number;
  onDelete: (log: ActivityLogRow) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = LEVEL_META[log.level] ?? LEVEL_META.info;
  const LevelIcon = meta.icon;
  const hasDetails =
    log.details && Object.keys(log.details as Record<string, unknown>).length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="relative pl-10"
    >
      {/* Vertical connecting line */}
      <span
        className="absolute left-[18px] top-0 h-full w-px bg-border"
        aria-hidden
      />
      {/* Icon node */}
      <div
        className={cn(
          'absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full ring-2',
          meta.bg,
          meta.ring,
        )}
      >
        <LevelIcon className={cn('h-4 w-4', meta.color)} />
      </div>

      <Card className={cn('glass glass-hover mb-3 p-4', busy && 'opacity-70')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('text-xs capitalize', meta.color)}>
                {meta.label}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">
                {log.module}
              </Badge>
              <span className="font-display text-sm font-semibold">{log.action}</span>
            </div>

            {/* Entity info */}
            {(log.entity_type || log.entity_id) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {log.entity_type && (
                  <span>
                    <span className="text-muted-foreground/70">Type:</span>{' '}
                    <span className="font-medium">{log.entity_type}</span>
                  </span>
                )}
                {log.entity_id && (
                  <span>
                    <span className="text-muted-foreground/70">ID:</span>{' '}
                    <span className="font-mono text-xs">
                      {log.entity_id.length > 12
                        ? `${log.entity_id.slice(0, 12)}…`
                        : log.entity_id}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Expandable details */}
            {hasDetails && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {expanded ? 'Hide details' : 'Show details'}
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.pre
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground/80"
                    >
                      <code className="font-mono">
                        {safeJsonStringify(log.details)}
                      </code>
                    </motion.pre>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right: timestamp + delete */}
          <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-end">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground/80">
                {formatTimestamp(log.created_at)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatRelative(log.created_at)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onDelete(log)}
              title="Delete log entry"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ActivityLogsPage() {
  const { toast } = useToast();

  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [search, setSearch] = useState('');

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActivityLogs(undefined, 200);
      setLogs(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = logs.length;
    const errors = logs.filter((l) => l.level === 'error').length;
    const warnings = logs.filter((l) => l.level === 'warning').length;
    const success = logs.filter((l) => l.level === 'success').length;
    return { total, errors, warnings, success };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (q && !log.action.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, moduleFilter, levelFilter, search]);

  // -------------------------------------------------------------------------
  // Busy helpers
  // -------------------------------------------------------------------------
  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleDelete = async (log: ActivityLogRow) => {
    setBusy(log.id, true);
    try {
      await deleteActivityLog(log.id);
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      await insertActivityLog({
        module: 'system',
        action: 'log.delete',
        entity_type: 'activity_log',
        entity_id: log.id,
        details: { action: log.action, module: log.module },
        level: 'warning',
      });
      toast({ title: 'Log deleted', description: 'The activity log entry was removed.' });
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message ?? 'Could not delete log entry.',
        variant: 'destructive',
      });
    } finally {
      setBusy(log.id, false);
    }
  };

  const handleClearFilters = () => {
    setModuleFilter('all');
    setLevelFilter('all');
    setSearch('');
  };

  const hasActiveFilters =
    moduleFilter !== 'all' || levelFilter !== 'all' || search.trim() !== '';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Activity Logs"
        description="A timeline of all automation activity — workflow runs, agent actions, job executions, webhook deliveries, and system events."
        actions={
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Logs"
          value={stats.total}
          icon={Activity}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Errors"
          value={stats.errors}
          icon={AlertCircle}
          color="text-destructive"
          bg="bg-destructive/10"
          delay={0.05}
        />
        <StatCard
          label="Warnings"
          value={stats.warnings}
          icon={AlertTriangle}
          color="text-warning"
          bg="bg-warning/10"
          delay={0.1}
        />
        <StatCard
          label="Success"
          value={stats.success}
          icon={CheckCircle2}
          color="text-success"
          bg="bg-success/10"
          delay={0.15}
        />
      </div>

      {/* Filters bar */}
      <Card className="glass p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </div>

          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Module filter */}
            <Select
              value={moduleFilter}
              onValueChange={(v) => setModuleFilter(v as ModuleFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m === 'all' ? 'All Modules' : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Level filter */}
            <Select
              value={levelFilter}
              onValueChange={(v) => setLevelFilter(v as LevelFilter)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">
                    {l === 'all' ? 'All Levels' : l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by action…"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="shrink-0"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Result count */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3 w-3" />
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </Card>

      {/* Loading */}
      {loading && <LoadingState message="Loading activity logs…" />}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={loadLogs} />}

      {/* Empty — no logs at all */}
      {!loading && !error && logs.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No activity logs yet"
          description="Activity from workflows, agents, jobs, webhooks, and system events will be recorded here automatically as you use the automation suite."
        />
      )}

      {/* Empty — filtered results */}
      {!loading && !error && logs.length > 0 && filteredLogs.length === 0 && (
        <EmptyState
          icon={Search}
          title="No matching logs"
          description="No log entries match the current filters. Try adjusting your search or clearing filters."
          action={
            <Button size="sm" variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          }
        />
      )}

      {/* Timeline */}
      {!loading && !error && filteredLogs.length > 0 && (
        <Card className="glass p-4 md:p-6">
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="relative">
              <AnimatePresence mode="popLayout">
                {filteredLogs.map((log, i) => (
                  <TimelineEntry
                    key={log.id}
                    log={log}
                    index={i}
                    onDelete={handleDelete}
                    busy={busyIds.has(log.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
