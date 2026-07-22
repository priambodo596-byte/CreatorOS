'use client';

import { useState, useCallback, useEffect } from 'react';
import { listContent, type ContentItem, type ContentListFilters, type ContentStatus } from '@/lib/content';
import { useDebounce } from './use-supabase-query';

export function useContentList(initial: Partial<ContentListFilters> = {}) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<ContentStatus | 'all'>(initial.status ?? 'all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [playlistId, setPlaylistId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'published_at' | 'title'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listContent({
      search: debouncedSearch || undefined,
      status, categoryId, playlistId,
      sortBy, sortDir, page, pageSize,
      trashOnly: initial.trashOnly,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load content');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, categoryId, playlistId, sortBy, sortDir, page, refreshKey]);

  useEffect(() => { setPage(1); }, [debouncedSearch, status, categoryId, playlistId]);

  return {
    items, total, loading, error, refresh,
    search, setSearch, status, setStatus, categoryId, setCategoryId,
    playlistId, setPlaylistId, sortBy, setSortBy, sortDir, setSortDir,
    page, setPage, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
