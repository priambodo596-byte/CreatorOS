import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YouTubeConnection {
  id: string;
  channel_id: string;
  channel_title: string;
  channel_thumbnail: string;
  connected_at: string;
}

export interface ChannelStats {
  viewCount: string;
  subscriberCount: string;
  videoCount: string;
  title: string;
  thumbnail: string;
  description: string;
}

export interface AnalyticsRow {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  impressions: number;
  impressionsClickThroughRate: number;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface SyncedChannel {
  channel_id: string;
  title: string;
  description: string;
  custom_url: string;
  country: string;
  published_at: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  thumbnail_url: string;
  banner_url: string;
  keywords: string[];
  topic_categories: string[];
  uploads_playlist_id: string;
  synced_at: string;
}

export interface SyncedVideo {
  video_id: string;
  title: string;
  description: string;
  category_id: string;
  tags: string[];
  published_at: string;
  duration: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  favorite_count: number;
  comment_count: number;
  privacy_status: string;
  license: string;
  caption_status: string;
  made_for_kids: boolean;
  is_short: boolean;
  live_status: string;
  default_language: string;
  default_audio_language: string;
  synced_at: string;
}

export interface SyncedPlaylist {
  playlist_id: string;
  title: string;
  description: string;
  item_count: number;
  published_at: string;
  thumbnail_url: string;
}

export interface SyncedComment {
  comment_id: string;
  video_id: string;
  author: string;
  author_channel_id: string;
  text: string;
  like_count: number;
  reply_count: number;
  published_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  videos_synced: number;
  comments_synced: number;
  playlists_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface SyncResult {
  success: boolean;
  channel: {
    title: string;
    channelId: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
  };
  stats: {
    videosSynced: number;
    commentsSynced: number;
    playlistsSynced: number;
  };
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callEdgeFunction(name: string, body: unknown) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

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
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function ${name} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── OAuth Functions ─────────────────────────────────────────────────────────

export async function getAuthUrl(): Promise<{ authUrl: string; state: string }> {
  const res = await fetch(
    `${supabaseUrl}/functions/v1/youtube-oauth?action=auth-url`,
    {
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
    },
  );
  if (!res.ok) throw new Error('Failed to get auth URL');
  return res.json();
}

export async function exchangeCode(code: string, userId: string) {
  return callEdgeFunction('youtube-oauth', { action: 'callback', code, userId });
}

export async function getConnection(): Promise<YouTubeConnection | null> {
  const { data, error } = await supabase
    .from('youtube_connections')
    .select('id, channel_id, channel_title, channel_thumbnail, connected_at')
    .maybeSingle();

  if (error) throw error;
  return data as YouTubeConnection | null;
}

export async function getTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const { data, error } = await supabase
    .from('youtube_connections')
    .select('user_id, access_token, refresh_token, token_expires_at')
    .maybeSingle();

  if (error || !data) return null;

  const isExpired = data.token_expires_at
    ? new Date(data.token_expires_at).getTime() < Date.now() + 60000
    : true;

  if (isExpired && data.refresh_token) {
    try {
      const refreshRes = await fetch(
        `${supabaseUrl}/functions/v1/youtube-oauth?action=refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ refreshToken: data.refresh_token }),
        },
      );
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        await supabase
          .from('youtube_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', data.user_id);
        return { accessToken: refreshed.access_token, refreshToken: data.refresh_token };
      }
    } catch {
      // fall through to return existing token
    }
  }

  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

// ─── Live API Functions (via edge function) ──────────────────────────────────

export async function fetchChannelStats(): Promise<ChannelStats> {
  const tokens = await getTokens();
  if (!tokens) throw new Error('Not connected to YouTube');

  const data = await callEdgeFunction('youtube-analytics', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    action: 'channel-stats',
  });

  const channel = data.items?.[0];
  if (!channel) throw new Error('No channel data found');

  return {
    viewCount: channel.statistics?.viewCount ?? '0',
    subscriberCount: channel.statistics?.subscriberCount ?? '0',
    videoCount: channel.statistics?.videoCount ?? '0',
    title: channel.snippet?.title ?? 'Unknown',
    thumbnail: channel.snippet?.thumbnails?.default?.url ?? '',
    description: channel.snippet?.description ?? '',
  };
}

export async function fetchAnalytics(
  startDate?: string,
  endDate?: string,
): Promise<AnalyticsRow[]> {
  const tokens = await getTokens();
  if (!tokens) throw new Error('Not connected to YouTube');

  const data = await callEdgeFunction('youtube-analytics', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    action: 'analytics',
    params: { startDate, endDate },
  });

  if (!data.rows) return [];

  const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || [];
  return data.rows.map((row: (string | number)[]) => {
    const obj: Record<string, string | number> = {};
    headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
    return {
      day: String(obj.day || ''),
      views: Number(obj.views || 0),
      estimatedMinutesWatched: Number(obj.estimatedMinutesWatched || 0),
      averageViewDuration: Number(obj.averageViewDuration || 0),
      impressions: Number(obj.impressions || 0),
      impressionsClickThroughRate: Number(obj.impressionsClickThroughRate || 0),
      subscribersGained: Number(obj.subscribersGained || 0),
      subscribersLost: Number(obj.subscribersLost || 0),
      likes: Number(obj.likes || 0),
      comments: Number(obj.comments || 0),
      shares: Number(obj.shares || 0),
    };
  });
}

export async function fetchVideos(maxResults = 10): Promise<VideoInfo[]> {
  const tokens = await getTokens();
  if (!tokens) throw new Error('Not connected to YouTube');

  const data = await callEdgeFunction('youtube-analytics', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    action: 'videos',
    params: { maxResults },
  });

  if (!data.items) return [];

  return data.items.map((v: {
    id: string;
    snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }) => ({
    id: v.id,
    title: v.snippet?.title ?? '',
    description: v.snippet?.description ?? '',
    thumbnail: v.snippet?.thumbnails?.medium?.url ?? '',
    publishedAt: v.snippet?.publishedAt ?? '',
    duration: v.contentDetails?.duration ?? '',
    viewCount: Number(v.statistics?.viewCount ?? 0),
    likeCount: Number(v.statistics?.likeCount ?? 0),
    commentCount: Number(v.statistics?.commentCount ?? 0),
  }));
}

export async function fetchTrafficSources(): Promise<{ source: string; views: number }[]> {
  const tokens = await getTokens();
  if (!tokens) throw new Error('Not connected to YouTube');

  const data = await callEdgeFunction('youtube-analytics', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    action: 'traffic-sources',
  });

  if (!data.rows) return [];
  return data.rows.map((r: string[]) => ({ source: r[0], views: Number(r[1]) }));
}

export async function fetchTopCountries(): Promise<{ country: string; views: number }[]> {
  const tokens = await getTokens();
  if (!tokens) throw new Error('Not connected to YouTube');

  const data = await callEdgeFunction('youtube-analytics', {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    action: 'top-countries',
  });

  if (!data.rows) return [];
  return data.rows.map((r: string[]) => ({ country: r[0], views: Number(r[1]) }));
}

// ─── Full Sync (via youtube-sync edge function) ──────────────────────────────

export async function triggerFullSync(
  userId: string,
  options?: {
    syncComments?: boolean;
    syncAnalytics?: boolean;
    analyticsStartDate?: string;
    analyticsEndDate?: string;
  },
): Promise<SyncResult> {
  return callEdgeFunction('youtube-sync', {
    userId,
    syncComments: options?.syncComments ?? true,
    syncAnalytics: options?.syncAnalytics ?? true,
    analyticsStartDate: options?.analyticsStartDate,
    analyticsEndDate: options?.analyticsEndDate,
  });
}

// ─── Synced Data from Database ───────────────────────────────────────────────

export async function getSyncedChannel(): Promise<SyncedChannel | null> {
  const { data, error } = await supabase
    .from('youtube_channels')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as SyncedChannel | null;
}

export async function getSyncedVideos(limit = 50, offset = 0): Promise<SyncedVideo[]> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []) as SyncedVideo[];
}

export async function getSyncedShorts(limit = 20): Promise<SyncedVideo[]> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('is_short', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SyncedVideo[];
}

export async function getTopVideos(limit = 10): Promise<SyncedVideo[]> {
  const { data, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .order('view_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SyncedVideo[];
}

export async function getSyncedPlaylists(): Promise<SyncedPlaylist[]> {
  const { data, error } = await supabase
    .from('youtube_playlists')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SyncedPlaylist[];
}

export async function getSyncedComments(videoId?: string, limit = 50): Promise<SyncedComment[]> {
  let query = supabase
    .from('youtube_comments')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (videoId) {
    query = query.eq('video_id', videoId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SyncedComment[];
}

export async function getSyncedAnalytics(startDate?: string, endDate?: string): Promise<AnalyticsRow[]> {
  let query = supabase
    .from('youtube_analytics_daily')
    .select('*')
    .order('date', { ascending: true });

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    day: String(row.date || ''),
    views: Number(row.views || 0),
    estimatedMinutesWatched: Number(row.estimated_minutes_watched || 0),
    averageViewDuration: Number(row.average_view_duration || 0),
    impressions: Number(row.impressions || 0),
    impressionsClickThroughRate: Number(row.impressions_ctr || 0),
    subscribersGained: Number(row.subscribers_gained || 0),
    subscribersLost: Number(row.subscribers_lost || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    shares: Number(row.shares || 0),
  }));
}

export async function getSyncLogs(limit = 5): Promise<SyncLog[]> {
  const { data, error } = await supabase
    .from('youtube_sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as SyncLog[];
}

export async function disconnectYouTube() {
  const { error } = await supabase
    .from('youtube_connections')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw error;
}
