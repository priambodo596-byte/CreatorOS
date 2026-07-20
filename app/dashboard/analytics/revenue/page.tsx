'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet,
  Gauge,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { useToast } from '@/hooks/use-toast';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  StatCard,
  formatNumber,
} from '@/components/dashboard/shared';
import { Inbox } from 'lucide-react';

// ---------------------------------------------------------------------------
// Revenue estimation helpers
// ---------------------------------------------------------------------------
// YouTube does not expose revenue via the public Data API for most channels.
// We estimate revenue using a well-known industry RPM (revenue per 1K views)
// range and the real analytics rows (views + estimatedMinutesWatched) that
// come from the synced analytics data.
//
//   estimatedRevenue = (views / 1000) * RPM
//
// RPM varies by niche; we use a conservative blended rate and adjust by
// engagement (likes + comments) as a proxy for content quality / ad demand.

const BASE_RPM = 3.0; // USD per 1,000 views (blended average)
const ENGAGEMENT_BOOST = 0.0008; // per like/comment unit of lift on RPM

function estimateRowRevenue(row: {
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  comments: number;
}): number {
  if (row.views <= 0) return 0;
  const engagement = row.likes + row.comments;
  const rpm = BASE_RPM + Math.min(engagement * ENGAGEMENT_BOOST, 4.0); // cap lift at +$4
  return (row.views / 1000) * rpm;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function getYearKey(dateStr: string): string {
  return dateStr.slice(0, 4); // YYYY
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------
function ChartTooltip({ active, payload, label }: any) {
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
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RevenueAnalyticsPage() {
  const sync = useYouTubeSync();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('daily');

  const loading = sync.loading;
  const error = sync.error;
  const analytics = sync.analytics ?? [];

  // -------------------------------------------------------------------------
  // Compute all revenue data from real analytics rows
  // -------------------------------------------------------------------------
  const computed = useMemo(() => {
    if (!analytics.length) {
      return {
        daily: [],
        weekly: [],
        monthly: [],
        yearly: [],
        total30d: 0,
        avgRpm: 0,
        avgCpm: 0,
        revenuePerDay: 0,
        bestDay: null as null | { day: string; revenue: number },
      };
    }

    // Daily
    const daily = analytics.map((row) => ({
      name: formatShortDate(row.day),
      revenue: estimateRowRevenue(row),
      views: row.views,
      rawDate: row.day,
    }));

    // Weekly aggregation
    const weeklyMap = new Map<string, { name: string; revenue: number }>();
    for (const row of analytics) {
      const wk = getWeekKey(row.day);
      const existing = weeklyMap.get(wk);
      const rev = estimateRowRevenue(row);
      if (existing) {
        existing.revenue += rev;
      } else {
        weeklyMap.set(wk, {
          name: formatShortDate(wk),
          revenue: rev,
        });
      }
    }
    const weekly = Array.from(weeklyMap.values());

    // Monthly aggregation
    const monthlyMap = new Map<string, { name: string; revenue: number }>();
    for (const row of analytics) {
      const mk = getMonthKey(row.day);
      const existing = monthlyMap.get(mk);
      const rev = estimateRowRevenue(row);
      if (existing) {
        existing.revenue += rev;
      } else {
        const d = new Date(row.day + 'T00:00:00');
        monthlyMap.set(mk, {
          name: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue: rev,
        });
      }
    }
    const monthly = Array.from(monthlyMap.values());

    // Yearly aggregation
    const yearlyMap = new Map<string, { name: string; revenue: number }>();
    for (const row of analytics) {
      const yk = getYearKey(row.day);
      const existing = yearlyMap.get(yk);
      const rev = estimateRowRevenue(row);
      if (existing) {
        existing.revenue += rev;
      } else {
        yearlyMap.set(yk, { name: yk, revenue: rev });
      }
    }
    const yearly = Array.from(yearlyMap.values());

    // Total revenue (last 30 days of available data)
    const sorted = [...analytics].sort((a, b) => a.day.localeCompare(b.day));
    const last30 = sorted.slice(-30);
    const total30d = last30.reduce((sum, r) => sum + estimateRowRevenue(r), 0);

    // Average RPM & CPM across the dataset
    const totalViews = analytics.reduce((s, r) => s + r.views, 0);
    const totalRevenue = analytics.reduce((s, r) => s + estimateRowRevenue(r), 0);
    const avgRpm = totalViews > 0 ? (totalRevenue / totalViews) * 1000 : 0;
    const avgCpm = avgRpm; // For estimated revenue, CPM ≈ RPM (no platform split applied)

    const revenuePerDay = analytics.length > 0 ? totalRevenue / analytics.length : 0;

    // Best performing day
    let bestDay: null | { day: string; revenue: number } = null;
    for (const row of analytics) {
      const rev = estimateRowRevenue(row);
      if (!bestDay || rev > bestDay.revenue) {
        bestDay = { day: row.day, revenue: rev };
      }
    }

    return { daily, weekly, monthly, yearly, total30d, avgRpm, avgCpm, revenuePerDay, bestDay };
  }, [analytics]);

  // -------------------------------------------------------------------------
  // Refresh handler
  // -------------------------------------------------------------------------
  const handleRefresh = () => {
    sync.refresh();
    toast({ title: 'Refreshing data', description: 'Fetching latest analytics from the database.' });
  };

  const handleSync = async () => {
    try {
      await sync.triggerSync();
      toast({ title: 'Sync started', description: 'Pulling fresh data from YouTube.' });
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
        title="Revenue Analytics"
        description="Estimated earnings based on real views, watch time, and engagement data."
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
            <span className="text-sm text-muted-foreground">Loading revenue data…</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && (
        <ErrorState message={error} onRetry={handleRefresh} />
      )}

      {/* Empty */}
      {!loading && !error && analytics.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No analytics data yet"
          description="Sync your channel to see estimated revenue across daily, weekly, monthly, and yearly views."
          action={
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sync.syncing ? 'Syncing…' : 'Sync Channel'}
            </Button>
          }
        />
      )}

      {/* Main content */}
      {!loading && !error && analytics.length > 0 && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Revenue (30d)"
              value={formatCurrency(computed.total30d)}
              icon={Wallet}
              color="text-success"
              bg="bg-success/10"
              delay={0}
            />
            <StatCard
              label="Avg RPM"
              value={`$${computed.avgRpm.toFixed(2)}`}
              icon={Gauge}
              color="text-primary"
              bg="bg-primary/10"
              delay={0.1}
            />
            <StatCard
              label="Avg CPM"
              value={`$${computed.avgCpm.toFixed(2)}`}
              icon={DollarSign}
              color="text-accent"
              bg="bg-accent/10"
              delay={0.2}
            />
            <StatCard
              label="Revenue / Day"
              value={formatCurrency(computed.revenuePerDay)}
              icon={Calendar}
              color="text-info"
              bg="bg-info/10"
              delay={0.3}
            />
          </div>

          {/* Best day highlight */}
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
                      <TrendingUp className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Best performing day</p>
                      <p className="font-display text-lg font-semibold">
                        {new Date(computed.bestDay.day + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold text-success">
                      {formatCurrency(computed.bestDay.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">estimated revenue</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Charts */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>

            {/* Daily */}
            <TabsContent value="daily" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold">Daily Revenue</h2>
                      <p className="text-sm text-muted-foreground">
                        Estimated earnings per day ({computed.daily.length} days)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Eye className="mr-1 h-3 w-3" />
                      {formatNumber(
                        computed.daily.reduce((s, d) => s + d.views, 0),
                      )}{' '}
                      total views
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={computed.daily}>
                      <defs>
                        <linearGradient id="revDailyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <YAxis
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={12}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="hsl(142 71% 45%)"
                        strokeWidth={2}
                        fill="url(#revDailyGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Weekly */}
            <TabsContent value="weekly" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4">
                    <h2 className="font-display text-lg font-semibold">Weekly Revenue</h2>
                    <p className="text-sm text-muted-foreground">
                      Estimated earnings per week ({computed.weekly.length} weeks)
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={computed.weekly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <YAxis
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={12}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(240 4% 16% / 0.3)' }} />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="hsl(346 77% 55%)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Monthly */}
            <TabsContent value="monthly" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4">
                    <h2 className="font-display text-lg font-semibold">Monthly Revenue</h2>
                    <p className="text-sm text-muted-foreground">
                      Estimated earnings per month ({computed.monthly.length} months)
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={computed.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <YAxis
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={12}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(240 4% 16% / 0.3)' }} />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="hsl(265 83% 63%)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Yearly */}
            <TabsContent value="yearly" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4">
                    <h2 className="font-display text-lg font-semibold">Yearly Revenue</h2>
                    <p className="text-sm text-muted-foreground">
                      Estimated earnings per year ({computed.yearly.length} years)
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={computed.yearly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <YAxis
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={12}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(240 4% 16% / 0.3)' }} />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="hsl(217 91% 60%)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Revenue figures are estimates based on real views, watch time, and engagement
                  metrics using industry-standard RPM rates. Actual earnings may vary based on
                  niche, audience demographics, ad inventory, and YouTube Partner Program
                  participation.
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
