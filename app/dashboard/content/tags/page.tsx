'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Hash } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '@/components/dashboard/shared';
import { getAllTags } from '@/lib/content';

export default function TagsPage() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTags(await getAllTags());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader title="Tags" description="All tags currently used across your content." />

      {loading ? (
        <LoadingState message="Loading tags..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tags.length === 0 ? (
        <EmptyState icon={Hash} title="No tags yet" description="Tags you add to content will appear here." />
      ) : (
        <Card className="glass p-5">
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/dashboard/content?search=${encodeURIComponent(tag)}`}
                className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <Hash className="h-3.5 w-3.5 text-primary" />
                {tag}
                <span className="text-xs text-muted-foreground">{count}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
