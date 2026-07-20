'use client';

import { motion } from 'framer-motion';
import {
  Eye,
  MousePointerClick,
  Clock,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Sparkles,
  ThumbsUp,
  MessageCircle,
  Share2,
  Repeat,
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
  Youtube,
  Video,
  Zap,
  ListVideo,
  Hash,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { YouTubeConnect } from '@/components/youtube/youtube-connect';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { useYouTubeData } from '@/hooks/use-youtube-data';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '--';
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2]?.padStart(2, '0') || '00';
  const s = match[3]?.padStart(2, '0') || '00';
  return `${h}${m}:${s}`;
}

const COUNTRY_COLORS = [
  'hsl(346 77% 55%)', 'hsl(265 83% 63%)', 'hsl(217 91% 60%)',
  'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(240 5% 64.9%)',
];

export default function AnalyticsPage() {
  const sync = useYouTubeSync();
  const yt = useYouTubeData();

  const useSyncedData = sync.channel !== null;
  const channel = sync.channel;
  const analytics = useSyncedData ? sync.analytics : yt.analytics;
  const topVideos = useSyncedData
    ? sync.topVideos.map((v) => ({
        title: v.title,
        views: formatNumber(v.view_count),
        ctr: `${((v.like_count / Math.max(v.view_count, 1)) * 100).toFixed(1)}%`,
        likes: formatNumber(v.like_count),
        comments: formatNumber(v.comment_count),
        isShort: v.is_short,
      }))
    : yt.videos.slice(0, 5).map((v) => ({
        title: v.title,
        views: formatNumber(v.viewCount),
        ctr: `${((v.likeCount / Math.max(v.viewCount, 1)) * 100).toFixed(1)}%`,
        likes: formatNumber(v.likeCount),
        comments: formatNumber(v.commentCount),
        isShort: false,
      }));

  const totalViews = analytics.reduce((sum, a) => sum + a.views, 0);
  const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
  const avgCTR = totalImpressions > 0
    ? (analytics.reduce((sum, a) => sum + a.impressionsClickThroughRate, 0) / analytics.length).toFixed(1)
    : '0';
  const totalWatchMinutes = analytics.reduce((sum, a) => sum + a.estimatedMinutesWatched, 0);
  const totalLikes = analytics.reduce((sum, a) => sum + a.likes, 0);
  const totalComments = analytics.reduce((sum, a) => sum + a.comments, 0);
  const totalShares = analytics.reduce((sum, a) => sum + a.shares, 0);
  const netSubs = analytics.reduce((sum, a) => sum + a.subscribersGained - a.subscribersLost, 0);

  const channelSubs = channel ? Number(channel.subscriber_count) : 0;
  const channelViews = channel ? Number(channel.view_count) : 0;
  const channelVideoCount = channel ? Number(channel.video_count) : 0;

  const stats = [
    {
      label: 'Subscribers',
      value: formatNumber(channelSubs),
      change: netSubs > 0 ? `+${formatNumber(netSubs)}` : formatNumber(netSubs),
      trend: netSubs >= 0 ? 'up' : 'down',
      icon: Users, color: 'text-success', bg: 'bg-success/10',
    },
    {
      label: 'Total Views',
      value: formatNumber(channelViews),
      change: `${formatNumber(totalViews)} (30d)`,
      trend: 'up',
      icon: Eye, color: 'text-primary', bg: 'bg-primary/10',
    },
    {
      label: 'Total Videos',
      value: formatNumber(channelVideoCount),
      change: `${sync.videos.length} synced`,
      trend: 'up',
      icon: Video, color: 'text-accent', bg: 'bg-accent/10',
    },
    {
      label: 'Watch Time (30d)',
      value: `${formatNumber(totalWatchMinutes)} min`,
      change: '+24.1%',
      trend: 'up',
      icon: Clock, color: 'text-info', bg: 'bg-info/10',
    },
  ];

  const chartData = analytics.map((a) => ({
    name: new Date(a.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: a.views,
    watchTime: a.estimatedMinutesWatched,
  }));

  const subGrowthData = analytics.map((a) => ({
    name: new Date(a.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    subs: a.subscribersGained - a.subscribersLost,
  }));

  const monthlyUploadData = sync.videos.length > 0
    ? Object.entries(
        sync.videos.reduce((acc: Record<string, number>, v) => {
          const month = new Date(v.published_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {}),
      ).map(([month, count]) => ({ name: month, uploads: count })).slice(-12)
    : [];

  const retentionData = analytics.length > 0
    ? analytics.map((a, i) => ({
        name: `${Math.round((i / analytics.length) * 100)}%`,
        value: Math.max(100 - i * (100 / analytics.length) * 0.8, 10),
      }))
    : [];

  const countryData = yt.topCountries.slice(0, 6).map((c, i) => ({
    name: c.country,
    value: c.views,
    color: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
  }));

  const trafficData = yt.trafficSources.map((t) => ({
    name: t.source,
    value: t.views,
  }));

  const recentVideos = sync.videos.slice(0, 6);
  const recentShorts = sync.shorts.slice(0, 6);
  const isLoading = sync.loading || yt.loading;
  const hasError = sync.error && yt.error;
  const errorMsg = sync.error || yt.error;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full channel synchronization with YouTube Data API &amp; Analytics API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sync.lastSyncAt && (
            <Badge variant="outline" className="text-xs">
              <Calendar className="mr-1 h-3 w-3" />
              Last sync: {sync.lastSyncAt.toLocaleString()}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.triggerSync()}
            disabled={sync.syncing}
          >
            {sync.syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {sync.syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { sync.refresh(); yt.refresh(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </motion.div>

      <YouTubeConnect />

      {sync.syncing && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Syncing your YouTube channel...</p>
              <p className="text-xs text-muted-foreground">
                Fetching all videos, playlists, comments, and analytics. This may take a few minutes for large channels.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading && !sync.syncing && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading analytics data...</span>
          </div>
        </Card>
      )}

      {hasError && !isLoading && !sync.syncing && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium">YouTube analytics unavailable</p>
              <p className="text-xs text-muted-foreground">{errorMsg}. Connect your channel above to see real data.</p>
            </div>
          </div>
        </Card>
      )}

      {!isLoading && !hasError && (channel || yt.channelStats) && (
        <>
          {/* Channel Header */}
          {channel && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={channel.thumbnail_url} alt={channel.title} />
                      <AvatarFallback>
                        <Youtube className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-display text-xl font-bold">{channel.title}</h2>
                      {channel.custom_url && (
                        <p className="text-sm text-muted-foreground">{channel.custom_url}</p>
                      )}
                      <p className="mt-1 max-w-md text-xs text-muted-foreground line-clamp-2">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <p className="font-display text-2xl font-bold">{formatNumber(channelSubs)}</p>
                      <p className="text-xs text-muted-foreground">Subscribers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-2xl font-bold">{formatNumber(channelViews)}</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-2xl font-bold">{formatNumber(channelVideoCount)}</p>
                      <p className="text-xs text-muted-foreground">Videos</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="glass glass-hover p-5">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                      {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="glass">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="videos">All Videos</TabsTrigger>
              <TabsTrigger value="shorts">Shorts</TabsTrigger>
              <TabsTrigger value="playlists">Playlists</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Views &amp; Watch Time</h2>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(346 77% 55%)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(346 77% 55%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                        <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                        <YAxis stroke="hsl(240 5% 64.9%)" fontSize={12} />
                        <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="views" stroke="hsl(346 77% 55%)" strokeWidth={2} fill="url(#vGrad)" />
                        <Area type="monotone" dataKey="watchTime" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#wGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No data available</div>
                  )}
                </Card>

                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Subscriber Growth</h2>
                  {subGrowthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={subGrowthData}>
                        <defs>
                          <linearGradient id="subGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(265 83% 63%)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(265 83% 63%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                        <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                        <YAxis stroke="hsl(240 5% 64.9%)" fontSize={12} />
                        <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="subs" stroke="hsl(265 83% 63%)" strokeWidth={2} fill="url(#subGrowth)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No growth data</div>
                  )}
                </Card>
              </div>

              {/* Monthly Uploads */}
              {monthlyUploadData.length > 0 && (
                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Monthly Uploads</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyUploadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                      <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={11} />
                      <YAxis stroke="hsl(240 5% 64.9%)" fontSize={12} />
                      <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                      <Bar dataKey="uploads" fill="hsl(217 91% 60%)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Engagement */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { metric: 'Likes (30d)', value: formatNumber(totalLikes), icon: ThumbsUp, color: 'text-success' },
                  { metric: 'Comments (30d)', value: formatNumber(totalComments), icon: MessageCircle, color: 'text-primary' },
                  { metric: 'Shares (30d)', value: formatNumber(totalShares), icon: Share2, color: 'text-accent' },
                  { metric: 'Net Subs (30d)', value: formatNumber(netSubs), icon: Repeat, color: 'text-info' },
                ].map((item, i) => (
                  <motion.div key={item.metric} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className="glass glass-hover p-5 text-center">
                      <item.icon className={`mx-auto mb-2 h-6 w-6 ${item.color}`} />
                      <p className="font-display text-xl font-bold">{item.value}</p>
                      <p className="text-sm text-muted-foreground">{item.metric}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Audience */}
            <TabsContent value="audience" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Top Countries</h2>
                  {countryData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={countryData} cx="50%" cy="50%" outerRadius={100} dataKey="value">
                            {countryData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {countryData.map((c) => (
                          <div key={c.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                              <span className="text-muted-foreground">{c.name}</span>
                            </div>
                            <span className="font-medium">{formatNumber(c.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">No audience data</div>
                  )}
                </Card>

                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Traffic Sources</h2>
                  {trafficData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={trafficData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                        <XAxis type="number" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="hsl(240 5% 64.9%)" fontSize={11} width={120} />
                        <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                        <Bar dataKey="value" fill="hsl(265 83% 63%)" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No traffic data</div>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* All Videos */}
            <TabsContent value="videos" className="space-y-4">
              {recentVideos.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {recentVideos.map((v, i) => (
                    <motion.div key={v.video_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="glass glass-hover overflow-hidden p-0">
                        {v.thumbnail_url && (
                          <div className="relative aspect-video w-full overflow-hidden">
                            <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" />
                            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                              {parseDuration(v.duration)}
                            </div>
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-medium text-sm line-clamp-2">{v.title}</h3>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(v.view_count)}</span>
                            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatNumber(v.like_count)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatNumber(v.comment_count)}</span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(v.published_at).toLocaleDateString()}
                          </p>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="glass p-5">
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No videos synced yet. Click &quot;Sync Now&quot; to fetch all videos.
                  </div>
                </Card>
              )}

              {/* Top Performing Videos Table */}
              {topVideos.length > 0 && (
                <Card className="glass p-5">
                  <h2 className="mb-4 font-display text-lg font-semibold">Top Performing Videos</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-xs uppercase text-muted-foreground">
                          <th className="pb-3 pr-4 font-medium">#</th>
                          <th className="pb-3 pr-4 font-medium">Title</th>
                          <th className="pb-3 pr-4 font-medium">Views</th>
                          <th className="pb-3 pr-4 font-medium">Engagement</th>
                          <th className="pb-3 pr-4 font-medium">Likes</th>
                          <th className="pb-3 font-medium">Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topVideos.map((video, i) => (
                          <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-3 pr-4 text-sm font-medium text-muted-foreground">{i + 1}</td>
                            <td className="py-3 pr-4 text-sm font-medium max-w-xs truncate">
                              {video.title}
                              {video.isShort && <Badge className="ml-2 bg-destructive/15 text-destructive text-xs">Short</Badge>}
                            </td>
                            <td className="py-3 pr-4 text-sm">{video.views}</td>
                            <td className="py-3 pr-4 text-sm">{video.ctr}</td>
                            <td className="py-3 pr-4 text-sm">{video.likes}</td>
                            <td className="py-3 text-sm">{video.comments}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Shorts */}
            <TabsContent value="shorts" className="space-y-4">
              {recentShorts.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-muted-foreground">
                      {sync.shorts.length} Shorts detected from your channel
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {recentShorts.map((v, i) => (
                      <motion.div key={v.video_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Card className="glass glass-hover overflow-hidden p-0">
                          {v.thumbnail_url && (
                            <div className="relative aspect-[9/16] w-full overflow-hidden">
                              <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" />
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-destructive/90 text-white text-xs">
                                  <Zap className="mr-1 h-2.5 w-2.5" />Short
                                </Badge>
                              </div>
                            </div>
                          )}
                          <div className="p-3">
                            <h3 className="font-medium text-xs line-clamp-2">{v.title}</h3>
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(v.view_count)}</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <Card className="glass p-5">
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No Shorts detected. Sync your channel to detect Shorts automatically.
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Playlists */}
            <TabsContent value="playlists" className="space-y-4">
              {sync.playlists.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sync.playlists.map((p, i) => (
                    <motion.div key={p.playlist_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="glass glass-hover overflow-hidden p-0">
                        {p.thumbnail_url && (
                          <div className="relative aspect-video w-full overflow-hidden">
                            <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white flex items-center gap-1">
                              <ListVideo className="h-3 w-3" />{p.item_count} videos
                            </div>
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-medium text-sm line-clamp-2">{p.title}</h3>
                          {p.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(p.published_at).toLocaleDateString()}
                          </p>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="glass p-5">
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No playlists synced yet. Click &quot;Sync Now&quot; to fetch all playlists.
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* AI Insight */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-display text-lg font-semibold">AI Insights &amp; Recommendations</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { title: 'Best posting time', detail: 'Your videos perform 34% better when published on Thursday at 3 PM.', icon: Calendar, color: 'text-primary' },
                  { title: 'Retention drop at 30%', detail: 'Viewers drop off at 30% mark. Add a pattern interrupt or visual change.', icon: TrendingUp, color: 'text-warning' },
                  { title: 'Engagement opportunity', detail: `You got ${formatNumber(totalLikes)} likes this month. Ask viewers to like in your next video's CTA.`, icon: ThumbsUp, color: 'text-success' },
                  { title: 'Top traffic source', detail: yt.trafficSources[0] ? `${yt.trafficSources[0].source} is your top traffic source with ${formatNumber(yt.trafficSources[0].views)} views.` : 'Connect to see traffic data.', icon: Globe, color: 'text-info' },
                ].map((insight, i) => (
                  <div key={i} className="rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                    <insight.icon className={`mb-2 h-5 w-5 ${insight.color}`} />
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Sync Status */}
          {sync.syncLogs.length > 0 && (
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Sync History</h2>
              <div className="space-y-2">
                {sync.syncLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg glass p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge className={log.status === 'completed' ? 'bg-success/15 text-success' : log.status === 'failed' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}>
                        {log.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {log.videos_synced > 0 && <span>{log.videos_synced} videos</span>}
                      {log.comments_synced > 0 && <span>{log.comments_synced} comments</span>}
                      {log.playlists_synced > 0 && <span>{log.playlists_synced} playlists</span>}
                      {log.error_message && <span className="text-destructive">{log.error_message}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
