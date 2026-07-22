'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getWorkspaceSummary,
  getAiUsageSummary,
  getStorageBreakdown,
  getRecentActivities,
  getUpcomingItems,
  type WorkspaceSummary,
  type AiUsageSummary,
  type StorageBreakdown,
  type RecentActivityRow,
  type UpcomingItem,
} from '@/lib/dashboard';
import { listContent, type ContentItem } from '@/lib/content';

interface DashboardSummaryState {
  loading: boolean;
  error: string | null;
  workspace: WorkspaceSummary | null;
  aiUsage: AiUsageSummary | null;
  storage: StorageBreakdown | null;
  activities: RecentActivityRow[];
  upcoming: UpcomingItem[];
  recentContent: ContentItem[];
  refresh: () => void;
}

export function useDashboardSummary(): DashboardSummaryState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ws, ai, st, act, up, content] = await Promise.allSettled([
          getWorkspaceSummary(),
          getAiUsageSummary(),
          getStorageBreakdown(),
          getRecentActivities(6),
          getUpcomingItems(5),
          listContent({ pageSize: 5, sortBy: 'updated_at', sortDir: 'desc' }),
        ]);

        if (cancelled) return;

        if (ws.status === 'fulfilled') setWorkspace(ws.value);
        if (ai.status === 'fulfilled') setAiUsage(ai.value);
        if (st.status === 'fulfilled') setStorage(st.value);
        if (act.status === 'fulfilled') setActivities(act.value);
        if (up.status === 'fulfilled') setUpcoming(up.value);
        if (content.status === 'fulfilled') setRecentContent(content.value.items);

        if (ws.status === 'rejected') {
          setError(ws.reason?.message || 'Failed to load workspace summary');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { loading, error, workspace, aiUsage, storage, activities, upcoming, recentContent, refresh };
}
