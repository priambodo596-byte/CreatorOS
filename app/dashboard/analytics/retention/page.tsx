'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Clock,
  Activity,
  TrendingDown,
  Calendar,
  Loader2,
  RefreshCw,
  Eye,
  Timer,
  Award,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { useToast } from '@/hooks/use-toast';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  StatCard,
  formatNumber,
  parseDuration,
} from '@/components/dashboard/shared';
import { Inbox } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert seconds → "M:SS" or "H:MM:SS" */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Build a synthetic audience-retention curve from averageViewDuration.
 *
 * The YouTube API gives us the *average* view duration per day, not a
 * second-by-second curve. We model a realistic retention curve that starts
 * at 100% and decays following a typical YouTube retention shape:
 *
 *   retention(t) = 100 * exp(-k * t)
 *
 * calibrated so that the average view duration lands at the observed value.
 * We sample at 10% intervals of the max duration to produce a curve.
 */
function buildRetentionCurve(maxDurationSec: number, avgDurationSec: number) {
  if (maxDurationSec <= 0 || avgDurationSec <= 0) return [];
  // Decay constant: solve avg = max * (1 - exp(-k*max)) / (k*max)
  // Simplified: use k such that retention at avg ≈ 37% (1/e)
  const k = 1 / avgDurationSec;
  const points: { time: string; retention: number; pct: number }[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * maxDurationSec;
    const r = Math.max(0, 100 * Math.exp(-k * t));
    points.push({
      time: formatDuration(t),
      retention: parseFloat(r.toFixed(1)),
      pct: i * 10,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------
function RetentionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'hsl(240 10% 5.5%)',
        border: '1px solid hsl(240 4% 16%)',
        borderRadius: '8px',
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="mb-1 font-medium text-foreground">Time: {label}</p>
      <p style={{ color: payload[0].stroke }} className="font-medium">
        Retention: {payload[0].value}%
      </p>
    </div>
  );
}

function DurationTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'hsl(240 10% 5.5%)',
        border: '1px solid hsl(240 4% 16%)',
        borderRadius: '8px',
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p style={{ color: payload[0].stroke }} className="font-medium">
        Avg Duration: {formatDuration(payload[0].value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RetentionAnalyticsPage() {
  const sync = useYouTubeSync();
  const { toast } = useToast();

  const loading = sync.loading;
  const error = sync.error;
  const analytics = sync.analytics ?? [];

  // -------------------------------------------------------------------------
  // Compute retention data from real analytics rows
  // -------------------------------------------------------------------------
  const computed = useMemo(() => {
    if (!analytics.length) {
      return {
        retentionCurve: [],
        durationOverTime: [],
        avgViewDuration: 0,
        avgRetentionRate: 0,
        bestDay: null as null | { day: string; duration: number },
        maxDuration: 0,
      };
    }

    // Average view duration across all days
    const totalDuration = analytics.reduce((s, r) => s + r.averageViewDuration, 0);
    const avgViewDuration = totalDuration / analytics.length;

    // Max average duration (used as the "video length" proxy for the curve)
    const maxDuration = Math.max(...analytics.map((r) => r.averageViewDuration)) * 1.5;

    // Retention curve
    const retentionCurve = buildRetentionCurve(maxDuration, avgViewDuration);

    // Average retention rate = avgViewDuration / maxDuration (as percentage)
    // This represents what % of a typical video viewers watch on average
    const avgRetentionRate = maxDuration > 0 ? (avgViewDuration / maxDuration) * 100 : 0;

    // Duration over time
    const durationOverTime = analytics
      .map((row) => ({
        name: formatShortDate(row.day),
        duration: row.averageViewDuration,
        views: row.views,
        rawDate: row.day,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    // Best performing day (highest avg view duration)
    let bestDay: null | { day: string; duration: number } = null;
    for (const row of analytics) {
      if (!bestDay || row.averageViewDuration > bestDay.duration) {
        bestDay = { day: row.day, duration: row.averageViewDuration };
      }
    }

    return {
      retentionCurve,
      durationOverTime,
      avgViewDuration,
      avgRetentionRate,
      bestDay,
      maxDuration,
    };
  }, [analytics]);

  // Drop-off point: where retention falls below 50%
  const dropOffPoint = useMemo(() => {
    const point = computed.retentionCurve.find((p) => p.retention < 50);
    return point ?? null;
  }, [computed.retentionCurve]);

  const hasData = analytics.length > 0;

  const handleRefresh = () => {
    sync.refresh();
    toast({ title: 'Refreshing', description: 'Fetching latest retention data.' });
  };

  const handleSync = async () => {
    try {
      await sync.triggerSync();
      toast({ title: 'Sync started', description: 'Pulling fresh analytics from YouTube.' });
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
        title="Retention Analytics"
        description="Analyze audience retention, view duration, and drop-off patterns."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sync.syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
          </div>
        }
      />

      {/* Loading */}
      {loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading retention data…</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={handleRefresh} />}

      {/* Empty */}
      {!loading && !error && !hasData && (
        <EmptyState
          icon={Inbox}
          title="No retention data yet"
          description="Sync your channel analytics to see audience retention curves and view duration trends."
          action={
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sync.syncing ? 'Syncing…' : 'Sync Channel'}
            </Button>
          }
        />
      )}

      {/* Main content */}
      {!loading && !error && hasData && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Avg View Duration"
              value={formatDuration(computed.avgViewDuration)}
              icon={Clock}
              color="text-primary"
              bg="bg-primary/10"
              delay={0}
            />
            <StatCard
              label="Avg Retention Rate"
              value={`${computed.avgRetentionRate.toFixed(1)}%`}
              icon={Activity}
              color="text-accent"
              bg="bg-accent/10"
              delay={0.1}
            />
            <StatCard
              label="Best Day"
              value={
                computed.bestDay
                  ? new Date(computed.bestDay.day + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'
              }
              icon={Award}
              color="text-warning"
              bg="bg-warning/10"
              delay={0.2}
            />
            <StatCard
              label="Drop-off Point"
              value={dropOffPoint ? `~${dropOffPoint.time}` : '—'}
              icon={TrendingDown}
              color="text-destructive"
              bg="bg-destructive/10"
              delay={0.3}
            />
          </div>

          {/* Best day detail */}
          {computed.bestDay && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="glass glass-hover p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                      <Award className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Highest engagement day</p>
                      <p className="font-display text-lg font-semibold">
                        {new Date(computed.bestDay.day + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold text-warning">
                      {formatDuration(computed.bestDay.duration)}
                    </p>
                    <p className="text-xs text-muted-foreground">average view duration</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Retention Curve - Line Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="glass p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Audience Retention Curve</h2>
                    <p className="text-sm text-muted-foreground">
                      Modeled from average view duration data
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    {computed.retentionCurve.length} points
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={computed.retentionCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                    <XAxis dataKey="time" stroke="hsl(240 5% 64.9%)" fontSize={11} />
                    <YAxis
                      stroke="hsl(240 5% 64.9%)"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<RetentionTooltip />} />
                    <ReferenceLine
                      y={50}
                      stroke="hsl(38 92% 50%)"
                      strokeDasharray="4 4"
                      label={{ value: '50% drop-off', fill: 'hsl(38 92% 50%)', fontSize: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="retention"
                      name="Retention"
                      stroke="hsl(346 77% 55%)"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(346 77% 55%)', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>

            {/* Average View Duration Over Time - Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="glass p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold">View Duration Over Time</h2>
                    <p className="text-sm text-muted-foreground">
                      Daily average view duration trend
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="mr-1 h-3 w-3" />
                    {computed.durationOverTime.length} days
                  </Badge>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={computed.durationOverTime}>
                    <defs>
                      <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(265 83% 63%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(265 83% 63%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                    <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={11} />
                    <YAxis
                      stroke="hsl(240 5% 64.9%)"
                      fontSize={11}
                      tickFormatter={(v) => formatDuration(v)}
                    />
                    <Tooltip content={<DurationTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="duration"
                      name="Avg Duration"
                      stroke="hsl(265 83% 63%)"
                      strokeWidth={2}
                      fill="url(#durationGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>
          </div>

          {/* Daily breakdown table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Daily Retention Breakdown</h2>
              <div className="space-y-2">
                {computed.durationOverTime
                  .slice()
                  .reverse()
                  .slice(0, 15)
                  .map((d, i) => {
                    const retentionPct =
                      computed.maxDuration > 0
                        ? (d.duration / computed.maxDuration) * 100
                        : 0;
                    return (
                      <div
                        key={d.rawDate}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {getDayName(d.rawDate).charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {new Date(d.rawDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground">
                                {formatNumber(d.views)} views
                              </span>
                              <span className="text-sm font-medium text-primary">
                                {formatDuration(d.duration)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                              style={{ width: `${Math.min(retentionPct, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-12 text-right text-xs font-medium text-muted-foreground">
                          {retentionPct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </motion.div>

          {/* Methodology note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="glass p-4">
              <div className="flex items-start gap-3">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  The retention curve is modeled from real average view duration data using an
                  exponential decay function. Drop-off point indicates where audience retention
                  falls below 50%. Actual per-video retention curves are available in YouTube
                  Studio for individual videos.
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
