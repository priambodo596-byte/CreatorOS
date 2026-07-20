'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Target,
  Trophy,
  Search,
  Download,
  Loader2,
  Lightbulb,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  formatNumber,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';

interface SEOAnalytics {
  averageSeoScore: number;
  totalImpressions: number;
  totalClicks: number;
  averageCtr: number;
  averagePosition: number;
  topKeyword: string;
  videos: VideoSEO[];
  trafficSources: TrafficSource[];
  keywordRankings: KeywordRanking[];
  suggestions: string[];
  dateRange: { start: string; end: string };
}

interface VideoSEO {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  seoScore: number;
  titleScore: number;
  descriptionScore: number;
  tagsScore: number;
  thumbnailScore: number;
}

interface TrafficSource {
  source: string;
  views: number;
  percentage: number;
}

interface KeywordRanking {
  keyword: string;
  position: number;
  previousPosition: number;
  impressions: number;
  clicks: number;
}

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '28', label: 'Last 28 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
];

const TRAFFIC_COLORS = [
  'bg-primary',
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
];

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-destructive';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function getPositionChange(current: number, previous: number): number {
  return previous - current; // positive = improved (moved up)
}

export default function SEOAnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SEOAnalytics | null>(null);
  const [dateRange, setDateRange] = useState('28');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const daysAgo = parseInt(dateRange, 10);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

      const { data, error: fetchError } = await supabase
        .from('seo_analytics_cache')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setAnalytics(null);
        setLoading(false);
        return;
      }

      // Parse cached analytics data
      const parsed: SEOAnalytics = {
        averageSeoScore: data.average_seo_score ?? 0,
        totalImpressions: data.total_impressions ?? 0,
        totalClicks: data.total_clicks ?? 0,
        averageCtr: data.average_ctr ?? 0,
        averagePosition: data.average_position ?? 0,
        topKeyword: data.top_keyword ?? '--',
        videos: data.videos ?? [],
        trafficSources: data.traffic_sources ?? [],
        keywordRankings: data.keyword_rankings ?? [],
        suggestions: data.suggestions ?? [],
        dateRange: {
          start: data.date_range_start ?? startDate,
          end: data.date_range_end ?? new Date().toISOString(),
        },
      };

      setAnalytics(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = useCallback(() => {
    if (!analytics) return;

    const reportLines: string[] = [
      'SEO Analytics Report',
      '=====================',
      '',
      `Date Range: ${analytics.dateRange.start} to ${analytics.dateRange.end}`,
      '',
      'Summary',
      '-------',
      `Average SEO Score: ${analytics.averageSeoScore}/100`,
      `Total Impressions: ${analytics.totalImpressions.toLocaleString()}`,
      `Total Clicks: ${analytics.totalClicks.toLocaleString()}`,
      `Average CTR: ${analytics.averageCtr.toFixed(2)}%`,
      `Average Position: ${analytics.averagePosition.toFixed(1)}`,
      `Top Keyword: ${analytics.topKeyword}`,
      '',
      'Per-Video Breakdown',
      '------------------',
      ...analytics.videos.map(
        (v) =>
          `${v.title} | SEO: ${v.seoScore} | Title: ${v.titleScore} | Desc: ${v.descriptionScore} | Tags: ${v.tagsScore} | Thumb: ${v.thumbnailScore}`
      ),
      '',
      'Traffic Sources',
      '---------------',
      ...analytics.trafficSources.map((t) => `${t.source}: ${t.views.toLocaleString()} (${t.percentage.toFixed(1)}%)`),
      '',
      'Keyword Rankings',
      '----------------',
      ...analytics.keywordRankings.map(
        (k) =>
          `${k.keyword} | Position: ${k.position} | Change: ${getPositionChange(k.position, k.previousPosition)} | Impressions: ${k.impressions.toLocaleString()} | Clicks: ${k.clicks.toLocaleString()}`
      ),
      '',
      'Suggestions',
      '------------',
      ...analytics.suggestions.map((s, i) => `${i + 1}. ${s}`),
    ];

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-analytics-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported', description: 'SEO analytics report downloaded' });
  }, [analytics, toast]);

  const maxTrafficViews = useMemo(() => {
    if (!analytics?.trafficSources?.length) return 1;
    return Math.max(...analytics.trafficSources.map((t) => t.views), 1);
  }, [analytics]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO Analytics"
        description="Track your SEO performance, traffic sources, and keyword rankings"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!analytics}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Export Report
            </Button>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="glass p-5">
                    <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-muted/40" />
                    <div className="mb-2 h-8 w-24 animate-pulse rounded bg-muted/40" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted/30" />
                  </Card>
                ))}
              </div>
              <LoadingState message="Loading SEO analytics..." />
            </div>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState message={error} onRetry={loadAnalytics} />
          </motion.div>
        ) : !analytics ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={BarChart3}
              title="No SEO analytics data yet"
              description="Connect your YouTube account and run an SEO audit to see your analytics dashboard. Data will appear here once cached."
            />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-6">
              {/* Dashboard Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Average SEO Score"
                  value={`${analytics.averageSeoScore}`}
                  icon={Target}
                  color={getScoreColor(analytics.averageSeoScore)}
                  bg={analytics.averageSeoScore >= 80 ? 'bg-success/10' : 'bg-primary/10'}
                  change={getScoreLabel(analytics.averageSeoScore)}
                  delay={0}
                />
                <StatCard
                  label="Total Impressions"
                  value={formatNumber(analytics.totalImpressions)}
                  icon={Eye}
                  color="text-blue-500"
                  bg="bg-blue-500/10"
                  delay={0.05}
                />
                <StatCard
                  label="Total Clicks"
                  value={formatNumber(analytics.totalClicks)}
                  icon={MousePointerClick}
                  color="text-purple-500"
                  bg="bg-purple-500/10"
                  delay={0.1}
                />
                <StatCard
                  label="Average CTR"
                  value={`${analytics.averageCtr.toFixed(2)}%`}
                  icon={TrendingUp}
                  color={analytics.averageCtr >= 5 ? 'text-success' : 'text-yellow-500'}
                  bg={analytics.averageCtr >= 5 ? 'bg-success/10' : 'bg-yellow-500/10'}
                  delay={0.15}
                />
                <StatCard
                  label="Average Position"
                  value={analytics.averagePosition.toFixed(1)}
                  icon={BarChart3}
                  color={analytics.averagePosition <= 10 ? 'text-success' : 'text-orange-500'}
                  bg={analytics.averagePosition <= 10 ? 'bg-success/10' : 'bg-orange-500/10'}
                  delay={0.2}
                />
                <StatCard
                  label="Top Keyword"
                  value={analytics.topKeyword}
                  icon={Trophy}
                  color="text-primary"
                  bg="bg-primary/10"
                  delay={0.25}
                />
              </div>

              {/* Per-Video SEO Breakdown */}
              {analytics.videos.length > 0 && (
                <Card className="glass p-5">
                  <h3 className="mb-4 font-display text-lg font-semibold">Per-Video SEO Breakdown</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[35%]">Video</TableHead>
                          <TableHead>SEO Score</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Thumbnail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.videos.map((video, i) => (
                          <motion.tr
                            key={video.videoId || i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.03, 0.5) }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {video.thumbnailUrl ? (
                                  <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="h-10 w-16 shrink-0 rounded object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted/40">
                                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="line-clamp-2 text-sm font-medium">
                                  {video.title}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getScoreBadgeVariant(video.seoScore)}>
                                {video.seoScore}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium', getScoreColor(video.titleScore))}>
                                  {video.titleScore}
                                </span>
                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      video.titleScore >= 80 ? 'bg-success' : video.titleScore >= 60 ? 'bg-primary' : 'bg-destructive'
                                    )}
                                    style={{ width: `${video.titleScore}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium', getScoreColor(video.descriptionScore))}>
                                  {video.descriptionScore}
                                </span>
                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      video.descriptionScore >= 80 ? 'bg-success' : video.descriptionScore >= 60 ? 'bg-primary' : 'bg-destructive'
                                    )}
                                    style={{ width: `${video.descriptionScore}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium', getScoreColor(video.tagsScore))}>
                                  {video.tagsScore}
                                </span>
                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      video.tagsScore >= 80 ? 'bg-success' : video.tagsScore >= 60 ? 'bg-primary' : 'bg-destructive'
                                    )}
                                    style={{ width: `${video.tagsScore}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium', getScoreColor(video.thumbnailScore))}>
                                  {video.thumbnailScore}
                                </span>
                                <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      video.thumbnailScore >= 80 ? 'bg-success' : video.thumbnailScore >= 60 ? 'bg-primary' : 'bg-destructive'
                                    )}
                                    style={{ width: `${video.thumbnailScore}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}

              {/* Traffic Sources + Keyword Rankings */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Traffic Sources */}
                {analytics.trafficSources.length > 0 && (
                  <Card className="glass p-5">
                    <h3 className="mb-4 font-display text-lg font-semibold">Traffic Sources</h3>
                    <div className="space-y-3">
                      {analytics.trafficSources.map((source, i) => (
                        <motion.div
                          key={source.source}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{source.source}</span>
                            <span className="text-muted-foreground">
                              {formatNumber(source.views)} ({source.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-6 overflow-hidden rounded-lg bg-muted/30">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(source.views / maxTrafficViews) * 100}%` }}
                              transition={{ delay: i * 0.05, duration: 0.5 }}
                              className={cn(
                                'flex h-full items-center rounded-lg px-2 text-xs font-medium text-white',
                                TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]
                              )}
                            >
                              {source.percentage >= 10 && `${source.percentage.toFixed(0)}%`}
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Keyword Rankings */}
                {analytics.keywordRankings.length > 0 && (
                  <Card className="glass p-5">
                    <h3 className="mb-4 font-display text-lg font-semibold">Keyword Rankings</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Keyword</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Change</TableHead>
                            <TableHead>Clicks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.keywordRankings.map((kr, i) => {
                            const change = getPositionChange(kr.position, kr.previousPosition);
                            return (
                              <motion.tr
                                key={`${kr.keyword}-${i}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                              >
                                <TableCell className="text-sm font-medium">{kr.keyword}</TableCell>
                                <TableCell>
                                  <Badge variant={kr.position <= 3 ? 'default' : 'secondary'}>
                                    #{kr.position}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {change > 0 ? (
                                    <span className="flex items-center gap-1 text-xs text-success">
                                      <TrendingUp className="h-3 w-3" />
                                      +{change}
                                    </span>
                                  ) : change < 0 ? (
                                    <span className="flex items-center gap-1 text-xs text-destructive">
                                      <TrendingUp className="h-3 w-3 rotate-180" />
                                      {change}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {formatNumber(kr.clicks)}
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>

              {/* Suggestions */}
              {analytics.suggestions.length > 0 && (
                <Card className="glass p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-display text-lg font-semibold">SEO Suggestions</h3>
                  </div>
                  <div className="space-y-2">
                    {analytics.suggestions.map((suggestion, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3"
                      >
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground">{suggestion}</span>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
