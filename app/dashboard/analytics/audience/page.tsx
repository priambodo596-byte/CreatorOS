'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Globe,
  Users,
  Share2,
  Eye,
  Loader2,
  RefreshCw,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useYouTubeData } from '@/hooks/use-youtube-data';
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
// Chart colors
// ---------------------------------------------------------------------------
const COUNTRY_COLORS = [
  'hsl(346 77% 55%)',
  'hsl(265 83% 63%)',
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(190 85% 45%)',
  'hsl(330 75% 55%)',
  'hsl(160 70% 42%)',
  'hsl(10 80% 55%)',
];

const TRAFFIC_COLORS = [
  'hsl(346 77% 55%)',
  'hsl(265 83% 63%)',
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(190 85% 45%)',
  'hsl(330 75% 55%)',
];

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------
function CountryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div
      style={{
        background: 'hsl(240 10% 5.5%)',
        border: '1px solid hsl(240 4% 16%)',
        borderRadius: '8px',
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="mb-1 font-medium text-foreground">{p.payload.country}</p>
      <p style={{ color: p.payload.fill }} className="font-medium">
        Views: {formatNumber(p.payload.views)}
      </p>
      <p className="text-muted-foreground">
        Share: {((p.payload.views / p.payload.total) * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function TrafficTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div
      style={{
        background: 'hsl(240 10% 5.5%)',
        border: '1px solid hsl(240 4% 16%)',
        borderRadius: '8px',
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="mb-1 font-medium text-foreground">{p.payload.source}</p>
      <p style={{ color: p.payload.fill }} className="font-medium">
        Views: {formatNumber(p.payload.views)}
      </p>
      <p className="text-muted-foreground">
        Share: {((p.payload.views / p.payload.total) * 100).toFixed(1)}%
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AudienceAnalyticsPage() {
  const yt = useYouTubeData();
  const { toast } = useToast();

  const loading = yt.loading;
  const error = yt.error;
  const topCountries = useMemo(() => yt.topCountries ?? [], [yt.topCountries]);
  const trafficSources = useMemo(() => yt.trafficSources ?? [], [yt.trafficSources]);
  const analytics = useMemo(() => yt.analytics ?? [], [yt.analytics]);

  // -------------------------------------------------------------------------
  // Compute aggregate stats from real data
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const totalViews = analytics.reduce((s, r) => s + r.views, 0);
    const topCountry = topCountries.length > 0 ? topCountries[0] : null;
    const topTraffic = trafficSources.length > 0 ? trafficSources[0] : null;
    const totalCountryViews = topCountries.reduce((s, c) => s + c.views, 0);
    const totalTrafficViews = trafficSources.reduce((s, t) => s + t.views, 0);

    return {
      totalViews,
      topCountry,
      topTraffic,
      totalCountryViews,
      totalTrafficViews,
    };
  }, [analytics, topCountries, trafficSources]);

  // Prepare chart data with total for percentage calculation
  const countryChartData = useMemo(
    () =>
      topCountries.map((c) => ({
        ...c,
        total: stats.totalCountryViews || 1,
        fill: COUNTRY_COLORS[0], // will be overridden by Cell
      })),
    [topCountries, stats.totalCountryViews],
  );

  const trafficChartData = useMemo(
    () =>
      trafficSources.map((t) => ({
        ...t,
        total: stats.totalTrafficViews || 1,
        fill: TRAFFIC_COLORS[0],
      })),
    [trafficSources, stats.totalTrafficViews],
  );

  const hasData = topCountries.length > 0 || trafficSources.length > 0;

  const handleRefresh = () => {
    yt.refresh();
    toast({ title: 'Refreshing', description: 'Fetching latest audience data.' });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Audience Analytics"
        description="Understand where your viewers are and how they find your content."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Loading */}
      {loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading audience data…</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={handleRefresh} />}

      {/* Empty */}
      {!loading && !error && !hasData && (
        <EmptyState
          icon={Inbox}
          title="No audience data available"
          description="Connect your YouTube channel and fetch analytics to see geographic and traffic source breakdowns."
          action={
            <Button size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Data
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
              label="Total Views"
              value={formatNumber(stats.totalViews)}
              icon={Eye}
              color="text-primary"
              bg="bg-primary/10"
              delay={0}
            />
            <StatCard
              label="Top Country"
              value={stats.topCountry?.country ?? '—'}
              icon={Globe}
              color="text-accent"
              bg="bg-accent/10"
              delay={0.1}
            />
            <StatCard
              label="Top Traffic Source"
              value={stats.topTraffic?.source ?? '—'}
              icon={Share2}
              color="text-info"
              bg="bg-info/10"
              delay={0.2}
            />
            <StatCard
              label="Countries Reached"
              value={topCountries.length}
              icon={MapPin}
              color="text-success"
              bg="bg-success/10"
              delay={0.3}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top Countries - Pie Chart */}
            {topCountries.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold">Top Countries</h2>
                      <p className="text-sm text-muted-foreground">
                        Geographic distribution of views
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Globe className="mr-1 h-3 w-3" />
                      {topCountries.length} countries
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={countryChartData}
                        dataKey="views"
                        nameKey="country"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {countryChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CountryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Country legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {topCountries.slice(0, 8).map((c, i) => (
                      <div key={c.country} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                        />
                        <span className="truncate text-xs text-muted-foreground">{c.country}</span>
                        <span className="ml-auto text-xs font-medium">
                          {formatNumber(c.views)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Traffic Sources - Bar Chart */}
            {trafficSources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="glass p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold">Traffic Sources</h2>
                      <p className="text-sm text-muted-foreground">
                        How viewers discover your content
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Share2 className="mr-1 h-3 w-3" />
                      {trafficSources.length} sources
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={trafficChartData}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={11}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="source"
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={11}
                        width={120}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<TrafficTooltip />} cursor={{ fill: 'hsl(240 4% 16% / 0.3)' }} />
                      <Bar dataKey="views" name="Views" radius={[0, 6, 6, 0]}>
                        {trafficChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={TRAFFIC_COLORS[index % TRAFFIC_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Traffic legend */}
                  <div className="mt-4 space-y-2">
                    {trafficSources.slice(0, 6).map((t, i) => (
                      <div key={t.source} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length] }}
                        />
                        <span className="truncate text-xs text-muted-foreground">{t.source}</span>
                        <span className="ml-auto text-xs font-medium">{formatNumber(t.views)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Detailed breakdown table */}
          {topCountries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="glass p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Country Breakdown</h2>
                <div className="space-y-2">
                  {topCountries.map((c, i) => {
                    const pct =
                      stats.totalCountryViews > 0
                        ? (c.views / stats.totalCountryViews) * 100
                        : 0;
                    return (
                      <div
                        key={c.country}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{c.country}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatNumber(c.views)} views
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                        <span className="w-12 text-right text-xs font-medium text-muted-foreground">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
