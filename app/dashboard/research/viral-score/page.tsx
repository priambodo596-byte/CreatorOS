'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  TrendingUp,
  Target,
  Eye,
  MousePointerClick,
  Clock,
  Users,
  Lightbulb,
  Award,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  MessageCircle,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  formatNumber,
} from '@/components/dashboard/shared';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { calculateViralScore, type ViralScoreBreakdown } from '@/lib/youtube-research';

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
  A: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  B: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  C: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  D: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
};

const METRIC_ICONS: Record<string, typeof Eye> = {
  'Click-Through Rate (CTR)': MousePointerClick,
  'Engagement Rate': ThumbsUp,
  'Average View Duration': Clock,
  'View Velocity': TrendingUp,
  'Subscriber Conversion': Users,
};

export default function ViralScorePage() {
  const sync = useYouTubeSync();

  // Calculate viral score from real synced data
  const viralScore = useMemo(
    () => calculateViralScore(sync.analytics, sync.videos),
    [sync.analytics, sync.videos],
  );

  const isLoading = sync.loading;
  const hasError = !!sync.error;
  const hasData = sync.analytics.length > 0 || sync.videos.length > 0;

  const gradeStyle = GRADE_COLORS[viralScore.grade] || GRADE_COLORS['D'];

  // Gauge chart data for recharts RadialBar
  const gaugeData = [{ name: 'Score', value: viralScore.overallScore, fill: 'hsl(346 77% 55%)' }];

  // Breakdown bar chart data
  const breakdownData = viralScore.breakdown.map((b) => ({
    name: b.metric.length > 20 ? b.metric.split(' ')[0] : b.metric,
    fullName: b.metric,
    score: b.score,
    weight: b.weight,
  }));

  // Aggregate stats from analytics
  const totalViews = sync.analytics.reduce((s, a) => s + a.views, 0);
  const totalLikes = sync.analytics.reduce((s, a) => s + a.likes, 0);
  const totalComments = sync.analytics.reduce((s, a) => s + a.comments, 0);
  const totalImpressions = sync.analytics.reduce((s, a) => s + a.impressions, 0);
  const avgCTR = sync.analytics.length > 0
    ? sync.analytics.reduce((s, a) => s + a.impressionsClickThroughRate, 0) / sync.analytics.length
    : 0;
  const netSubs = sync.analytics.reduce((s, a) => s + a.subscribersGained - a.subscribersLost, 0);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Viral Score"
        description="Your channel's viral potential calculated from real YouTube Analytics data — CTR, engagement, watch time, and view velocity."
        actions={
          <div className="flex gap-2">
            {sync.lastSyncAt && (
              <Badge variant="outline" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                Last sync: {sync.lastSyncAt.toLocaleDateString()}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.triggerSync()}
              disabled={sync.syncing}
            >
              {sync.syncing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {sync.syncing ? 'Syncing...' : 'Sync Data'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => sync.refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* States */}
      {isLoading && (
        <>
          <LoadingState message="Loading your analytics data..." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass p-5">
                <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-muted/40" />
                <div className="mb-2 h-7 w-20 animate-pulse rounded bg-muted/40" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/30" />
              </Card>
            ))}
          </div>
        </>
      )}

      {!isLoading && hasError && (
        <ErrorState message={sync.error || 'Failed to load data'} onRetry={() => sync.refresh()} />
      )}

      {!isLoading && !hasError && !hasData && (
        <EmptyState
          icon={Zap}
          title="No analytics data yet"
          description="Sync your YouTube channel to calculate your viral score from real CTR, engagement, watch time, and view velocity metrics."
          action={
            <Button onClick={() => sync.triggerSync()} disabled={sync.syncing}>
              {sync.syncing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {sync.syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          }
        />
      )}

      {/* Results */}
      {!isLoading && !hasError && hasData && (
        <>
          {/* Score Gauge + Grade */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass p-6">
              <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
                {/* Gauge */}
                <div className="relative">
                  <ResponsiveContainer width={240} height={240}>
                    <RadialBarChart
                      innerRadius="70%"
                      outerRadius="100%"
                      data={gaugeData}
                      startAngle={90}
                      endAngle={90 - 360 * (viralScore.overallScore / 100)}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar
                        background={{ fill: 'hsl(240 4% 16%)' }}
                        dataKey="value"
                        cornerRadius={10}
                        fill="hsl(346 77% 55%)"
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: 'spring' }}
                      className="font-display text-5xl font-bold"
                    >
                      {viralScore.overallScore}
                    </motion.span>
                    <span className="text-sm text-muted-foreground">out of 100</span>
                  </div>
                </div>

                {/* Grade + Summary */}
                <div className="flex-1 lg:ml-8">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${gradeStyle.bg} ${gradeStyle.border}`}>
                      <span className={`font-display text-3xl font-bold ${gradeStyle.text}`}>
                        {viralScore.grade}
                      </span>
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold">
                        {viralScore.grade === 'A+' || viralScore.grade === 'A'
                          ? 'Excellent viral potential!'
                          : viralScore.grade === 'B'
                            ? 'Good performance with room to grow'
                            : viralScore.grade === 'C'
                              ? 'Average — needs improvement'
                              : 'Below average — focus on key metrics'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Calculated from {sync.analytics.length} days of analytics data
                      </p>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg glass p-3 text-center">
                      <MousePointerClick className="mx-auto mb-1 h-4 w-4 text-primary" />
                      <p className="font-display text-lg font-bold">{avgCTR.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Avg CTR</p>
                    </div>
                    <div className="rounded-lg glass p-3 text-center">
                      <Eye className="mx-auto mb-1 h-4 w-4 text-accent" />
                      <p className="font-display text-lg font-bold">{formatNumber(totalViews)}</p>
                      <p className="text-xs text-muted-foreground">Views</p>
                    </div>
                    <div className="rounded-lg glass p-3 text-center">
                      <ThumbsUp className="mx-auto mb-1 h-4 w-4 text-success" />
                      <p className="font-display text-lg font-bold">{formatNumber(totalLikes)}</p>
                      <p className="text-xs text-muted-foreground">Likes</p>
                    </div>
                    <div className="rounded-lg glass p-3 text-center">
                      <Users className="mx-auto mb-1 h-4 w-4 text-info" />
                      <p className="font-display text-lg font-bold">
                        {netSubs >= 0 ? '+' : ''}{formatNumber(netSubs)}
                      </p>
                      <p className="text-xs text-muted-foreground">Net Subs</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Breakdown Chart + Details */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Bar Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Score Breakdown</h2>
                {breakdownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={breakdownData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis type="number" domain={[0, 100]} stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(240 5% 64.9%)"
                        fontSize={11}
                        width={120}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: 'hsl(240 10% 5.5%)',
                          border: '1px solid hsl(240 4% 16%)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, _name: string, item: any) => [
                          `${value}/100`,
                          item?.payload?.fullName || '',
                        ]}
                      />
                      <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                        {breakdownData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.score >= 70 ? 'hsl(142 71% 45%)' :
                              entry.score >= 40 ? 'hsl(38 92% 50%)' :
                              'hsl(346 77% 55%)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No breakdown data
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Detailed Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Metric Details</h2>
                <div className="space-y-4">
                  {viralScore.breakdown.map((item: ViralScoreBreakdown, i) => {
                    const Icon = METRIC_ICONS[item.metric] || Target;
                    const scoreColor =
                      item.score >= 70 ? 'text-success' :
                      item.score >= 40 ? 'text-warning' :
                      'text-destructive';
                    return (
                      <motion.div
                        key={item.metric}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${scoreColor}`} />
                            <span className="text-sm font-medium">{item.metric}</span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(item.weight * 100)}% weight
                            </Badge>
                          </div>
                          <span className={`font-display text-lg font-bold ${scoreColor}`}>
                            {item.score}
                          </span>
                        </div>
                        <Progress value={item.score} className="h-2" />
                        <p className="text-xs text-muted-foreground">{item.benchmark}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Top Video */}
          {viralScore.topVideo.videoId && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-warning" />
                  <h2 className="font-display text-lg font-semibold">Top Performing Video</h2>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">{viralScore.topVideo.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Video score: {viralScore.topVideo.score}/100
                    </p>
                  </div>
                  <a
                    href={`https://www.youtube.com/watch?v=${viralScore.topVideo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Watch <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Recommendations */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-display text-lg font-semibold">AI Recommendations</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {viralScore.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-3 rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                    <p className="text-sm text-muted-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
