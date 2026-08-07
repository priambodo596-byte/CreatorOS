'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Play,
  XCircle,
  Copy,
  Trash2,
  Activity,
  Inbox,
  Calendar,
  Timer,
  RotateCw,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
} from '@/components/dashboard/shared';
import {
  fetchJobs,
  insertJob,
  updateJob,
  deleteJob,
  fetchWorkflows,
  insertActivityLog,
  type ScheduledJobRow,
  type WorkflowRow,
} from '@/lib/automation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type JobStatus = ScheduledJobRow['status'];

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function computeDuration(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return new Date(end).getTime() - new Date(start).getTime();
}

function getStatusMeta(status: JobStatus) {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Completed' };
    case 'failed':
      return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' };
    case 'running':
      return { icon: Loader2, color: 'text-warning', bg: 'bg-warning/10', label: 'Running' };
    case 'queued':
      return { icon: Clock, color: 'text-info', bg: 'bg-info/10', label: 'Queued' };
    case 'cancelled':
      return { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Cancelled' };
    default:
      return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20', label: status };
  }
}

// Tabs that map to status filters. 'all' and 'upcoming' are virtual tabs.
const TAB_VALUES = ['all', 'upcoming', 'queued', 'running', 'completed', 'failed'] as const;
type TabValue = (typeof TAB_VALUES)[number];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ScheduledJobsPage() {
  const { toast } = useToast();

  const [jobs, setJobs] = useState<ScheduledJobRow[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('all');

  // Schedule-new-job dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWorkflowId, setNewWorkflowId] = useState<string>('');
  const [newScheduledFor, setNewScheduledFor] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('5');
  const [submitting, setSubmitting] = useState(false);

  // Per-job action in-flight tracking (by job id)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkflows = useCallback(async () => {
    try {
      const data = await fetchWorkflows();
      setWorkflows(data);
    } catch {
      // Non-fatal: workflows selector will just be empty.
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadWorkflows();
  }, [loadJobs, loadWorkflows]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const running = jobs.filter((j) => j.status === 'running').length;
    return { total, completed, failed, running };
  }, [jobs]);

  const tabCounts = useMemo(() => {
    const now = Date.now();
    return {
      all: jobs.length,
      upcoming: jobs.filter((j) => j.status === 'queued' && new Date(j.scheduled_for).getTime() > now).length,
      queued: jobs.filter((j) => j.status === 'queued').length,
      running: jobs.filter((j) => j.status === 'running').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    } as Record<TabValue, number>;
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const now = Date.now();
    switch (tab) {
      case 'all':
        return jobs;
      case 'upcoming':
        return jobs.filter((j) => j.status === 'queued' && new Date(j.scheduled_for).getTime() > now);
      case 'queued':
        return jobs.filter((j) => j.status === 'queued');
      case 'running':
        return jobs.filter((j) => j.status === 'running');
      case 'completed':
        return jobs.filter((j) => j.status === 'completed');
      case 'failed':
        return jobs.filter((j) => j.status === 'failed');
      default:
        return jobs;
    }
  }, [jobs, tab]);

  const workflowMap = useMemo(() => {
    const m = new Map<string, WorkflowRow>();
    workflows.forEach((w) => m.set(w.id, w));
    return m;
  }, [workflows]);

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

  // Replace a job in local state immediately (optimistic) — used after updates.
  const patchJob = (id: string, patch: Partial<ScheduledJobRow>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleRetry = async (job: ScheduledJobRow) => {
    setBusy(job.id, true);
    try {
      const updated = await updateJob(job.id, {
        status: 'queued',
        started_at: null,
        finished_at: null,
        duration_ms: null,
        error_message: null,
        retry_count: job.retry_count + 1,
      });
      patchJob(job.id, updated);
      await insertActivityLog({
        module: 'automation',
        action: 'job.retry',
        entity_type: 'scheduled_job',
        entity_id: job.id,
        details: { name: job.name, retry_count: job.retry_count + 1 },
        level: 'info',
      });
      toast({ title: 'Job re-queued', description: `"${job.name}" has been queued for retry.` });
    } catch (e: any) {
      toast({
        title: 'Retry failed',
        description: e?.message ?? 'Could not retry job.',
        variant: 'destructive',
      });
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleCancel = async (job: ScheduledJobRow) => {
    setBusy(job.id, true);
    try {
      const updated = await updateJob(job.id, { status: 'cancelled' });
      patchJob(job.id, updated);
      await insertActivityLog({
        module: 'automation',
        action: 'job.cancel',
        entity_type: 'scheduled_job',
        entity_id: job.id,
        details: { name: job.name },
        level: 'warning',
      });
      toast({ title: 'Job cancelled', description: `"${job.name}" was cancelled.` });
    } catch (e: any) {
      toast({
        title: 'Cancel failed',
        description: e?.message ?? 'Could not cancel job.',
        variant: 'destructive',
      });
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleRunNow = async (job: ScheduledJobRow) => {
    setBusy(job.id, true);
    const startedAt = new Date().toISOString();
    try {
      // Step 1: set to running with started_at
      const running = await updateJob(job.id, {
        status: 'running',
        started_at: startedAt,
        finished_at: null,
        duration_ms: null,
        error_message: null,
      });
      patchJob(job.id, running);

      toast({ title: 'Job started', description: `"${job.name}" is now running…` });

      // Step 2: simulate completion after 2s
      setTimeout(async () => {
        const finishedAt = new Date().toISOString();
        const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
        try {
          const completed = await updateJob(job.id, {
            status: 'completed',
            finished_at: finishedAt,
            duration_ms: durationMs,
          });
          patchJob(job.id, completed);
          await insertActivityLog({
            module: 'automation',
            action: 'job.run_now',
            entity_type: 'scheduled_job',
            entity_id: job.id,
            details: { name: job.name, duration_ms: durationMs },
            level: 'success',
          });
          toast({
            title: 'Job completed',
            description: `"${job.name}" finished in ${formatDurationMs(durationMs)}.`,
          });
        } catch (e: any) {
          // Mark failed locally if completion update fails
          const failed = await updateJob(job.id, {
            status: 'failed',
            finished_at: finishedAt,
            duration_ms: durationMs,
            error_message: e?.message ?? 'Completion update failed',
          }).catch(() => null);
          if (failed) patchJob(job.id, failed);
          toast({
            title: 'Job failed',
            description: e?.message ?? 'Could not complete job.',
            variant: 'destructive',
          });
        } finally {
          setBusy(job.id, false);
        }
      }, 2000);
    } catch (e: any) {
      setBusy(job.id, false);
      toast({
        title: 'Run failed',
        description: e?.message ?? 'Could not start job.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (job: ScheduledJobRow) => {
    setBusy(job.id, true);
    try {
      const dup = await insertJob({
        name: `${job.name} (copy)`,
        workflow_id: job.workflow_id ?? undefined,
        agent_id: job.agent_id ?? undefined,
        scheduled_for: new Date().toISOString(),
        priority: job.priority,
        max_retries: job.max_retries,
      });
      setJobs((prev) => [dup, ...prev]);
      await insertActivityLog({
        module: 'automation',
        action: 'job.duplicate',
        entity_type: 'scheduled_job',
        entity_id: dup.id,
        details: { name: dup.name, source_id: job.id },
        level: 'info',
      });
      toast({ title: 'Job duplicated', description: `Created "${dup.name}".` });
    } catch (e: any) {
      toast({
        title: 'Duplicate failed',
        description: e?.message ?? 'Could not duplicate job.',
        variant: 'destructive',
      });
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleDelete = async (job: ScheduledJobRow) => {
    setBusy(job.id, true);
    try {
      await deleteJob(job.id);
      removeJob(job.id);
      await insertActivityLog({
        module: 'automation',
        action: 'job.delete',
        entity_type: 'scheduled_job',
        entity_id: job.id,
        details: { name: job.name },
        level: 'warning',
      });
      toast({ title: 'Job deleted', description: `"${job.name}" was removed.` });
    } catch (e: any) {
      toast({
        title: 'Delete failed',
        description: e?.message ?? 'Could not delete job.',
        variant: 'destructive',
      });
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleCreateJob = async () => {
    if (!newName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a job name.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const scheduledFor = newScheduledFor
        ? new Date(newScheduledFor).toISOString()
        : new Date().toISOString();
      const created = await insertJob({
        name: newName.trim(),
        workflow_id: newWorkflowId || undefined,
        scheduled_for: scheduledFor,
        priority: Number(newPriority) || 5,
      });
      setJobs((prev) => [created, ...prev]);
      await insertActivityLog({
        module: 'automation',
        action: 'job.create',
        entity_type: 'scheduled_job',
        entity_id: created.id,
        details: { name: created.name, scheduled_for: scheduledFor },
        level: 'success',
      });
      toast({ title: 'Job scheduled', description: `"${created.name}" has been scheduled.` });
      // Reset form
      setNewName('');
      setNewWorkflowId('');
      setNewScheduledFor('');
      setNewPriority('5');
      setDialogOpen(false);
    } catch (e: any) {
      toast({
        title: 'Create failed',
        description: e?.message ?? 'Could not schedule job.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderActions = (job: ScheduledJobRow) => {
    const busy = busyIds.has(job.id);
    const isRunning = job.status === 'running';
    const isFailed = job.status === 'failed';
    const isQueued = job.status === 'queued';

    return (
      <div className="flex items-center gap-1.5">
        {/* Retry — only for failed jobs */}
        {isFailed && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleRetry(job)}
            title="Retry"
          >
            <RotateCw className={cn('h-4 w-4', busy && 'animate-spin')} />
            <span className="sr-only">Retry</span>
          </Button>
        )}

        {/* Cancel — for queued or running jobs */}
        {(isQueued || isRunning) && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleCancel(job)}
            title="Cancel"
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Cancel</span>
          </Button>
        )}

        {/* Run Now — for queued or failed jobs (not already running) */}
        {!isRunning && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleRunNow(job)}
            title="Run Now"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="sr-only">Run Now</span>
          </Button>
        )}

        {/* Duplicate — always available */}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => handleDuplicate(job)}
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Duplicate</span>
        </Button>

        {/* Delete — always available */}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => handleDelete(job)}
          title="Delete"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Scheduled Jobs"
        description="Monitor and manage scheduled automation jobs, retries, and execution history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule New Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Job</DialogTitle>
                  <DialogDescription>
                    Create a new scheduled job linked to a workflow. It will be queued and executed at the scheduled time.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="job-name">Job Name</Label>
                    <Input
                      id="job-name"
                      placeholder="e.g. Daily channel sync"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  {/* Workflow selector */}
                  <div className="space-y-2">
                    <Label>Workflow</Label>
                    <Select value={newWorkflowId} onValueChange={setNewWorkflowId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workflow" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflows.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No workflows available
                          </SelectItem>
                        ) : (
                          workflows.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scheduled for */}
                  <div className="space-y-2">
                    <Label htmlFor="job-scheduled-for">Scheduled For</Label>
                    <Input
                      id="job-scheduled-for"
                      type="datetime-local"
                      value={newScheduledFor}
                      onChange={(e) => setNewScheduledFor(e.target.value)}
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {p} {p <= 3 ? '(High)' : p >= 8 ? '(Low)' : '(Normal)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateJob} disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Schedule Job
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value={stats.total}
          icon={Activity}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          color="text-success"
          bg="bg-success/10"
          delay={0.05}
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={AlertCircle}
          color="text-destructive"
          bg="bg-destructive/10"
          delay={0.1}
        />
        <StatCard
          label="Running"
          value={stats.running}
          icon={Loader2}
          color="text-warning"
          bg="bg-warning/10"
          delay={0.15}
        />
      </div>

      {/* Loading */}
      {loading && <LoadingState message="Loading scheduled jobs…" />}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={loadJobs} />}

      {/* Empty */}
      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No scheduled jobs yet"
          description="Schedule your first automation job to run a workflow on a recurring or one-time basis. Job history and execution details will appear here."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Schedule New Job
            </Button>
          }
        />
      )}

      {/* Main content */}
      {!loading && !error && jobs.length > 0 && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="glass">
            {TAB_VALUES.map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t} ({tabCounts[t]})
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Job list */}
          <div className="mt-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredJobs.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="glass p-8 text-center">
                    <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No {tab !== 'all' ? tab : ''} jobs found.
                    </p>
                  </Card>
                </motion.div>
              ) : (
                filteredJobs.map((job, i) => {
                  const meta = getStatusMeta(job.status);
                  const StatusIcon = meta.icon;
                  const wf = job.workflow_id ? workflowMap.get(job.workflow_id) : null;
                  const duration = job.duration_ms ?? computeDuration(job.started_at, job.finished_at);
                  const busy = busyIds.has(job.id);

                  return (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <Card className={cn('glass glass-hover p-4', busy && 'opacity-70')}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          {/* Status icon */}
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                              meta.bg,
                            )}
                          >
                            <StatusIcon
                              className={cn('h-5 w-5', meta.color, job.status === 'running' && 'animate-spin')}
                            />
                          </div>

                          {/* Job info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-display text-sm font-semibold">
                                {job.name}
                              </span>
                              <Badge variant="outline" className={cn('text-xs', meta.color)}>
                                {meta.label}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Priority {job.priority}
                              </Badge>
                            </div>

                            {/* Workflow / agent link */}
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {wf ? (
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Workflow:{' '}
                                  <a
                                    href={`/dashboard/automation/workflows`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    {wf.name}
                                  </a>
                                </span>
                              ) : job.workflow_id ? (
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Workflow: <span className="font-mono">{job.workflow_id.slice(0, 8)}…</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  No workflow linked
                                </span>
                              )}
                            </div>

                            {/* Timestamps row */}
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Scheduled: {formatDateTime(job.scheduled_for)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Play className="h-3 w-3" />
                                Started: {formatDateTime(job.started_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Finished: {formatDateTime(job.finished_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                Duration: {formatDurationMs(duration)}
                              </span>
                              <span className="flex items-center gap-1">
                                <RotateCw className="h-3 w-3" />
                                Retries: {job.retry_count}
                              </span>
                            </div>

                            {/* Error message */}
                            {job.error_message && (
                              <p className="mt-1 text-xs text-destructive">⚠ {job.error_message}</p>
                            )}
                          </div>

                          {/* Action buttons */}
                          {renderActions(job)}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      )}
    </div>
  );
}
