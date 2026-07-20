import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';
import type { AnalyticsRow, SyncedVideo } from './youtube';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrendingVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  category: string;
  categoryId: string;
  duration: string;
  description: string;
  tags: string[];
  // Calculated growth metrics
  viewsPerDay: number;
  engagementRate: number;
  viralScore: number;
}

export interface TrendingResult {
  videos: TrendingVideo[];
  fetchedAt: string;
  region: string;
  category: string;
}

export interface KeywordSuggestion {
  keyword: string;
  searchVolume: number;       // Estimated from aggregate video view counts
  competition: number;         // Number of results returned by YouTube search
  difficulty: number;           // 0-100 score derived from competition + avg views
  trend: 'up' | 'down' | 'stable';
  avgViews: number;
  topVideoTitle: string;
  topVideoId: string;
  relatedKeywords: string[];
}

export interface KeywordResearchResult {
  keyword: string;
  suggestions: KeywordSuggestion[];
  fetchedAt: string;
}

export interface CompetitorChannel {
  channelId: string;
  title: string;
  description: string;
  customUrl: string;
  country: string;
  publishedAt: string;
  thumbnailUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  keywords: string[];
  topicCategories: string[];
  uploadsPlaylistId: string;
  // Calculated metrics
  avgViewsPerVideo: number;
  engagementRate: number;
  uploadFrequencyPerWeek: number;
  avgDurationSeconds: number;
  mostViewedVideo: {
    videoId: string;
    title: string;
    thumbnail: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
  };
  recentUploads: CompetitorVideo[];
}

export interface CompetitorVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface CompetitorResult {
  channel: CompetitorChannel;
  fetchedAt: string;
}

export interface ViralScoreBreakdown {
  metric: string;
  score: number;       // 0-100
  weight: number;       // 0-1
  weightedScore: number;
  rawValue: number;
  benchmark: string;
}

export interface ViralScoreResult {
  overallScore: number;       // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  breakdown: ViralScoreBreakdown[];
  recommendations: string[];
  topVideo: {
    title: string;
    videoId: string;
    score: number;
  };
  calculatedAt: string;
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callResearchFunction(name: string, body: Record<string, unknown>): Promise<any> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  // Also get YouTube OAuth tokens to pass to edge functions
  let ytAccessToken: string | undefined;
  try {
    const { getTokens } = await import('./youtube');
    const tokens = await getTokens();
    ytAccessToken = tokens?.accessToken;
  } catch {
    // YouTube not connected - edge functions will fall back to API key
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = `Bearer ${supabaseAnonKey}`;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, accessToken: ytAccessToken }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function ${name} failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Validate that the response has the expected fields before returning
  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ─── YouTube Category Map (for readable category names) ──────────────────────

export const YOUTUBE_CATEGORIES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Tech',
  '29': 'Nonprofits & Activism',
};

// ─── Trending Videos ─────────────────────────────────────────────────────────

export async function fetchTrendingVideos(
  region: string = 'US',
  category: string = '0', // '0' = all categories
  maxResults: number = 25,
): Promise<TrendingResult> {
  const data = await callResearchFunction('youtube-trending', {
    region,
    category,
    maxResults,
  });

  if (!data.videos || !Array.isArray(data.videos)) {
    return { videos: [], fetchedAt: new Date().toISOString(), region, category };
  }

  const videos: TrendingVideo[] = data.videos.map((v: Record<string, unknown>) => {
    const viewCount = Number(v.view_count ?? v.viewCount ?? 0);
    const likeCount = Number(v.like_count ?? v.likeCount ?? 0);
    const commentCount = Number(v.comment_count ?? v.commentCount ?? 0);
    const publishedAt = String(v.published_at ?? v.publishedAt ?? new Date().toISOString());
    const ageDays = Math.max(
      1,
      (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const viewsPerDay = Number(v.viewsPerDay ?? v.view_velocity ?? (viewCount / ageDays));
    const engagementRate = viewCount > 0
      ? ((likeCount + commentCount) / viewCount) * 100
      : Number(v.engagementRate ?? 0);
    const viralScore = Number(
      v.viralScore ?? v.virality_score ?? v.trend_score ?? 0,
    );

    return {
      videoId: String(v.video_id ?? v.videoId ?? v.id ?? ''),
      title: String(v.title ?? ''),
      thumbnail: String(v.thumbnail_url ?? v.thumbnail ?? ''),
      channelTitle: String(v.channel_title ?? v.channelTitle ?? ''),
      channelId: String(v.channel_id ?? v.channelId ?? ''),
      publishedAt,
      viewCount,
      likeCount,
      commentCount,
      category: String(v.category ?? ''),
      categoryId: String(v.category_id ?? v.categoryId ?? ''),
      duration: String(v.duration ?? ''),
      description: String(v.description ?? ''),
      tags: Array.isArray(v.tags) ? v.tags : [],
      viewsPerDay,
      engagementRate,
      viralScore,
    };
  });

  return {
    videos,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
    region: data.region || region,
    category: data.category || category,
  };
}

// ─── Keyword Research ────────────────────────────────────────────────────────

export async function fetchKeywordSuggestions(
  keyword: string,
  region: string = 'US',
): Promise<KeywordResearchResult> {
  if (!keyword.trim()) {
    return { keyword: '', suggestions: [], fetchedAt: new Date().toISOString() };
  }

  const data = await callResearchFunction('youtube-keywords', {
    keyword: keyword.trim(),
    region,
  });

  if (!data.suggestions || !Array.isArray(data.suggestions)) {
    return { keyword, suggestions: [], fetchedAt: new Date().toISOString() };
  }

  return {
    keyword,
    suggestions: data.suggestions,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
  };
}

// ─── Competitor Analysis ─────────────────────────────────────────────────────

export async function fetchCompetitorData(
  channelUrlOrHandle: string,
): Promise<CompetitorResult> {
  if (!channelUrlOrHandle.trim()) {
    throw new Error('Channel URL or handle is required');
  }

  const data = await callResearchFunction('youtube-competitor', {
    channelInput: channelUrlOrHandle.trim(),
  });

  if (!data.channel) {
    throw new Error('No competitor data returned');
  }

  return {
    channel: data.channel,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
  };
}

// ─── Viral Score Calculation (client-side from synced analytics) ─────────────

/**
 * Calculate a viral score from real synced analytics and video data.
 * This is computed entirely client-side from data already fetched via
 * useYouTubeSync — no edge function needed.
 *
 * Score components:
 * - CTR (impressions click-through rate): 30% weight
 * - Engagement rate (likes + comments / views): 25% weight
 * - Watch time (avg view duration vs benchmark): 20% weight
 * - View velocity (views per day vs channel median): 15% weight
 * - Subscriber conversion (net subs / views): 10% weight
 */
export function calculateViralScore(
  analytics: AnalyticsRow[],
  videos: SyncedVideo[],
): ViralScoreResult {
  const calculatedAt = new Date().toISOString();

  if (analytics.length === 0 && videos.length === 0) {
    return {
      overallScore: 0,
      grade: 'D',
      breakdown: [],
      recommendations: ['Sync your YouTube channel to calculate your viral score.'],
      topVideo: { title: '', videoId: '', score: 0 },
      calculatedAt,
    };
  }

  // Aggregate analytics
  const totalViews = analytics.reduce((s, a) => s + a.views, 0);
  const totalImpressions = analytics.reduce((s, a) => s + a.impressions, 0);
  const totalLikes = analytics.reduce((s, a) => s + a.likes, 0);
  const totalComments = analytics.reduce((s, a) => s + a.comments, 0);
  const totalWatchMinutes = analytics.reduce((s, a) => s + a.estimatedMinutesWatched, 0);
  const totalAvgViewDuration = analytics.length > 0
    ? analytics.reduce((s, a) => s + a.averageViewDuration, 0) / analytics.length
    : 0;
  const netSubs = analytics.reduce((s, a) => s + a.subscribersGained - a.subscribersLost, 0);

  // 1. CTR Score (30% weight)
  // YouTube average CTR is ~2-10%; >8% is excellent
  const avgCTR = totalImpressions > 0
    ? (analytics.reduce((s, a) => s + a.impressionsClickThroughRate, 0) / analytics.length)
    : 0;
  const ctrScore = Math.min(100, (avgCTR / 10) * 100);

  // 2. Engagement Rate (25% weight)
  // (likes + comments) / views; >5% is excellent
  const engagementRate = totalViews > 0
    ? ((totalLikes + totalComments) / totalViews) * 100
    : 0;
  const engagementScore = Math.min(100, (engagementRate / 5) * 100);

  // 3. Watch Time / Avg View Duration (20% weight)
  // Benchmark: 3-5 minutes is good for typical videos; >5 min is excellent
  const watchTimeScore = Math.min(100, (totalAvgViewDuration / 300) * 100);

  // 4. View Velocity (15% weight) — views per day for top videos vs median
  const videosWithDates = videos.map((v) => {
    const ageDays = Math.max(
      1,
      (Date.now() - new Date(v.published_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    return { ...v, viewsPerDay: v.view_count / ageDays, ageDays };
  });
  const sortedByVpd = [...videosWithDates].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
  const medianVpd = sortedByVpd.length > 0
    ? sortedByVpd[Math.floor(sortedByVpd.length / 2)].viewsPerDay
    : 0;
  const topVpd = sortedByVpd[0]?.viewsPerDay || 0;
  // Score based on ratio of top to median; >10x median is excellent
  const velocityRatio = medianVpd > 0 ? topVpd / medianVpd : 0;
  const velocityScore = Math.min(100, (velocityRatio / 10) * 100);

  // 5. Subscriber Conversion (10% weight)
  // net subs / views; >1% is excellent
  const subConversionRate = totalViews > 0 ? (netSubs / totalViews) * 100 : 0;
  const subConversionScore = Math.min(100, (subConversionRate / 1) * 100);

  const breakdown: ViralScoreBreakdown[] = [
    {
      metric: 'Click-Through Rate (CTR)',
      score: Math.round(ctrScore),
      weight: 0.30,
      weightedScore: Math.round(ctrScore * 0.30),
      rawValue: avgCTR,
      benchmark: `${avgCTR.toFixed(1)}% (benchmark: 2-10%)`,
    },
    {
      metric: 'Engagement Rate',
      score: Math.round(engagementScore),
      weight: 0.25,
      weightedScore: Math.round(engagementScore * 0.25),
      rawValue: engagementRate,
      benchmark: `${engagementRate.toFixed(2)}% (benchmark: >5%)`,
    },
    {
      metric: 'Average View Duration',
      score: Math.round(watchTimeScore),
      weight: 0.20,
      weightedScore: Math.round(watchTimeScore * 0.20),
      rawValue: totalAvgViewDuration,
      benchmark: `${Math.round(totalAvgViewDuration)}s (benchmark: >300s)`,
    },
    {
      metric: 'View Velocity',
      score: Math.round(velocityScore),
      weight: 0.15,
      weightedScore: Math.round(velocityScore * 0.15),
      rawValue: topVpd,
      benchmark: `${Math.round(topVpd)} views/day top (${velocityRatio.toFixed(1)}x median)`,
    },
    {
      metric: 'Subscriber Conversion',
      score: Math.round(subConversionScore),
      weight: 0.10,
      weightedScore: Math.round(subConversionScore * 0.10),
      rawValue: subConversionRate,
      benchmark: `${subConversionRate.toFixed(2)}% (benchmark: >1%)`,
    },
  ];

  const overallScore = breakdown.reduce((s, b) => s + b.weightedScore, 0);

  const grade: ViralScoreResult['grade'] =
    overallScore >= 90 ? 'A+' :
    overallScore >= 80 ? 'A' :
    overallScore >= 70 ? 'B' :
    overallScore >= 50 ? 'C' : 'D';

  // Generate recommendations based on weakest metrics
  const recommendations: string[] = [];
  const sortedByScore = [...breakdown].sort((a, b) => a.score - b.score);

  for (const item of sortedByScore) {
    if (item.score < 50) {
      switch (item.metric) {
        case 'Click-Through Rate (CTR)':
          recommendations.push(
            `Your CTR is ${avgCTR.toFixed(1)}%. Improve thumbnails with high-contrast text, expressive faces, and clear visual hooks to boost click-through rate.`,
          );
          break;
        case 'Engagement Rate':
          recommendations.push(
            `Engagement rate is ${engagementRate.toFixed(2)}%. Add clear CTAs asking viewers to like and comment, and respond to comments within the first hour of publishing.`,
          );
          break;
        case 'Average View Duration':
          recommendations.push(
            `Average view duration is ${Math.round(totalAvgViewDuration)}s. Focus on a strong hook in the first 15 seconds and use pattern interrupts every 30-60 seconds to maintain attention.`,
          );
          break;
        case 'View Velocity':
          recommendations.push(
            `View velocity shows room for improvement. Publish consistently and leverage trending topics to increase daily views on your top videos.`,
          );
          break;
        case 'Subscriber Conversion':
          recommendations.push(
            `Subscriber conversion is ${subConversionRate.toFixed(2)}%. Add a subscribe call-to-action mid-video (not just at the end) when viewers are most engaged.`,
          );
          break;
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Excellent performance across all metrics. Keep up the consistent publishing schedule and experiment with new content formats.');
  }

  // Find top-scoring video
  const topVideoEntry = sortedByVpd[0];
  const topVideo = topVideoEntry
    ? {
        title: topVideoEntry.title,
        videoId: topVideoEntry.video_id,
        score: Math.min(100, Math.round((topVideoEntry.viewsPerDay / Math.max(medianVpd, 1)) * 50)),
      }
    : { title: '', videoId: '', score: 0 };

  return {
    overallScore: Math.round(overallScore),
    grade,
    breakdown,
    recommendations,
    topVideo,
    calculatedAt,
  };
}

// ─── Utility: Parse ISO 8601 Duration to Seconds ─────────────────────────────

export function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
