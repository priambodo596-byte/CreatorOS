'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  Youtube,
  Clock,
  DollarSign,
  Eye,
  Sparkles,
  PenLine,
  Image as ImageIcon,
  Wand2,
  Upload,
  Video,
  Calendar,
  Flame,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Cpu,
  HardDrive,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { YouTubeConnect } from '@/components/youtube/youtube-connect';
import { useYouTubeData } from '@/hooks/use-youtube-data';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const QUICK_ACTIONS = [
  { label: 'Upload Video', icon: Upload, href: '/dashboard/publishing', color: 'from-primary to-accent' },
  { label: 'Generate Script', icon: PenLine, href: '/dashboard/ai-studio/script', color: 'from-accent to-info' },
  { label: 'Create Thumbnail', icon: ImageIcon, href: '/dashboard/thumbnail-studio', color: 'from-info to-success' },
  { label: 'Generate SEO', icon: Wand2, href: '/dashboard/seo-studio', color: 'from-success to-warning' },
  { label: 'Start AI Chat', icon: Sparkles, href: '/dashboard/ai-chat', color: 'from-warning to-primary' },
  { label: 'Research Trends', icon: TrendingUp, href: '/dashboard/research', color: 'from-primary to-info' },
];

const ACTIVITIES = [
  { action: 'Published video', detail: '"I Built an AI App in 24 Hours"', time: '2m ago', icon: Upload, color: 'text-success' },
  { action: 'Generated script', detail: '"10 AI Tools That Will Replace SaaS"', time: '1h ago', icon: PenLine, color: 'text-primary' },
  { action: 'AI thumbnail created', detail: '3 variations generated', time: '3h ago', icon: ImageIcon, color: 'text-accent' },
  { action: 'SEO optimized', detail: 'Score improved to 92/100', time: '5h ago', icon: Wand2, color: 'text-info' },
  { action: 'Trend alert', detail: 'New viral topic detected', time: '8h ago', icon: Flame, color: 'text-warning' },
];

const SCHEDULE = [
  { title: 'AI Tools Video', time: '10:00 AM', date: 'Today', type: 'Recording' },
  { title: 'Thumbnail Review', time: '2:00 PM', date: 'Today', type: 'Design' },
  { title: 'Publish "Future of Content"', time: '9:00 AM', date: 'Tomorrow', type: 'Publish' },
  { title: 'Script Writing Session', time: '11:00 AM', date: 'Wed', type: 'Writing' },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function DashboardPage() {
  const yt = useYouTubeData();

  const stats = yt.channelStats
    ? [
        { label: 'Total Views', value: formatNumber(Number(yt.channelStats.viewCount)), change: '+18.2%', trend: 'up', icon: Eye, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Subscribers', value: formatNumber(Number(yt.channelStats.subscriberCount)), change: '+12.4%', trend: 'up', icon: Youtube, color: 'text-accent', bg: 'bg-accent/10' },
        { label: 'Videos', value: yt.channelStats.videoCount, change: '+3', trend: 'up', icon: Video, color: 'text-info', bg: 'bg-info/10' },
        {
          label: 'Watch Time (30d)',
          value: yt.analytics.reduce((sum, a) => sum + a.estimatedMinutesWatched, 0) > 0
            ? `${formatNumber(yt.analytics.reduce((sum, a) => sum + a.estimatedMinutesWatched, 0))} min`
            : '—',
          change: '+24.1%',
          trend: 'up',
          icon: Clock,
          color: 'text-success',
          bg: 'bg-success/10',
        },
      ]
    : null;

  const chartData = yt.analytics.length > 0
    ? yt.analytics.map((a) => ({
        name: new Date(a.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: a.views,
        subs: a.subscribersGained - a.subscribersLost,
      }))
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            {yt.channelStats ? `Welcome back, ${yt.channelStats.title}` : 'Welcome back, Alex'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your channel today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 days
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white">
            <Zap className="mr-2 h-4 w-4" />
            Quick Generate
          </Button>
        </div>
      </motion.div>

      {/* YouTube Connection */}
      <YouTubeConnect />

      {/* Loading state */}
      {yt.loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Fetching your YouTube data...</span>
          </div>
        </Card>
      )}

      {/* Error state */}
      {yt.error && !yt.loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium">YouTube data unavailable</p>
              <p className="text-xs text-muted-foreground">{yt.error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
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
      )}

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.label} href={action.href} className="group flex flex-col items-center gap-3 rounded-xl glass p-4 transition-all hover:scale-105 hover:border-primary/30">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} text-white`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Views &amp; Subscribers</h2>
                <p className="text-sm text-muted-foreground">Last 30 days from YouTube Analytics</p>
              </div>
              <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(346 77% 55%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(346 77% 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="subsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(265 83% 63%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(265 83% 63%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                  <XAxis dataKey="name" stroke="hsl(240 5% 64.9%)" fontSize={12} />
                  <YAxis stroke="hsl(240 5% 64.9%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(240 10% 5.5%)', border: '1px solid hsl(240 4% 16%)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="views" stroke="hsl(346 77% 55%)" strokeWidth={2} fill="url(#viewsGrad)" />
                  <Area type="monotone" dataKey="subs" stroke="hsl(265 83% 63%)" strokeWidth={2} fill="url(#subsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Connect YouTube to see analytics
              </div>
            )}
          </Card>
        </motion.div>

        {/* Traffic sources from real data */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="glass p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Traffic Sources</h2>
            {yt.trafficSources.length > 0 ? (
              <div className="space-y-3">
                {yt.trafficSources.slice(0, 6).map((source, i) => {
                  const max = yt.trafficSources[0]?.views || 1;
                  return (
                    <div key={source.source}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{source.source}</span>
                        <span className="font-medium">{formatNumber(source.views)}</span>
                      </div>
                      <Progress value={(source.views / max) * 100} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Connect YouTube to see traffic sources
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Real videos + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="lg:col-span-2">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent Videos</h2>
              <Link href="/dashboard/analytics" className="flex items-center text-sm text-primary hover:underline">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {yt.videos.length > 0 ? (
              <div className="space-y-3">
                {yt.videos.slice(0, 5).map((video) => (
                  <div key={video.id} className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-muted/30">
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Video className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{video.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{formatNumber(video.viewCount)} views</span>
                        <span>·</span>
                        <span>{formatNumber(video.likeCount)} likes</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-success/15 text-success">Published</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Connect YouTube to see your videos
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="glass p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Recent Activity</h2>
            <div className="space-y-4">
              {ACTIVITIES.map((activity, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 ${activity.color}`}>
                    <activity.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.detail}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/60">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Upcoming</h2>
              <Link href="/dashboard/calendar" className="text-sm text-primary hover:underline">Calendar</Link>
            </div>
            <div className="space-y-3">
              {SCHEDULE.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                    <span className="text-[10px] font-bold text-primary">{item.date}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.time} · {item.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI Usage</h2>
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-4">
              {[
                { label: 'Script Generations', used: 1240, total: 2000 },
                { label: 'Thumbnail Generations', used: 86, total: 100 },
                { label: 'SEO Optimizations', used: 340, total: 500 },
                { label: 'API Calls', used: 12.4, total: 50, unit: 'K' },
              ].map((usage) => (
                <div key={usage.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{usage.label}</span>
                    <span className="font-medium">{usage.used}{usage.unit || ''} / {usage.total}{usage.unit || ''}</span>
                  </div>
                  <Progress value={(usage.used / usage.total) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Storage</h2>
              <HardDrive className="h-5 w-5 text-accent" />
            </div>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used Storage</span>
                <span className="font-medium">68 GB / 100 GB</span>
              </div>
              <Progress value={68} className="h-2" />
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Videos', size: '42 GB', color: 'bg-primary' },
                { label: 'Images', size: '18 GB', color: 'bg-accent' },
                { label: 'Audio', size: '6 GB', color: 'bg-info' },
                { label: 'Other', size: '2 GB', color: 'bg-success' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="font-medium">{item.size}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* AI Recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
        <Card className="glass p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-display text-lg font-semibold">AI Recommendations</h2>
            <Badge variant="secondary" className="ml-2">3 new</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { title: 'Publish on Thursday', detail: 'Your audience is most active at 3 PM on Thursdays. Schedule your next video then.', icon: Calendar, color: 'text-primary' },
              { title: 'Trending: "AI in 2026"', detail: 'This topic is trending with a viral score of 87. Create a video about it this week.', icon: Flame, color: 'text-warning' },
              { title: 'Improve thumbnail CTR', detail: 'Your "AI Tools" thumbnail could be improved. Try adding more contrast and larger text.', icon: ImageIcon, color: 'text-accent' },
            ].map((rec, i) => (
              <div key={i} className="rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                <rec.icon className={`mb-2 h-5 w-5 ${rec.color}`} />
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rec.detail}</p>
                <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs">
                  Apply <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
