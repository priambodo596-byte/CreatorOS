'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Search,
  TrendingUp,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Bookmark,
  Scissors,
  PenLine,
  BarChart3,
  Zap,
  Globe,
  Target,
  Hash,
  Activity,
  Rocket,
  Youtube,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { EmptyState, ErrorState, formatNumber } from '@/components/dashboard/shared';

interface TrendingVideo {
  id: string;
  video_id: string;
  title: string;
  channel_title: string;
  channel_id: string | null;
  thumbnail_url: string | null;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  category_id: string | null;
  country: string;
  language: string;
  growth_rate: number;
  trend_score: number;
  virality_score: number;
  estimated_audience: string | null;
  view_velocity: number;
  cached_at: string;
}

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'JP', label: 'Japan' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'KR', label: 'Korea' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'CA', label: 'Canada' },
  { value: 'IN', label: 'India' },
  { value: 'AU', label: 'Australia' },
];

const NICHES = [
  { value: 'all', label: 'All Niches' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'tech', label: 'Tech' },
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'music', label: 'Music' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'finance', label: 'Finance' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'diy', label: 'DIY' },
  { value: 'sports', label: 'Sports' },
];

const TIME_RANGES = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function formatRelativeTime(date: string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getGrowthColor(rate: number): string {
  if (rate >= 100) return 'text-success bg-success/15';
  if (rate >= 50) return 'text-primary bg-primary/15';
  if (rate >= 20) return 'text-warning bg-warning/15';
  return 'text-muted-foreground bg-muted/20';
}

function getViralityColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

function extractKeywords(titles: string[]): { word: string; count: number }[] {
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'is', 'are', 'was', 'were', 'be', 'been', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'with', 'from', 'by', 'as', 'my', 'your', 'how', 'what', 'why', 'when']);
  const freq: Record<string, number> = {};
  for (const title of titles) {
    const words = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default function ViralFinderPage() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('US');
  const [niche, setNiche] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');
  const [hasSearched, setHasSearched] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('trending_videos_cache')
        .select('*')
        .gte('growth_rate', 10)
        .order('growth_rate', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setVideos((data as TrendingVideo[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load viral videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleSearch = () => {
    setHasSearched(true);
    toast({ title: 'Searching for viral videos...', description: `Niche: ${niche}, Country: ${country}` });
  };

  const filteredVideos = videos
    .filter((v) => country === 'all' || v.country === country)
    .filter((v) => {
      if (!search.trim()) return true;
      return v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.channel_title.toLowerCase().includes(search.toLowerCase());
    });

  const avgGrowth = filteredVideos.length > 0
    ? Math.round(filteredVideos.reduce((sum, v) => sum + v.growth_rate, 0) / filteredVideos.length)
    : 0;
  const avgVirality = filteredVideos.length > 0
    ? Math.round(filteredVideos.reduce((sum, v) => sum + v.virality_score, 0) / filteredVideos.length)
    : 0;
  const totalViews = filteredVideos.reduce((sum, v) => sum + v.view_count, 0);
  const fastestGrowing = filteredVideos[0];
  const keywords = extractKeywords(filteredVideos.map((v) => v.title));

  const handleSaveToLibrary = async (video: TrendingVideo) => {
    if (savedIds.has(video.id)) {
      toast({ title: 'Already saved to library' });
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      await supabase.from('video_imports').insert({
        user_id: userId,
        source: 'viral-finder',
        name: video.title,
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail_url: video.thumbnail_url,
        video_id: video.video_id,
        channel_id: video.channel_id,
        metadata: { growth_rate: video.growth_rate, virality_score: video.virality_score, trend_score: video.trend_score },
      });
      setSavedIds((prev) => new Set(prev).add(video.id));
      toast({ title: 'Saved to library', description: video.title.slice(0, 50) });
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning to-destructive">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Viral Finder</h1>
          <p className="text-sm text-muted-foreground">Discover rising videos by niche, country, and keywords</p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="glass p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by niche, keyword, or topic..."
              className="pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full lg:w-44">
              <Globe className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="w-full lg:w-44">
              <Target className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => (
                <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full lg:w-44">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Find Viral Videos
          </Button>
        </div>
      </Card>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span className="text-xs">Viral Videos</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{filteredVideos.length}</p>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Avg Growth</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-success">+{avgGrowth}%</p>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span className="text-xs">Avg Virality</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{avgVirality}</p>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="text-xs">Total Views</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{formatNumber(totalViews)}</p>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span className="text-xs">Top Niche</span>
          </div>
          <p className="mt-2 font-display text-lg font-bold capitalize">{niche === 'all' ? 'Mixed' : niche}</p>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Rocket className="h-4 w-4" />
            <span className="text-xs">Fastest Growing</span>
          </div>
          <p className="mt-2 truncate text-sm font-bold">
            {fastestGrowing ? `+${Math.round(fastestGrowing.growth_rate)}%` : '--'}
          </p>
        </Card>
      </div>

      {/* Niche Insights */}
      {keywords.length > 0 && (
        <Card className="glass p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Trending Keywords</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw.word} variant="outline" className="gap-1.5">
                <Hash className="h-3 w-3" />
                {kw.word}
                <span className="text-muted-foreground">{kw.count}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <Card className="glass p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Finding viral videos...</span>
          </div>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={loadVideos} />
      ) : filteredVideos.length === 0 ? (
        <EmptyState
          icon={Flame}
          title={hasSearched ? 'No viral videos found' : 'No viral videos in cache'}
          description={hasSearched ? 'Try different filters or keywords.' : 'Trending videos will appear here once the cache is populated.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVideos.map((video, i) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="glass glass-hover overflow-hidden p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {video.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Youtube className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {/* Growth badge */}
                  <div className="absolute left-2 top-2">
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', getGrowthColor(video.growth_rate))}>
                      +{Math.round(video.growth_rate)}%
                    </span>
                  </div>
                  {/* Viral badge */}
                  {video.virality_score >= 80 && (
                    <div className="absolute right-2 top-2">
                      <span className="flex items-center gap-1 rounded-md bg-destructive/80 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
                        <Flame className="h-3 w-3" /> VIRAL
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium" title={video.title}>{video.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{video.channel_title}</p>

                  {/* Stats */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(video.view_count)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{formatNumber(video.like_count)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatNumber(video.comment_count)}</span>
                  </div>

                  {/* Virality bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Virality Score</span>
                      <span className={cn('font-bold', getViralityColor(video.virality_score))}>{Math.round(video.virality_score)}</span>
                    </div>
                    <Progress value={video.virality_score} className="mt-1 h-1.5" />
                  </div>

                  {/* Meta */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatRelativeTime(video.published_at)}</span>
                    {video.estimated_audience && (
                      <>
                        <span>·</span>
                        <span className="truncate">{video.estimated_audience}</span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`/dashboard/video-studio/analyzer?video=${video.video_id}`, '_self')}>
                      <Activity className="mr-1 h-3 w-3" />Analyze
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`/dashboard/video-studio/clipper?video=${video.video_id}`, '_self')}>
                      <Scissors className="mr-1 h-3 w-3" />Shorts
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`/dashboard/ai-studio?mode=script`, '_self')}>
                      <PenLine className="mr-1 h-3 w-3" />Script
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveToLibrary(video)}>
                      <Bookmark className={cn('h-3 w-3', savedIds.has(video.id) && 'fill-primary text-primary')} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(`https://youtube.com/watch?v=${video.video_id}`, '_blank')}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
