'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Bot,
  Zap,
  Youtube,
  Brain,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  Eye,
  Users,
  Video,
  Play,
  Pause,
  Settings2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, ErrorState, formatNumber, parseDuration } from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Agent capabilities
// ---------------------------------------------------------------------------
const CAPABILITIES = [
  {
    icon: Youtube,
    label: 'Channel Sync',
    description: 'Pull and analyze channel data',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  {
    icon: Brain,
    label: 'Content Analysis',
    description: 'Analyze video performance trends',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Calendar,
    label: 'Schedule Automation',
    description: 'Plan and schedule content',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    icon: TrendingUp,
    label: 'Trend Detection',
    description: 'Spot emerging topics in your niche',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Zap,
    label: 'Workflow Trigger',
    description: 'Launch automation workflows',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Activity,
    label: 'Performance Monitor',
    description: 'Track real-time metrics',
    color: 'text-info',
    bg: 'bg-info/10',
  },
];

// ---------------------------------------------------------------------------
// Agent response generator — uses real data context
// ---------------------------------------------------------------------------
function generateAgentResponse(
  prompt: string,
  context: {
    channel: any;
    analytics: any[];
    videos: any[];
    topVideos: any[];
    syncLogs: any[];
  },
): string {
  const lower = prompt.toLowerCase();

  // Channel info
  if (lower.includes('channel') || lower.includes('subscriber') || lower.includes('stats')) {
    if (!context.channel) {
      return "I don't see any synced channel data yet. Try triggering a sync first — I can pull your latest channel stats, subscriber count, and video list from YouTube.";
    }
    return `Here's what I know about your channel "${context.channel.title}":

• **Subscribers:** ${formatNumber(context.channel.subscriber_count)}
• **Total Views:** ${formatNumber(context.channel.view_count)}
• **Total Videos:** ${formatNumber(context.channel.video_count)}
• **Country:** ${context.channel.country || 'Not specified'}
• **Keywords:** ${context.channel.keywords?.slice(0, 5).join(', ') || 'None set'}

${context.channel.description ? `Channel description: "${context.channel.description.slice(0, 200)}..."` : ''}

Would you like me to analyze your recent performance or suggest content ideas?`;
  }

  // Analytics / performance
  if (lower.includes('analytics') || lower.includes('performance') || lower.includes('views')) {
    if (!context.analytics.length) {
      return "No analytics data is available yet. Sync your channel to get daily views, watch time, and engagement metrics. I can then analyze trends and identify your best-performing content.";
    }
    const totalViews = context.analytics.reduce((s, r) => s + r.views, 0);
    const totalWatched = context.analytics.reduce((s, r) => s + r.estimatedMinutesWatched, 0);
    const avgDuration = context.analytics.reduce((s, r) => s + r.averageViewDuration, 0) / context.analytics.length;
    const totalLikes = context.analytics.reduce((s, r) => s + r.likes, 0);
    const totalComments = context.analytics.reduce((s, r) => s + r.comments, 0);

    return `Here's your performance summary from ${context.analytics.length} days of data:

• **Total Views:** ${formatNumber(totalViews)}
• **Watch Time:** ${formatNumber(totalWatched)} minutes
• **Avg View Duration:** ${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s
• **Likes:** ${formatNumber(totalLikes)}
• **Comments:** ${formatNumber(totalComments)}
• **Engagement Rate:** ${totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0}%

${totalViews > 10000 ? 'Your channel is seeing solid traction! ' : ''}I can break this down by day, identify your best-performing content, or suggest optimization strategies. What would you like to explore?`;
  }

  // Top videos
  if (lower.includes('top video') || lower.includes('best video') || lower.includes('popular')) {
    if (!context.topVideos.length) {
      return "I don't have video data yet. Once you sync, I can identify your top-performing videos by views, engagement, and watch time.";
    }
    const top3 = context.topVideos.slice(0, 3);
    let response = `Here are your top ${top3.length} videos:\n\n`;
    top3.forEach((v, i) => {
      response += `${i + 1}. **${v.title}**\n   • Views: ${formatNumber(v.view_count)} | Likes: ${formatNumber(v.like_count)} | Comments: ${formatNumber(v.comment_count)}\n   • Duration: ${parseDuration(v.duration)}\n\n`;
    });
    response += 'Would you like me to analyze what makes these videos perform well and suggest similar content ideas?';
    return response;
  }

  // Sync
  if (lower.includes('sync') || lower.includes('update') || lower.includes('refresh')) {
    const lastSync = context.syncLogs[0];
    if (lastSync) {
      return `Your last sync was a **${lastSync.status}** operation:
• **Type:** ${lastSync.sync_type}
• **Started:** ${new Date(lastSync.started_at).toLocaleString()}
• **Videos Synced:** ${lastSync.videos_synced}
• **Comments Synced:** ${lastSync.comments_synced}
• **Playlists Synced:** ${lastSync.playlists_synced}
${lastSync.error_message ? `• **Error:** ${lastSync.error_message}` : ''}

I can trigger a new sync anytime — just ask!`;
    }
    return "No sync history found yet. I can trigger a full sync to pull your latest channel data, videos, comments, and analytics from YouTube. Shall I start one?";
  }

  // Ideas / content
  if (lower.includes('idea') || lower.includes('content') || lower.includes('what should') || lower.includes('suggest')) {
    if (!context.videos.length) {
      return "Once I have your video data, I can analyze your content patterns and suggest new video ideas based on what's performing well. Try syncing first!";
    }
    const categories: Record<string, number> = context.videos.reduce((acc, v) => {
      acc[v.category_id] = (acc[v.category_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topCat = (Object.entries(categories) as [string, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0];
    return `Based on your ${context.videos.length} synced videos, here are some content suggestions:

• You publish most frequently in category ${topCat?.[0] ?? 'Unknown'} (${topCat?.[1] ?? 0} videos). Consider doubling down on this niche.
• Your top video has ${formatNumber(context.topVideos[0]?.view_count ?? 0)} views — analyze its title, thumbnail, and topic for patterns to replicate.
• Try creating a series around your best-performing topics to build audience expectation.
• Consider Shorts to boost discovery — they can drive traffic to your long-form content.

Would you like me to draft a content calendar or generate script ideas for any of these?`;
  }

  // Default
  const channelNote = context.channel
    ? 'I can see your channel "' + context.channel.title + '" is synced with ' + context.videos.length + ' videos. '
    : "Your channel isn't synced yet. ";
  return (
    "I'm your automation agent. I can help you with:\n\n" +
    '• **Channel analysis** — subscriber stats, view counts, and growth trends\n' +
    '• **Performance insights** — daily views, watch time, engagement metrics\n' +
    '• **Top content** — identify your best-performing videos\n' +
    '• **Sync management** — trigger and monitor data syncs\n' +
    '• **Content ideas** — suggestions based on your real performance data\n' +
    '• **Workflow automation** — set up and trigger automated pipelines\n\n' +
    channelNote +
    'What would you like to do?'
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AutomationAgentPage() {
  const sync = useYouTubeSync();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: "👋 I'm your automation agent. I have access to your real YouTube channel data, analytics, and sync history. Ask me to analyze performance, suggest content, or trigger a sync.",
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loading = sync.loading;
  const error = sync.error;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate agent processing with real data context
    setTimeout(() => {
      const response = generateAgentResponse(userMsg.content, {
        channel: sync.channel,
        analytics: sync.analytics,
        videos: sync.videos,
        topVideos: sync.topVideos,
        syncLogs: sync.syncLogs,
      });
      const agentMsg: Message = {
        id: `agent_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setIsThinking(false);
    }, 800);
  };

  const handleSync = async () => {
    try {
      await sync.triggerSync();
      toast({ title: 'Sync triggered', description: 'Pulling fresh data from YouTube.' });
    } catch (e: any) {
      toast({
        title: 'Sync failed',
        description: e?.message ?? 'Could not trigger sync.',
        variant: 'destructive',
      });
    }
  };

  // Agent status
  const agentStatus = sync.syncing ? 'working' : 'ready';
  const statusColor =
    agentStatus === 'working' ? 'text-warning' : error ? 'text-destructive' : 'text-success';
  const statusIcon = sync.syncing ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : error ? (
    <AlertCircle className="h-3 w-3" />
  ) : (
    <CheckCircle2 className="h-3 w-3" />
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="AI Agent"
        description="Your intelligent automation assistant with real-time access to your channel data."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => sync.refresh()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSync} disabled={sync.syncing}>
              {sync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              {sync.syncing ? 'Syncing…' : 'Trigger Sync'}
            </Button>
          </div>
        }
      />

      {/* Agent status bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold">Automation Agent</span>
                  <Badge variant="outline" className={cn('text-xs', statusColor)}>
                    {statusIcon}
                    <span className="ml-1 capitalize">{agentStatus}</span>
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {sync.channel
                    ? `Connected to "${sync.channel.title}"`
                    : 'No channel connected'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{sync.videos.length}</span>
                <span className="text-muted-foreground">videos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {formatNumber(sync.analytics.reduce((s, r) => s + r.views, 0))}
                </span>
                <span className="text-muted-foreground">views</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {sync.channel ? formatNumber(sync.channel.subscriber_count) : '—'}
                </span>
                <span className="text-muted-foreground">subs</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={() => sync.refresh()} />}

      {/* Capabilities grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Agent Capabilities</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className="flex items-start gap-3 rounded-lg border border-border/30 p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cap.bg)}>
                    <Icon className={cn('h-4 w-4', cap.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{cap.label}</p>
                    <p className="text-xs text-muted-foreground">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Chat interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass flex h-[500px] flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-border/30 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Agent Chat</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setMessages([
                  {
                    id: 'reset',
                    role: 'assistant',
                    content: "Conversation cleared. How can I help you with your automation?",
                    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  },
                ])
              }
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl p-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-primary to-accent text-white'
                        : 'glass-strong',
                    )}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        msg.role === 'user' ? 'text-white/70' : 'text-muted-foreground',
                      )}
                    >
                      {msg.timestamp}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isThinking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="glass-strong rounded-2xl p-3">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/30 p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your channel, analytics, or trigger an automation…"
                className="flex-1 rounded-lg border border-border/30 bg-background/50 px-4 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
                disabled={isThinking}
              />
              <Button size="icon" onClick={handleSend} disabled={!input.trim() || isThinking}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Recent sync activity */}
      {sync.syncLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Recent Agent Activity</h2>
            <div className="space-y-2">
              {sync.syncLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-border/30 p-3"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      log.status === 'completed'
                        ? 'bg-success/10'
                        : log.status === 'failed'
                        ? 'bg-destructive/10'
                        : 'bg-warning/10',
                    )}
                  >
                    {log.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : log.status === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{log.sync_type} sync</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleString()} · {log.videos_synced} videos ·{' '}
                      {log.comments_synced} comments
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs capitalize',
                      log.status === 'completed'
                        ? 'text-success'
                        : log.status === 'failed'
                        ? 'text-destructive'
                        : 'text-warning',
                    )}
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
