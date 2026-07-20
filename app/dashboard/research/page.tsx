'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Globe,
  Play,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SkeletonGrid,
  SearchInput,
  formatNumber,
  parseDuration,
} from '@/components/dashboard/shared';
import {
  fetchTrendingVideos,
  YOUTUBE_CATEGORIES,
  type TrendingVideo,
} from '@/lib/youtube-research';

type SortKey = 'viralScore' | 'viewCount' | 'likeCount' | 'commentCount' | 'viewsPerDay';

const REGIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'JP', label: 'Japan' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'KR', label: 'South Korea' },
  { code: 'MX', label: 'Mexico' },
  { code: 'ES', label: 'Spain' },
];

export default function TrendingTopicsPage() {
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('US');
  const [category, setCategory] = useState('0');
  const [sortBy, setSortBy] = useState<SortKey>('viralScore');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchTrendingVideos(region, category, 25);
        if (!cancelled) {
          setVideos(result.videos);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load trending videos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [region, category, refreshKey]);

  // Filter + sort
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channelTitle.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'viewCount': return b.viewCount - a.viewCount;
        case 'likeCount': return b.likeCount - a.likeCount;
        case 'commentCount': return b.commentCount - a.commentCount;
        case 'viewsPerDay': return b.viewsPerDay - a.viewsPerDay;
        case 'viralScore':
        default: return b.viralScore - a.viralScore;
      }
    });

    return result;
  }, [videos, search, sortBy]);

  const categories = useMemo(() => {
    const used = new Set(videos.map((v) => v.categoryId));
    return Object.entries(YOUTUBE_CATEGORIES).filter(([id]) => used.has(id));
  }, [videos]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Trending Topics"
        description="Discover what's trending on YouTube right now with real data from the YouTube Data API."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search trending videos..."
        />
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-44">
            <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All Categories</SelectItem>
            {categories.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viralScore">Viral Score</SelectItem>
            <SelectItem value="viewCount">Views</SelectItem>
            <SelectItem value="likeCount">Likes</SelectItem>
            <SelectItem value="commentCount">Comments</SelectItem>
            <SelectItem value="viewsPerDay">Views/Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* States */}
      {loading && (
        <>
          <LoadingState message="Fetching trending videos from YouTube..." />
          <SkeletonGrid count={9} />
        </>
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={refresh} />
      )}

      {!loading && !error && filteredVideos.length === 0 && (
        <EmptyState
          icon={Flame}
          title="No trending videos found"
          description={
            videos.length === 0
              ? "No trending videos are available for this region/category. Try a different region."
              : "No videos match your search. Try a different search term."
          }
          action={
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          }
        />
      )}

      {/* Trending Video Grid */}
      {!loading && !error && filteredVideos.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-warning" />
            <span>
              {filteredVideos.length} trending videos in{' '}
              {REGIONS.find((r) => r.code === region)?.label || region}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVideos.map((video, i) => (
              <motion.div
                key={video.videoId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass glass-hover overflow-hidden p-0">
                  {/* Thumbnail */}
                  {video.thumbnail && (
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-video w-full overflow-hidden"
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                        {parseDuration(video.duration)}
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-warning/90 text-white">
                          <Flame className="mr-1 h-3 w-3" />
                          {video.viralScore}
                        </Badge>
                      </div>
                    </a>
                  )}

                  <div className="p-4">
                    {/* Title */}
                    <h3 className="mb-1 font-medium text-sm line-clamp-2">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {video.title}
                      </a>
                    </h3>

                    {/* Channel + Category */}
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{video.channelTitle}</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-xs">
                        {video.category}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/30 p-2">
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{formatNumber(video.viewCount)}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/30 p-2">
                        <ThumbsUp className="h-3.5 w-3.5 text-success" />
                        <span className="font-medium">{formatNumber(video.likeCount)}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/30 p-2">
                        <MessageCircle className="h-3.5 w-3.5 text-accent" />
                        <span className="font-medium">{formatNumber(video.commentCount)}</span>
                      </div>
                    </div>

                    {/* Growth metrics */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(video.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-success">
                        <ArrowUpRight className="h-3 w-3" />
                        {formatNumber(video.viewsPerDay)}/day
                      </span>
                    </div>

                    {/* Engagement bar */}
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Engagement</span>
                        <span className="font-medium">{(video.engagementRate ?? 0).toFixed(2)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                          style={{ width: `${Math.min(100, (video.engagementRate ?? 0) * 20)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
