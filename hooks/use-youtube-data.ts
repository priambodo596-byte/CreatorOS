'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchChannelStats,
  fetchAnalytics,
  fetchVideos,
  fetchTrafficSources,
  fetchTopCountries,
  type ChannelStats,
  type AnalyticsRow,
  type VideoInfo,
} from '@/lib/youtube';

interface YouTubeDataState {
  connected: boolean;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [trafficSources, setTrafficSources] = useState<{ source: string; views: number }[]>([]);
  const [topCountries, setTopCountries] = useState<{ country: string; views: number }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [stats, analyticsData, videosData, traffic, countries] = await Promise.allSettled([
          fetchChannelStats(),
          fetchAnalytics(),
          fetchVideos(10),
          fetchTrafficSources(),
          fetchTopCountries(),
        ]);

        if (cancelled) return;

        if (stats.status === 'fulfilled') setChannelStats(stats.value);
        if (analyticsData.status === 'fulfilled') setAnalytics(analyticsData.value);
        if (videosData.status === 'fulfilled') setVideos(videosData.value);
        if (traffic.status === 'fulfilled') setTrafficSources(traffic.value);
        if (countries.status === 'fulfilled') setTopCountries(countries.value);

        if (stats.status === 'rejected') {
          setError(stats.reason?.message || 'Not connected to YouTube');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return {
    connected: !!channelStats,
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
