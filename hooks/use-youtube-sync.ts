'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  triggerFullSync,
  getSyncedChannel,
  getSyncedVideos,
  getSyncedShorts,
  getTopVideos,
  getSyncedPlaylists,
  getSyncedAnalytics,
  getSyncLogs,
  type SyncedChannel,
  type SyncedVideo,
  type SyncedPlaylist,
  type AnalyticsRow,
  type SyncLog,
} from '@/lib/youtube';

const SYNC_INTERVAL = 10 * 60 * 1000;
const SYNC_STORAGE_KEY = 'youtube-last-sync-time';

interface YouTubeSyncState {
  channel: SyncedChannel | null;
  videos: SyncedVideo[];
  shorts: SyncedVideo[];
  topVideos: SyncedVideo[];
  playlists: SyncedPlaylist[];
  analytics: AnalyticsRow[];
  syncLogs: SyncLog[];
  syncing: boolean;
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
  triggerSync: () => Promise<void>;
  refresh: () => void;
}

export function useYouTubeSync(): YouTubeSyncState {
  const { user } = useAuth();
  const [channel, setChannel] = useState<SyncedChannel | null>(null);
  const [videos, setVideos] = useState<SyncedVideo[]>([]);
  const [shorts, setShorts] = useState<SyncedVideo[]>([]);
  const [topVideos, setTopVideos] = useState<SyncedVideo[]>([]);
  const [playlists, setPlaylists] = useState<SyncedPlaylist[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const syncInProgress = useRef(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const loadSyncedData = useCallback(async () => {
    try {
      const [ch, vids, shts, top, pls, anly, logs] = await Promise.allSettled([
        getSyncedChannel(),
        getSyncedVideos(50),
        getSyncedShorts(20),
        getTopVideos(10),
        getSyncedPlaylists(),
        getSyncedAnalytics(),
        getSyncLogs(5),
      ]);

      if (ch.status === 'fulfilled') setChannel(ch.value);
      if (vids.status === 'fulfilled') setVideos(vids.value);
      if (shts.status === 'fulfilled') setShorts(shts.value);
      if (top.status === 'fulfilled') setTopVideos(top.value);
      if (pls.status === 'fulfilled') setPlaylists(pls.value);
      if (anly.status === 'fulfilled') setAnalytics(anly.value);
      if (logs.status === 'fulfilled') setSyncLogs(logs.value);

      if (logs.status === 'fulfilled' && logs.value.length > 0) {
        const latestCompleted = logs.value.find((l) => l.status === 'completed' && l.completed_at);
        if (latestCompleted) {
          setLastSyncAt(new Date(latestCompleted.completed_at!));
        }
      }
    } catch (err) {
      console.error('[useYouTubeSync] Failed to load synced data:', err);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!user || syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);
    setError(null);

    try {
      const result = await triggerFullSync(user.id);
      setLastSyncAt(new Date());
      sessionStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
      await loadSyncedData();
      console.log('[useYouTubeSync] Sync completed:', result);
    } catch (err) {
      console.error('[useYouTubeSync] Sync failed:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [user, loadSyncedData]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadSyncedData();

      if (cancelled) return;

      const lastSyncStr = sessionStorage.getItem(SYNC_STORAGE_KEY);
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
      const shouldAutoSync = Date.now() - lastSync > SYNC_INTERVAL;

      if (shouldAutoSync) {
        triggerSync();
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [user, refreshKey, loadSyncedData, triggerSync]);

  return {
    channel,
    videos,
    shorts,
    topVideos,
    playlists,
    analytics,
    syncLogs,
    syncing,
    loading,
    error,
    lastSyncAt,
    triggerSync,
    refresh,
  };
}
