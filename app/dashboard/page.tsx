'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  Youtube,
  Clock,
  Eye,
  Sparkles,
  PenLine,
  Image as ImageIcon,
  Wand2,
  Upload,
  Video,
  Calendar,
  Zap,
  ArrowUpRight,
  MoreHorizontal,
  Cpu,
  HardDrive,
  ChevronRight,
  Loader2,
  AlertCircle,
  FolderKanban,
  FileEdit,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { YouTubeConnect } from '@/components/youtube/youtube-connect';
import { useYouTubeData } from '@/hooks/use-youtube-data';
import { useDashboardSummary } from '@/hooks/use-dashboard-summary';
import { EmptyState, formatNumber, formatBytes } from '@/components/dashboard/shared';
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
  { label: 'Generate Script', icon: PenLine, href: '/dashboard/ai-studio?mode=script', color: 'from-accent to-info' },
  { label: 'Create Thumbnail', icon: ImageIcon, href: '/dashboard/thumbnail-studio', color: 'from-info to-success' },
  { label: 'Generate SEO', icon: Wand2, href: '/dashboard/seo-studio', color: 'from-success to-warning' },
  { label: 'Start AI Chat', icon: Sparkles, href: '/dashboard/ai-studio?mode=chat', color: 'from-warning to-primary' },
  { label: 'Research Trends', icon: TrendingUp, href: '/dashboard/research', color: 'from-primary to-info' },
];

const ACTIVITY_ICONS: Record<string, typeof Upload> = {
  created: PenLine,
  updated: FileEdit,
  trashed: Trash2,
  restored: FileEdit,
  duplicated: FileEdit,
  archived: FolderKanban,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const yt = useYouTubeData();
  const dash = useDashboardSummary();

  const stats = yt.channelStats
    ? [
        { label: 'Total Views', value: formatNumber(Number(yt.channelStats.viewCount)), change: '30d', trend: 'up', icon: Eye, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Subscribers', value: formatNumber(Number(yt.channelStats.subscriberCount)), change: 'live', trend: 'up', icon: Youtube, color: 'text-accent', bg: 'bg-accent/10' },
        { label: 'Videos', value: yt.channelStats.videoCount, change: 'total', trend: 'up', icon: Video, color: 'text-info', bg: 'bg-info/10' },
        {
          label: 'Watch Time (30d)',
          value: yt.analytics.reduce((sum, a) => sum + a.estimatedMinutesWatched, 0) > 0
            ? `${formatNumber(yt.analytics.reduce((sum, a) => sum + a.estimatedMinutesWatched, 0))} min`
            : '—',
          change: '30d',
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

  const ws = dash.workspace;
  const workspaceCards = ws
    ? [
        { label: 'Active Projects', value: ws.activeProjects, total: ws.totalProjects, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Draft Content', value: ws.draftContent, icon: FileEdit, color: 'text-warning', bg: 'bg-warning/10' },
        { label: 'Scheduled', value: ws.scheduledContent, icon: Calendar, color: 'text-info', bg: 'bg-info/10' },
        { label: 'Published', value: ws.publishedContent, icon: Video, color: 'text-success', bg: 'bg-success/10' },
      ]
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
            {yt.channelStats ? `Welcome back, ${yt.channelStats.title}` : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your workspace today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 days
          </Button>
          <Link href="/dashboard/ai-studio?mode=chat">
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white">
              <Zap className="mr-2 h-4 w-4" />
              Quick Generate
            </Button>
          </Link>
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

      {/* YouTube Stats grid */}
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
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3" />
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

      {/* Workspace Summary */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Workspace Summary</h2>
        {dash.loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass p-5">
                <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
              </Card>
            ))}
          </div>
        ) : ws ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workspaceCards.map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="glass glass-hover p-5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">
                    {card.value}
                    {card.total != null && <span className="text-sm font-normal text-muted-foreground"> / {card.total}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState title="No workspace data" description="Create a project or content item to see your summary here." />
        )}
      </div>


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
                {yt.trafficSources.slice(0, 6).map((source) => {
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


      {/* Recent Content + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="lg:col-span-2">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent Content</h2>
              <Link href="/dashboard/content" className="flex items-center text-sm text-primary hover:underline">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {dash.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/30" />
                ))}
              </div>
            ) : dash.recentContent.length > 0 ? (
              <div className="space-y-3">
                {dash.recentContent.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/content/${item.id}`}
                    className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-muted/30"
                  >
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Video className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="capitalize">{item.content_type}</span>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        item.status === 'published' ? 'bg-success/15 text-success'
                        : item.status === 'scheduled' ? 'bg-info/15 text-info'
                        : item.status === 'archived' ? 'bg-muted text-muted-foreground'
                        : 'bg-warning/15 text-warning'
                      }
                    >
                      {item.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Video}
                title="No content yet"
                description="Create your first piece of content to see it here."
                action={
                  <Link href="/dashboard/content">
                    <Button size="sm">Go to Content</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="glass p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Recent Activity</h2>
            {dash.loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/30" />
                ))}
              </div>
            ) : dash.activities.length > 0 ? (
              <div className="space-y-4">
                {dash.activities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.action] || FileEdit;
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{activity.action}{activity.content_title ? `: ${activity.content_title}` : ''}</p>
                        {activity.detail && <p className="text-xs text-muted-foreground">{activity.detail}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground/60">{timeAgo(activity.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent activity yet.</p>
            )}
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
            {dash.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/30" />
                ))}
              </div>
            ) : dash.upcoming.length > 0 ? (
              <div className="space-y-3">
                {dash.upcoming.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30">
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                      <span className="text-[10px] font-bold text-primary">
                        {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.scheduled_date ? new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} · {item.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing scheduled yet.</p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI Usage</h2>
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            {dash.aiUsage ? (
              <div className="space-y-4">
                {[
                  { label: 'Script Generations', used: dash.aiUsage.scriptGenerations },
                  { label: 'Thumbnail Generations', used: dash.aiUsage.thumbnailGenerations },
                  { label: 'SEO Optimizations', used: dash.aiUsage.seoOptimizations },
                  { label: 'AI Messages Sent', used: dash.aiUsage.totalApiCalls },
                ].map((usage) => (
                  <div key={usage.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{usage.label}</span>
                    <span className="font-medium">{formatNumber(usage.used)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No AI usage yet.</p>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Storage</h2>
              <HardDrive className="h-5 w-5 text-accent" />
            </div>
            {dash.storage && dash.storage.totalBytes > 0 ? (
              <>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Used Storage</span>
                    <span className="font-medium">{formatBytes(dash.storage.totalBytes)}</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Videos', size: dash.storage.video, color: 'bg-primary' },
                    { label: 'Images', size: dash.storage.image, color: 'bg-accent' },
                    { label: 'Audio', size: dash.storage.audio, color: 'bg-info' },
                    { label: 'Other', size: dash.storage.other, color: 'bg-success' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="font-medium">{formatBytes(item.size)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No assets uploaded yet.</p>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
