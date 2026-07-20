'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  Video,
  MessageSquare,
  ListVideo,
  Calendar,
  Filter,
  Activity,
  Inbox,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { useToast } from '@/hooks/use-toast';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  StatCard,
  formatNumber,
} from '@/components/dashboard/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' };
    case 'failed':
      return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
    case 'running':
      return { icon: Loader2, color: 'text-warning', bg: 'bg-warning/10' };
    default:
      return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20' };
  }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ScheduledJobsPage() {
  const sync = useYouTubeSync();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');

  const loading = sync.loading;
  const error = sync.error;
  const syncLogs = sync.syncLogs ?? [];

  // -------------------------------------------------------------------------
  // Filter logs
  // -------------------------------------------------------------------------
  const filteredLogs = useMemo(() => {
    if (filter === 'all') return syncLogs;
    return syncLogs.filter((log) => log.status === filter);
  }, [syncLogs, filter]);

  // -------------------------------------------------------------------------
  // Compute stats
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = syncLogs.length;
    const completed = syncLogs.filter((l) => l.status === 'completed').length;
    const failed = syncLogs.filter((l) => l.status === 'failed').length;
    const running = syncLogs.filter((l) => l.status === 'running').length;
    const totalVideos = syncLogs.reduce((s, l) => s + l.videos_synced, 0);
    const totalComments = syncLogs.reduce((s, l) => s + l.comments_synced, 0);
    const totalPlaylists = syncLogs.reduce((s, l) => s + l.playlists_synced, 0);
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, failed, running, totalVideos, totalComments, totalPlaylists, successRate };
  }, [syncLogs]);

  const handleRefresh = () => {
    sync.refresh();
    toast({ title: 'Refreshing', description: 'Fetching latest sync logs.' });
  };

  const handleSync = async () => {
    try {
      await sync.triggerSync();
      toast({ title: 'Sync triggered', description: 'A new sync job has been started.' });
    } catch (e: any) {
      toast({
        title: 'Sync failed',
        description: e?.message ?? 'Could not trigger sync.',
        variant: 'destructive',
      });
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Scheduled Jobs"
        description="Monitor sync operations, job status, and automation history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              {sync.syncing ? 'Running…' : 'Run Sync Now'}
            </Button>
          </div>
        }
      />

      {/* Loading */}
      {loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading sync logs…</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={handleRefresh} />}

      {/* Empty */}
      {!loading && !error && syncLogs.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No sync jobs yet"
          description="Trigger your first sync to pull channel data, videos, comments, and analytics from YouTube. Job history will appear here."
          action={
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              {sync.syncing ? 'Running…' : 'Run First Sync'}
            </Button>
          }
        />
      )}

      {/* Main content */}
      {!loading && !error && syncLogs.length > 0 && (
        <>
          {/* Stats grid */}
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
              label="Success Rate"
              value={`${stats.successRate.toFixed(0)}%`}
              icon={CheckCircle2}
              color="text-success"
              bg="bg-success/10"
              delay={0.1}
            />
            <StatCard
              label="Videos Synced"
              value={formatNumber(stats.totalVideos)}
              icon={Video}
              color="text-accent"
              bg="bg-accent/10"
              delay={0.2}
            />
            <StatCard
              label="Comments Synced"
              value={formatNumber(stats.totalComments)}
              icon={MessageSquare}
              color="text-info"
              bg="bg-info/10"
              delay={0.3}
            />
          </div>

          {/* Filter tabs */}
          <Tabs value={filter} onValueChange={setFilter}>
            <div className="flex items-center justify-between">
              <TabsList className="glass">
                <TabsTrigger value="all">
                  All ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({stats.completed})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Failed ({stats.failed})
                </TabsTrigger>
                <TabsTrigger value="running">
                  Running ({stats.running})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Job list */}
            <div className="mt-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredLogs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card className="glass p-8 text-center">
                      <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        No {filter !== 'all' ? filter : ''} jobs found
                      </p>
                    </Card>
                  </motion.div>
                ) : (
                  filteredLogs.map((log, i) => {
                    const statusMeta = getStatusIcon(log.status);
                    const StatusIcon = statusMeta.icon;
                    const isRunning = log.status === 'running';

                    return (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card className="glass glass-hover p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            {/* Status icon */}
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statusMeta.bg}`}
                            >
                              <StatusIcon
                                className={`h-5 w-5 ${statusMeta.color} ${
                                  isRunning ? 'animate-spin' : ''
                                }`}
                              />
                            </div>

                            {/* Job info */}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-sm font-semibold capitalize">
                                  {log.sync_type} Sync
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs capitalize ${statusMeta.color}`}
                                >
                                  {log.status}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Started: {formatDateTime(log.started_at)}
                                </span>
                                {log.completed_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Completed: {formatDateTime(log.completed_at)}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Duration: {formatDuration(log.started_at, log.completed_at)}
                                </span>
                              </div>
                              {log.error_message && (
                                <p className="mt-1 text-xs text-destructive">
                                  ⚠ {log.error_message}
                                </p>
                              )}
                            </div>

                            {/* Sync counts */}
                            <div className="flex flex-wrap gap-3">
                              <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5">
                                <Video className="h-3.5 w-3.5 text-accent" />
                                <span className="text-xs font-medium">{log.videos_synced}</span>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-lg bg-info/10 px-2.5 py-1.5">
                                <MessageSquare className="h-3.5 w-3.5 text-info" />
                                <span className="text-xs font-medium">{log.comments_synced}</span>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5">
                                <ListVideo className="h-3.5 w-3.5 text-success" />
                                <span className="text-xs font-medium">{log.playlists_synced}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </Tabs>

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Sync Summary</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border/30 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-xs text-muted-foreground">Completed</span>
                  </div>
                  <p className="mt-1 font-display text-xl font-bold text-success">
                    {stats.completed}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Failed</span>
                  </div>
                  <p className="mt-1 font-display text-xl font-bold text-destructive">
                    {stats.failed}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 p-3">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Total Videos</span>
                  </div>
                  <p className="mt-1 font-display text-xl font-bold">
                    {formatNumber(stats.totalVideos)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 p-3">
                  <div className="flex items-center gap-2">
                    <ListVideo className="h-4 w-4 text-success" />
                    <span className="text-xs text-muted-foreground">Total Playlists</span>
                  </div>
                  <p className="mt-1 font-display text-xl font-bold">
                    {formatNumber(stats.totalPlaylists)}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
