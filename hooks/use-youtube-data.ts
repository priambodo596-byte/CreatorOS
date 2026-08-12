'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchChannelStats,
  fetchAnalytics,
  fetchVideos,
  fetchTrafficSources,
  fetchTopCountries,
  getConnection,
  getSyncedChannel,
  getSyncedAnalytics,
  getSyncedVideos,
  type ChannelStats,
  type AnalyticsRow,
  type VideoInfo,
} from '@/lib/youtube';
import { useAuth } from '@/lib/auth-context';

export type YouTubeConnectionState =
  | 'not_connected'
  | 'connected_loading'
  | 'connected_with_data'
  | 'connected_empty'
  | 'token_expired'
  | 'permission_missing'
  | 'api_error';

interface YouTubeDataState {
  connected: boolean;
  connectionState: YouTubeConnectionState;
  loading: boolean;
  error: string | null;
  channelStats: ChannelStats | null;
  analytics: AnalyticsRow[];
  videos: VideoInfo[];
  trafficSources: { source: string; views: number }[];
  topCountries: { country: string; views: number }[];
  refresh: () => void;
}

export function useYouTubeData(): YouTubeDataState {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<YouTubeConnectionState>('connected_loading');
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [trafficSources, setTrafficSources] = useState<{ source: string; views: number }[]>([]);
  const [topCountries, setTopCountries] = useState<{ country: string; views: number }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const inflightRef = useRef(false);

  const refresh = useCallback(() => {
    if (inflightRef.current) return;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    inflightRef.current = true;

    async function load() {
      setLoading(true);
      setError(null);

      // Check connection first
      let isConnected = false;
      try {
        const conn = await getConnection();
        isConnected = !!conn;
      } catch {
        // ignore connection check errors
      }

      if (!isConnected) {
        if (cancelled) return;
        setConnectionState('not_connected');
        setLoading(false);
        inflightRef.current = false;
        return;
      }

      setConnectionState('connected_loading');

      try {
        const [stats, analyticsData, videosData, traffic, countries] = await Promise.allSettled([
          fetchChannelStats(),
          fetchAnalytics(),
          fetchVideos(10),
          fetchTrafficSources(),
          fetchTopCountries(),
        ]);

        if (cancelled) return;

        const statsOk = stats.status === 'fulfilled';
        const analyticsOk = analyticsData.status === 'fulfilled' && analyticsData.value.length > 0;
        const trafficOk = traffic.status === 'fulfilled' && traffic.value.length > 0;

        if (statsOk) setChannelStats(stats.value);
        if (analyticsOk) setAnalytics(analyticsData.value);
        if (videosData.status === 'fulfilled') setVideos(videosData.value);
        if (trafficOk) setTrafficSources(traffic.value);
        if (countries.status === 'fulfilled') setTopCountries(countries.value);

        // Determine connection state based on results
        const allRejected =
          stats.status === 'rejected' &&
          analyticsData.status === 'rejected' &&
          traffic.status === 'rejected';

        if (allRejected) {
          // Check if it's a token/permission issue from the first rejection
          const firstError = stats.reason?.message || '';
          const firstStatus = stats.reason?.status || 0;

          if (firstStatus === 401 || firstError.toLowerCase().includes('refresh') || firstError.toLowerCase().includes('expired') || firstError.toLowerCase().includes('reauth')) {
            setConnectionState('token_expired');
            setError(firstError);
          } else if (firstStatus === 403 || firstError.toLowerCase().includes('permission') || firstError.toLowerCase().includes('scope')) {
            setConnectionState('permission_missing');
            setError(firstError);
          } else {
            // Fall back to synced database data
            const [syncedChannel, syncedAnalytics, syncedVids] = await Promise.allSettled([
              getSyncedChannel(),
              getSyncedAnalytics(),
              getSyncedVideos(10),
            ]);

            if (cancelled) return;

            const hasSyncedData =
              (syncedChannel.status === 'fulfilled' && syncedChannel.value) ||
              (syncedAnalytics.status === 'fulfilled' && syncedAnalytics.value.length > 0) ||
              (syncedVids.status === 'fulfilled' && syncedVids.value.length > 0);

            if (syncedChannel.status === 'fulfilled' && syncedChannel.value) {
              const ch = syncedChannel.value;
              setChannelStats({
                viewCount: String(ch.view_count),
                subscriberCount: String(ch.subscriber_count),
                videoCount: String(ch.video_count),
                title: ch.title,
                thumbnail: ch.thumbnail_url,
                description: ch.description,
              });
            }

            if (syncedAnalytics.status === 'fulfilled' && syncedAnalytics.value.length > 0) {
              setAnalytics(syncedAnalytics.value);
            }

            if (syncedVids.status === 'fulfilled' && syncedVids.value.length > 0) {
              setVideos(syncedVids.value.map((v) => ({
                id: v.video_id,
                title: v.title,
                description: v.description,
                thumbnail: v.thumbnail_url,
                publishedAt: v.published_at,
                duration: v.duration,
                viewCount: v.view_count,
                likeCount: v.like_count,
                commentCount: v.comment_count,
              })));
            }

            if (hasSyncedData) {
              setConnectionState('connected_with_data');
              setError('Showing cached data from last sync. ' + firstError);
            } else {
              setConnectionState('api_error');
              setError(firstError);
            }
          }
        } else if (analyticsOk || trafficOk || statsOk) {
          setConnectionState('connected_with_data');
        } else {
          // Connected but no data returned
          setConnectionState('connected_empty');
        }
      } catch (err) {
        if (!cancelled) {
          setConnectionState('api_error');
          setError(err instanceof Error ? err.message : 'Failed to load YouTube data');
        }
      } finally {
        if (!cancelled) setLoading(false);
        inflightRef.current = false;
      }
    }

    load();
    return () => { cancelled = true; inflightRef.current = false; };
  }, [refreshKey, authLoading, user]);

  return {
    connected: connectionState !== 'not_connected',
    connectionState,
    loading,
    error,
    channelStats,
    analytics,
    videos,
    trafficSources,
    topCountries,
    refresh,
  };
}
