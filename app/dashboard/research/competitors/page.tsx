'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Eye,
  Video,
  TrendingUp,
  Clock,
  ThumbsUp,
  MessageCircle,
  Search,
  RefreshCw,
  Youtube,
  Calendar,
  Gauge,
  Activity,
  ExternalLink,
  Play,
  MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  formatNumber,
  parseDuration,
} from '@/components/dashboard/shared';
import {
  fetchCompetitorData,
  formatDuration,
  type CompetitorChannel,
} from '@/lib/youtube-research';

export default function CompetitorAnalysisPage() {
  const [channelInput, setChannelInput] = useState('');
  const [channel, setChannel] = useState<CompetitorChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleAnalyze = useCallback(async () => {
    const trimmed = channelInput.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setChannel(null);

    try {
      const result = await fetchCompetitorData(trimmed);
      setChannel(result.channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch competitor data');
    } finally {
      setLoading(false);
    }
  }, [channelInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const engagementColor = channel
    ? channel.engagementRate >= 5
      ? 'text-success'
      : channel.engagementRate >= 2
        ? 'text-warning'
        : 'text-destructive'
    : '';

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Competitor Analysis"
        description="Analyze any YouTube channel's performance — subscribers, views, upload frequency, engagement, and top content."
      />

      {/* Search Input */}
      <Card className="glass p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter channel URL or handle (e.g., @mkbhd, youtube.com/@channel)..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={loading || !channelInput.trim()}>
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Supports: @handle, youtube.com/@handle, youtube.com/channel/UC..., or channel name
        </p>
      </Card>

      {/* States */}
      {loading && (
        <>
          <LoadingState message="Fetching competitor channel data from YouTube..." />
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

      {!loading && error && (
        <ErrorState message={error} onRetry={handleAnalyze} />
      )}

      {!loading && !error && !hasSearched && (
        <EmptyState
          icon={Search}
          title="Analyze a competitor"
          description="Enter a YouTube channel URL or handle above to see their subscriber count, views, upload frequency, engagement rate, most viewed video, and recent uploads."
        />
      )}

      {!loading && !error && hasSearched && !channel && !error && (
        <EmptyState
          icon={Youtube}
          title="Channel not found"
          description="The channel could not be found. Check the URL or handle and try again."
          action={
            <Button variant="outline" size="sm" onClick={handleAnalyze}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          }
        />
      )}

      {/* Results */}
      {!loading && !error && channel && (
        <>
          {/* Channel Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={channel.thumbnailUrl} alt={channel.title} />
                    <AvatarFallback>
                      <Youtube className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-display text-xl font-bold">{channel.title}</h2>
                    {channel.customUrl && (
                      <a
                        href={`https://www.youtube.com/${channel.customUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {channel.customUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <p className="mt-1 max-w-md text-xs text-muted-foreground line-clamp-2">
                      {channel.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {channel.country && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="mr-1 h-3 w-3" />
                          {channel.country}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        Joined {new Date(channel.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold">{formatNumber(channel.subscriberCount)}</p>
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold">{formatNumber(channel.viewCount)}</p>
                    <p className="text-xs text-muted-foreground">Total Views</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold">{formatNumber(channel.videoCount)}</p>
                    <p className="text-xs text-muted-foreground">Videos</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Avg Views / Video',
                value: formatNumber(channel.avgViewsPerVideo),
                icon: Eye,
                color: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                label: 'Engagement Rate',
                value: `${channel.engagementRate.toFixed(2)}%`,
                icon: Activity,
                color: engagementColor,
                bg: 'bg-success/10',
              },
              {
                label: 'Uploads / Week',
                value: channel.uploadFrequencyPerWeek.toFixed(1),
                icon: Calendar,
                color: 'text-accent',
                bg: 'bg-accent/10',
              },
              {
                label: 'Avg Duration',
                value: formatDuration(channel.avgDurationSeconds),
                icon: Clock,
                color: 'text-info',
                bg: 'bg-info/10',
              },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="glass glass-hover p-5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Most Viewed Video */}
          {channel.mostViewedVideo.videoId && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-warning" />
                  <h2 className="font-display text-lg font-semibold">Most Viewed Video</h2>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {channel.mostViewedVideo.thumbnail && (
                    <a
                      href={`https://www.youtube.com/watch?v=${channel.mostViewedVideo.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video w-full overflow-hidden rounded-lg sm:w-64"
                    >
                      <img
                        src={channel.mostViewedVideo.thumbnail}
                        alt={channel.mostViewedVideo.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                        <Play className="h-10 w-10 text-white" fill="white" />
                      </div>
                    </a>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">{channel.mostViewedVideo.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4 text-primary" />
                        {formatNumber(channel.mostViewedVideo.viewCount)} views
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ThumbsUp className="h-4 w-4 text-success" />
                        {formatNumber(channel.mostViewedVideo.likeCount)} likes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="h-4 w-4 text-accent" />
                        {formatNumber(channel.mostViewedVideo.commentCount)} comments
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(channel.mostViewedVideo.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={`https://www.youtube.com/watch?v=${channel.mostViewedVideo.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Watch on YouTube <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Recent Uploads */}
          {channel.recentUploads.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="glass p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold">Recent Uploads</h2>
                  </div>
                  <Badge variant="outline">{channel.recentUploads.length} videos</Badge>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {channel.recentUploads.map((video, i) => (
                    <motion.div
                      key={video.videoId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="glass glass-hover overflow-hidden rounded-lg">
                          {video.thumbnail && (
                            <div className="relative aspect-video w-full overflow-hidden">
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                                {parseDuration(video.duration)}
                              </div>
                            </div>
                          )}
                          <div className="p-3">
                            <h3 className="mb-2 text-xs font-medium line-clamp-2">{video.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {formatNumber(video.viewCount)}
                              </span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {formatNumber(video.likeCount)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {formatNumber(video.commentCount)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {new Date(video.publishedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </a>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Channel Keywords */}
          {channel.keywords.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-accent" />
                  <h2 className="font-display text-lg font-semibold">Channel Keywords</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {channel.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary">{kw}</Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
