'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Flame,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  Search,
  Filter,
  Grid,
  List,
  Loader2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Bookmark,
  Heart,
  Play,
  Scissors,
  PenLine,
  Image,
  BarChart3,
  Zap,
  Users,
  Globe,
  Youtube,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase-client';
import { EmptyState, ErrorState } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TrendingVideo {
  id: string;
  video_id: string;
  title: string;
  description: string | null;
  channel_id: string | null;
  channel_title: string;
  channel_subscribers: number | null;
  thumbnail_url: string;
  published_at: string;
  duration: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  category_id: string | null;
  category: string;
  country: string;
  language: string;
  tags: string[] | null;
  trend_score: number;
  virality_score: number;
  growth_rate: number;
  view_velocity: number;
  estimated_audience: string | null;
  cached_at: string;
  metadata?: Record<string, unknown> | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'JP', label: '🇯🇵 Japan' },
  { value: 'ID', label: '🇮🇩 Indonesia' },
  { value: 'KR', label: '🇰🇷 Korea' },
  { value: 'BR', label: '🇧🇷 Brazil' },
  { value: 'MX', label: '🇲🇽 Mexico' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'AU', label: '🇦🇺 Australia' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'ja', label: 'Japanese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'hi', label: 'Hindi' },
];

const CATEGORIES = [
  'All',
  'Music',
  'Gaming',
  'Sports',
  'Comedy',
  'Education',
  'Entertainment',
  'News',
  'Tech',
  'Beauty',
  'Food',
  'Travel',
];

const PUBLISHED_TIMES = ['Today', 'This Week', 'This Month', 'All Time'] as const;
const DURATIONS = ['All', '< 4 min', '4-20 min', '> 20 min'] as const;
const VIEW_FILTERS = ['All', '> 100K', '> 1M', '> 10M'] as const;

const SORT_OPTIONS = [
  { value: 'trend_score', label: 'Trend Score' },
  { value: 'virality_score', label: 'Virality Score' },
  { value: 'growth_rate', label: 'Growth Rate' },
  { value: 'view_count', label: 'Views' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'newest', label: 'Newest' },
] as const;

const PAGE_SIZE = 20;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'need', 'this', 'that', 'these', 'those', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'them', 'their', 'there', 'here', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'your', 'my', 'me', 'him', 'her', 'us', 'am',
  'vs', 'ft', 'feat', 'official', 'video', 'full', 'new', 'best', 'top', 'ep',
  'part', 'episode', 'live', 'hd', 'hq', 'lyrics', 'audio', 'trailer', 'teaser',
  'how', 'to', 'what', 'why', 'about', 'into', 'out', 'up', 'down', 'over',
  'after', 'before', 'now', 'then', 'one', 'two', 'three', 'get', 'got',
]);

// ─── Helper Functions ───────────────────────────────────────────────────────
function formatNumber(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function parseDurationToSeconds(iso8601: string): number {
  if (!iso8601) return 0;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function formatDurationLabel(iso8601: string): string {
  const totalSeconds = parseDurationToSeconds(iso8601);
  if (totalSeconds === 0) return '--:--';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTrendColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 50) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
}

function getViralityColor(score: number): string {
  if (score >= 80) return 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30';
  if (score >= 50) return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

function getGrowthColor(rate: number): string {
  if (rate >= 100) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (rate >= 50) return 'bg-lime-500/15 text-lime-400 border-lime-500/30';
  if (rate >= 20) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

function extractKeywords(titles: string[], limit = 5): string[] {
  const freq = new Map<string, number>();
  for (const title of titles) {
    const words = title
      .toLowerCase()
      .replace(/[^\w\s#]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function getEngagementRate(v: TrendingVideo): number {
  if (!v.view_count || v.view_count === 0) return 0;
  return ((v.like_count || 0) + (v.comment_count || 0)) / v.view_count * 100;
}

function isWithinPublishedTime(publishedAt: string, filter: string): boolean {
  if (filter === 'All Time') return true;
  const now = Date.now();
  const then = new Date(publishedAt).getTime();
  const diff = now - then;
  switch (filter) {
    case 'Today': return diff < 24 * 60 * 60 * 1000;
    case 'This Week': return diff < 7 * 24 * 60 * 60 * 1000;
    case 'This Month': return diff < 30 * 24 * 60 * 60 * 1000;
    default: return true;
  }
}

function isWithinDuration(duration: string, filter: string): boolean {
  if (filter === 'All') return true;
  const seconds = parseDurationToSeconds(duration);
  switch (filter) {
    case '< 4 min': return seconds > 0 && seconds < 240;
    case '4-20 min': return seconds >= 240 && seconds <= 1200;
    case '> 20 min': return seconds > 1200;
    default: return true;
  }
}

function isWithinViews(views: number, filter: string): boolean {
  if (filter === 'All') return true;
  switch (filter) {
    case '> 100K': return views >= 100_000;
    case '> 1M': return views >= 1_000_000;
    case '> 10M': return views >= 10_000_000;
    default: return true;
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function TrendingVideosPage() {
  const { toast } = useToast();

  // Data state
  const [allVideos, setAllVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('All');
  const [publishedTime, setPublishedTime] = useState<string>('All Time');
  const [durationFilter, setDurationFilter] = useState<string>('All');
  const [viewFilter, setViewFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('trend_score');
  const [searchQuery, setSearchQuery] = useState('');

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Refs
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasFetchedRef = useRef(false);

  // ─── Fetch from cache ─────────────────────────────────────────────────────
  const fetchFromCache = useCallback(async (): Promise<{ videos: TrendingVideo[]; stale: boolean }> => {
    const { data, error: cacheError } = await supabase
      .from('trending_videos_cache')
      .select('*')
      .order('cached_at', { ascending: false })
      .limit(200);

    if (cacheError) throw cacheError;

    const videos = (data || []) as unknown as TrendingVideo[];
    if (videos.length === 0) return { videos: [], stale: true };

    const newest = new Date(videos[0].cached_at).getTime();
    const stale = Date.now() - newest > STALE_THRESHOLD_MS;
    return { videos, stale };
  }, []);

  // ─── Fetch from edge function ────────────────────────────────────────────
  const fetchFromEdgeFunction = useCallback(async (
    ctry: string,
    cat: string,
    lang: string,
  ): Promise<TrendingVideo[]> => {
    // Get current user ID for OAuth token lookup
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const response = await fetch(`${supabaseUrl}/functions/v1/youtube-trending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        country: ctry,
        category: cat === 'All' ? '0' : cat,
        language: lang,
        userId,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Edge function error ${response.status}: ${text}`);
    }

    const result = await response.json();

    // Handle auth-required response
    if (result.needsConnection) {
      throw new Error('Connect your YouTube account in Settings to fetch trending videos.');
    }

    const fetched: TrendingVideo[] = result.videos || result.data || [];
    if (!Array.isArray(fetched)) return [];

    // Upsert into cache (only columns that exist in trending_videos_cache)
    if (fetched.length > 0) {
      const rows = fetched.map((v) => ({
        id: v.video_id,
        video_id: v.video_id,
        title: v.title,
        channel_title: v.channel_title,
        channel_id: v.channel_id || null,
        thumbnail_url: v.thumbnail_url,
        published_at: v.published_at,
        view_count: v.view_count,
        like_count: v.like_count,
        comment_count: v.comment_count,
        duration: v.duration,
        category_id: v.category_id || null,
        country: v.country || ctry,
        language: v.language || lang,
        growth_rate: v.growth_rate || 0,
        trend_score: v.trend_score || 0,
        virality_score: v.virality_score || 0,
        estimated_audience: v.estimated_audience || null,
        view_velocity: v.view_velocity || 0,
        cached_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from('trending_videos_cache')
        .upsert(rows, { onConflict: 'id' });

      if (upsertError) {
        console.warn('Cache upsert failed:', upsertError.message);
      }
    }

    return fetched;
  }, []);

  // ─── Initial load ────────────────────────────────────────────────────────
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { videos, stale } = await fetchFromCache();
      if (videos.length > 0 && !stale) {
        setAllVideos(videos);
        setLoading(false);
        return;
      }

      // Cache empty or stale — fetch fresh
      setRefreshing(true);
      const fresh = await fetchFromEdgeFunction(country, category, language);
      const combined = fresh.length > 0 ? fresh : videos;
      setAllVideos(combined);
      if (combined.length === 0) {
        setError('No trending videos found. Try changing filters.');
      }
    } catch (err) {
      console.error('Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trending videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchFromCache, fetchFromEdgeFunction, country, category, language]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadInitial();
  }, [loadInitial]);

  // ─── Refresh with filters ────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const fresh = await fetchFromEdgeFunction(country, category, language);
      if (fresh.length > 0) {
        setAllVideos(fresh);
        toast({ title: 'Trending videos refreshed', description: `${fresh.length} videos loaded` });
      } else {
        // Fall back to cache
        const { videos } = await fetchFromCache();
        setAllVideos(videos);
        toast({ title: 'Showing cached results', description: 'Edge function returned no new data' });
      }
    } catch (err) {
      console.error('Refresh error:', err);
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchFromEdgeFunction, fetchFromCache, country, category, language, toast]);

  // ─── Filtered + sorted videos ────────────────────────────────────────────
  const filteredVideos = useCallback(() => {
    let result = [...allVideos];

    // Category filter
    if (category !== 'All') {
      result = result.filter((v) =>
        v.category?.toLowerCase() === category.toLowerCase(),
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.channel_title?.toLowerCase().includes(q),
      );
    }

    // Published time
    result = result.filter((v) => isWithinPublishedTime(v.published_at, publishedTime));

    // Duration
    result = result.filter((v) => isWithinDuration(v.duration, durationFilter));

    // Views
    result = result.filter((v) => isWithinViews(v.view_count, viewFilter));

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'trend_score': return (b.trend_score || 0) - (a.trend_score || 0);
        case 'virality_score': return (b.virality_score || 0) - (a.virality_score || 0);
        case 'growth_rate': return (b.growth_rate || 0) - (a.growth_rate || 0);
        case 'view_count': return (b.view_count || 0) - (a.view_count || 0);
        case 'engagement': return getEngagementRate(b) - getEngagementRate(a);
        case 'newest':
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        default: return 0;
      }
    });

    return result;
  }, [allVideos, category, searchQuery, publishedTime, durationFilter, viewFilter, sortBy]);

  const filtered = filteredVideos();
  const visibleVideos = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  // ─── Infinite scroll ──────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Simulate slight delay for UX
    setTimeout(() => {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [country, language, category, publishedTime, durationFilter, viewFilter, sortBy, searchQuery]);

  // ─── Dashboard stats ─────────────────────────────────────────────────────
  const stats = useCallback(() => {
    const total = allVideos.length;
    const fastestGrowing = allVideos.length > 0
      ? allVideos.reduce((max, v) => (v.growth_rate > max.growth_rate ? v : max), allVideos[0])
      : null;
    const highestEngagement = allVideos.length > 0
      ? allVideos.reduce((max, v) =>
        getEngagementRate(v) > getEngagementRate(max) ? v : max, allVideos[0])
      : null;
    const uniqueCategories = new Set(allVideos.map((v) => v.category).filter(Boolean)).size;
    const uniqueCountries = new Set(allVideos.map((v) => v.country).filter(Boolean)).size;
    const topKeywords = extractKeywords(allVideos.map((v) => v.title), 5);

    return {
      total,
      fastestGrowing,
      highestEngagement,
      uniqueCategories,
      uniqueCountries,
      topKeywords,
    };
  }, [allVideos]);

  const s = stats();

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleImportToProject = useCallback(async (video: TrendingVideo) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error: importError } = await supabase.from('video_imports').insert({
        user_id: userId,
        source: 'trending',
        name: video.title,
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail_url: video.thumbnail_url,
        video_id: video.video_id,
        channel_id: video.channel_id || null,
        metadata: {
          channel_title: video.channel_title,
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          duration: video.duration,
          trend_score: video.trend_score,
          virality_score: video.virality_score,
          growth_rate: video.growth_rate,
        },
      });

      if (importError) throw importError;
      toast({ title: 'Imported to project', description: video.title.slice(0, 60) });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleSaveToLibrary = useCallback(async (video: TrendingVideo) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error: saveError } = await supabase.from('video_imports').insert({
        user_id: userId,
        source: 'trending',
        name: video.title,
        url: `https://youtube.com/watch?v=${video.video_id}`,
        thumbnail_url: video.thumbnail_url,
        video_id: video.video_id,
        channel_id: video.channel_id || null,
        favorite: true,
        metadata: {
          channel_title: video.channel_title,
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          duration: video.duration,
          trend_score: video.trend_score,
          virality_score: video.virality_score,
          growth_rate: video.growth_rate,
        },
      });

      if (saveError) throw saveError;
      toast({ title: 'Saved to library', description: video.title.slice(0, 60) });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const toggleFavorite = useCallback((videoId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20">
            <Flame className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <div className="h-7 w-48 animate-pulse rounded bg-muted/40" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/30" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass p-5">
              <div className="mb-3 h-10 w-10 animate-pulse rounded-xl bg-muted/40" />
              <div className="mb-2 h-6 w-20 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted/30" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="glass overflow-hidden p-0">
              <div className="aspect-video w-full animate-pulse bg-muted/40" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted/30" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-muted/30" />
                  <div className="h-6 w-16 animate-pulse rounded-full bg-muted/30" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-6">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 ring-1 ring-rose-500/20">
            <Flame className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Trending Videos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time trending YouTube videos with comprehensive analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="glass"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* ─── Dashboard Cards ─── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
                <Flame className="h-4 w-4 text-rose-400" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{formatNumber(s.total)}</p>
            <p className="text-xs text-muted-foreground">Trending Videos</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">
              {s.fastestGrowing ? `${formatNumber(s.fastestGrowing.growth_rate)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Fastest Growing</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-500/10">
                <Heart className="h-4 w-4 text-fuchsia-400" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">
              {s.highestEngagement ? `${getEngagementRate(s.highestEngagement).toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Highest Engagement</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <BarChart3 className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{s.uniqueCategories}</p>
            <p className="text-xs text-muted-foreground">Trending Categories</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
                <Globe className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{s.uniqueCountries}</p>
            <p className="text-xs text-muted-foreground">Trending Countries</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass glass-hover p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Sparkles className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {s.topKeywords.length > 0 ? (
                s.topKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-[10px] capitalize">
                    {kw}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Trending Keywords</p>
          </Card>
        </motion.div>
      </div>

      {/* ─── Error Banner ─── */}
      {error && (
        <ErrorState message={error} onRetry={handleRefresh} />
      )}

      {/* ─── Filters Bar ─── */}
      <Card className="glass p-4">
        <div className="flex flex-col gap-3">
          {/* Row 1: Country, Language, Category */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Globe className="h-3 w-3" /> Country
              </label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" /> Language
              </label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" /> Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Published Time, Duration, Views, Sort */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" /> Published
              </label>
              <Select value={publishedTime} onValueChange={setPublishedTime}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISHED_TIMES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Play className="h-3 w-3" /> Duration
              </label>
              <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Eye className="h-3 w-3" /> Views
              </label>
              <Select value={viewFilter} onValueChange={setViewFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_FILTERS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Search + View Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Search className="h-3 w-3" /> Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or channel..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'h-8 px-3',
                    viewMode === 'grid' && 'bg-primary/15 text-primary',
                  )}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'h-8 px-3',
                    viewMode === 'list' && 'bg-primary/15 text-primary',
                  )}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Results count ─── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{visibleVideos.length}</span> of{' '}
          <span className="font-medium text-foreground">{filtered.length}</span> videos
        </p>
        {refreshing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching fresh data...
          </div>
        )}
      </div>

      {/* ─── Video Grid/List ─── */}
      {filtered.length === 0 && !error ? (
        <EmptyState
          icon={Flame}
          title="No trending videos found"
          description="Try adjusting your filters or refreshing to fetch the latest trending videos."
          action={
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              Fetch Trending
            </Button>
          }
        />
      ) : (
        <AnimatePresence mode="popLayout">
          {viewMode === 'grid' ? (
            <motion.div
              layout
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {visibleVideos.map((video, idx) => (
                <VideoCardGrid
                  key={video.video_id || video.id}
                  video={video}
                  index={idx}
                  isFavorite={favorites.has(video.video_id)}
                  onToggleFavorite={() => toggleFavorite(video.video_id)}
                  onImport={() => handleImportToProject(video)}
                  onSave={() => handleSaveToLibrary(video)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="space-y-3">
              {visibleVideos.map((video, idx) => (
                <VideoCardList
                  key={video.video_id || video.id}
                  video={video}
                  index={idx}
                  isFavorite={favorites.has(video.video_id)}
                  onToggleFavorite={() => toggleFavorite(video.video_id)}
                  onImport={() => handleImportToProject(video)}
                  onSave={() => handleSaveToLibrary(video)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ─── Load More / Infinite Scroll Sentinel ─── */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading more videos...
            </div>
          ) : (
            <Button variant="outline" onClick={loadMore} className="glass">
              <TrendingUp className="mr-2 h-4 w-4" />
              Load More Videos
            </Button>
          )}
        </div>
      )}

      {/* ─── End of results ─── */}
      {filtered.length > 0 && !hasMore && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          You've reached the end of trending results
        </div>
      )}
    </div>
  );
}

// ─── Video Card (Grid View) ──────────────────────────────────────────────────
function VideoCardGrid({
  video,
  index,
  isFavorite,
  onToggleFavorite,
  onImport,
  onSave,
}: {
  video: TrendingVideo;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onImport: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="glass glass-hover group overflow-hidden p-0">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden">
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/30">
              <Play className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {formatDurationLabel(video.duration)}
          </div>
          {/* Favorite button */}
          <button
            onClick={onToggleFavorite}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Toggle favorite"
          >
            <Heart
              className={cn(
                'h-4 w-4 transition',
                isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white/80',
              )}
            />
          </button>
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          {/* Title */}
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug">
            {video.title}
          </h3>

          {/* Channel */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate font-medium">{video.channel_title || 'Unknown channel'}</span>
            {video.channel_id && (
              <Badge variant="secondary" className="h-4 shrink-0 gap-0.5 px-1 text-[10px]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                </svg>
              </Badge>
            )}
            {video.channel_subscribers != null && video.channel_subscribers > 0 && (
              <span className="shrink-0 text-muted-foreground/60">
                · {formatNumber(video.channel_subscribers)} subs
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {formatNumber(video.view_count)}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> {formatNumber(video.like_count)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> {formatNumber(video.comment_count)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatRelativeTime(video.published_at)}
            </span>
          </div>

          {/* Score badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={cn('gap-1 text-[10px]', getTrendColor(video.trend_score))}>
              <Flame className="h-2.5 w-2.5" /> {video.trend_score?.toFixed(0) || 0}
            </Badge>
            <Badge variant="outline" className={cn('gap-1 text-[10px]', getViralityColor(video.virality_score))}>
              <Zap className="h-2.5 w-2.5" /> {video.virality_score?.toFixed(0) || 0}
            </Badge>
            <Badge variant="outline" className={cn('gap-1 text-[10px]', getGrowthColor(video.growth_rate))}>
              <TrendingUp className="h-2.5 w-2.5" /> {video.growth_rate?.toFixed(0) || 0}%
            </Badge>
            {video.view_velocity != null && video.view_velocity > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <BarChart3 className="h-2.5 w-2.5" /> {formatNumber(video.view_velocity)}/hr
              </Badge>
            )}
            {video.estimated_audience && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Users className="h-2.5 w-2.5" /> {video.estimated_audience}
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => window.open(`/dashboard/video-studio/analyzer?video=${video.video_id}`, '_self')}
            >
              <BarChart3 className="h-3 w-3" /> Analyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onImport}
            >
              <Bookmark className="h-3 w-3" /> Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => window.open(`/dashboard/ai-studio?mode=script`, '_self')}
            >
              <PenLine className="h-3 w-3" /> Script
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => window.open(`/dashboard/thumbnail-studio`, '_self')}
            >
              <Image className="h-3 w-3" /> Thumb
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => window.open(`/dashboard/video-studio/clipper?video=${video.video_id}`, '_self')}
            >
              <Scissors className="h-3 w-3" /> Shorts
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
            >
              <Youtube className="h-3 w-3" /> YouTube
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onSave}
            >
              <ExternalLink className="h-3 w-3" /> Library
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Video Card (List View) ──────────────────────────────────────────────────
function VideoCardList({
  video,
  index,
  isFavorite,
  onToggleFavorite,
  onImport,
  onSave,
}: {
  video: TrendingVideo;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onImport: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
    >
      <Card className="glass glass-hover group overflow-hidden p-0">
        <div className="flex gap-4 p-3">
          {/* Thumbnail */}
          <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg sm:w-48">
            {video.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/30">
                <Play className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {formatDurationLabel(video.duration)}
            </div>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Title + favorite */}
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 flex-1 font-display text-sm font-semibold leading-snug">
                {video.title}
              </h3>
              <button
                onClick={onToggleFavorite}
                className="shrink-0 rounded-full p-1 transition hover:bg-muted/40"
                aria-label="Toggle favorite"
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition',
                    isFavorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground',
                  )}
                />
              </button>
            </div>

            {/* Channel */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-medium">{video.channel_title || 'Unknown channel'}</span>
              {video.channel_id && (
                <Badge variant="secondary" className="h-4 shrink-0 gap-0.5 px-1 text-[10px]">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                </Badge>
              )}
              {video.channel_subscribers != null && video.channel_subscribers > 0 && (
                <span className="shrink-0 text-muted-foreground/60">
                  · {formatNumber(video.channel_subscribers)} subs
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {formatNumber(video.view_count)}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> {formatNumber(video.like_count)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {formatNumber(video.comment_count)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatRelativeTime(video.published_at)}
              </span>
            </div>

            {/* Score badges */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className={cn('gap-1 text-[10px]', getTrendColor(video.trend_score))}>
                <Flame className="h-2.5 w-2.5" /> Trend {video.trend_score?.toFixed(0) || 0}
              </Badge>
              <Badge variant="outline" className={cn('gap-1 text-[10px]', getViralityColor(video.virality_score))}>
                <Zap className="h-2.5 w-2.5" /> Viral {video.virality_score?.toFixed(0) || 0}
              </Badge>
              <Badge variant="outline" className={cn('gap-1 text-[10px]', getGrowthColor(video.growth_rate))}>
                <TrendingUp className="h-2.5 w-2.5" /> {video.growth_rate?.toFixed(0) || 0}%
              </Badge>
              {video.view_velocity != null && video.view_velocity > 0 && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <BarChart3 className="h-2.5 w-2.5" /> {formatNumber(video.view_velocity)}/hr
                </Badge>
              )}
              {video.estimated_audience && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Users className="h-2.5 w-2.5" /> {video.estimated_audience}
                </Badge>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => window.open(`/dashboard/video-studio/analyzer?video=${video.video_id}`, '_self')}
              >
                <BarChart3 className="h-3 w-3" /> Analyze
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onImport}
              >
                <Bookmark className="h-3 w-3" /> Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => window.open(`/dashboard/ai-studio?mode=script`, '_self')}
              >
                <PenLine className="h-3 w-3" /> Script
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => window.open(`/dashboard/thumbnail-studio`, '_self')}
              >
                <Image className="h-3 w-3" /> Thumb
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => window.open(`/dashboard/video-studio/clipper?video=${video.video_id}`, '_self')}
              >
                <Scissors className="h-3 w-3" /> Shorts
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
              >
                <Youtube className="h-3 w-3" /> YouTube
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onSave}
              >
                <ExternalLink className="h-3 w-3" /> Library
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
