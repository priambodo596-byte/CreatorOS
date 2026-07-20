'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RotateCcw, Trash2, Video, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, EmptyState, ErrorState, SkeletonTable } from '@/components/dashboard/shared';
import {
  listContent, restoreContent, permanentlyDeleteContent, bulkRestore, bulkPermanentDelete,
  type ContentItem,
} from '@/lib/content';

export default function TrashPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [permDeleteTarget, setPermDeleteTarget] = useState<ContentItem | 'bulk' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContent({ trashOnly: true, sortBy: 'updated_at', sortDir: 'desc', pageSize: 100 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    setSelectedIds((prev) => (prev.length === items.length ? [] : items.map((i) => i.id)));
  }

  async function handleRestore(id: string) {
    try {
      await restoreContent(id);
      toast({ title: 'Content restored' });
      load();
    } catch { toast({ title: 'Restore failed', variant: 'destructive' }); }
  }

  async function handleBulkRestore() {
    try {
      await bulkRestore(selectedIds);
      toast({ title: `${selectedIds.length} items restored` });
      setSelectedIds([]);
      load();
    } catch { toast({ title: 'Bulk restore failed', variant: 'destructive' }); }
  }

  async function confirmPermanentDelete() {
    try {
      if (permDeleteTarget === 'bulk') {
        await bulkPermanentDelete(selectedIds);
        toast({ title: `${selectedIds.length} items permanently deleted` });
        setSelectedIds([]);
      } else if (permDeleteTarget) {
        await permanentlyDeleteContent(permDeleteTarget.id);
        toast({ title: 'Permanently deleted' });
      }
      setPermDeleteTarget(null);
      load();
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader title="Trash" description="Items here can be restored or permanently deleted." />

      {selectedIds.length > 0 && (
        <Card className="glass flex items-center justify-between p-3">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkRestore}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setPermDeleteTarget('bulk')}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete Permanently</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty" description="Deleted content will show up here." />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Checkbox checked={selectedIds.length === items.length} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
          {items.map((item) => (
            <Card key={item.id} className="glass flex items-center gap-4 p-3">
              <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggle(item.id)} />
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Video className="h-5 w-5 text-muted-foreground" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">Deleted {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : ''}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleRestore(item.id)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setPermDeleteTarget(item)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /></Button>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!permDeleteTarget} onOpenChange={(o) => !o && setPermDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {permDeleteTarget === 'bulk' ? `${selectedIds.length} items` : `"${(permDeleteTarget as ContentItem)?.title}"`} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
