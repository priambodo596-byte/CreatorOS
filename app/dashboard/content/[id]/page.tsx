'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Video, Edit, Copy, Archive, Trash2, Gauge, ImageIcon,
  Calendar, User, Tag, Clock, Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ErrorState, LoadingState } from '@/components/dashboard/shared';
import {
  getContentById, getContentActivities, deleteContent, duplicateContent, archiveContent,
  type ContentItem, type ContentActivity,
} from '@/lib/content';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-warning/15 text-warning',
  scheduled: 'bg-info/15 text-info',
  published: 'bg-success/15 text-success',
  archived: 'bg-muted text-muted-foreground',
};

export default function ContentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  const [item, setItem] = useState<ContentItem | null>(null);
  const [activities, setActivities] = useState<ContentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contentRes, activitiesRes] = await Promise.all([
        getContentById(id),
        getContentActivities(id),
      ]);
      setItem(contentRes);
      setActivities(activitiesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  async function handleDuplicate() {
    if (!item) return;
    try {
      const copy = await duplicateContent(item.id);
      toast({ title: 'Content duplicated' });
      router.push(`/dashboard/content/${copy.id}`);
    } catch {
      toast({ title: 'Duplicate failed', variant: 'destructive' });
    }
  }

  async function handleArchive() {
    if (!item) return;
    try {
      await archiveContent(item.id);
      toast({ title: 'Content archived' });
      setArchiveOpen(false);
      load();
    } catch {
      toast({ title: 'Archive failed', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!item) return;
    try {
      await deleteContent(item.id);
      toast({ title: 'Moved to trash' });
      router.push('/dashboard/content');
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <LoadingState message="Loading content..." />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <ErrorState message={error || 'Content not found'} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/content" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Content
        </Link>
        <div className="flex gap-2">
          <Link href="/dashboard/content">
            <Button variant="outline" size="sm"><Edit className="mr-2 h-4 w-4" />Edit in List</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicate</Button>
          <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}><Archive className="mr-2 h-4 w-4" />Archive</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass overflow-hidden p-0">
              <div className="relative aspect-video bg-muted">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Video className="h-10 w-10 text-muted-foreground" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={STATUS_COLORS[item.status]}>{item.status}</Badge>
                  <Badge variant="outline" className="capitalize">{item.visibility}</Badge>
                  <Badge variant="outline" className="capitalize">{item.content_type}</Badge>
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold">{item.title}</h1>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.description || 'No description provided.'}</p>
                {item.tags?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Activity Timeline</h2>
              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{a.action}</p>
                        {a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground/60">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" />Author</span><span>{item.author || '—'}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />Created</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />Updated</span><span>{new Date(item.updated_at).toLocaleDateString()}</span></div>
                {item.scheduled_at && (
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />Scheduled</span><span>{new Date(item.scheduled_at).toLocaleString()}</span></div>
                )}
                {item.published_at && (
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />Published</span><span>{new Date(item.published_at).toLocaleString()}</span></div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Scores</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Gauge className="h-4 w-4" />SEO Score</span>
                    <span className="font-medium">{item.seo_score != null ? `${item.seo_score}/100` : 'Not scored'}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" />Thumbnail Score</span>
                    <span className="font-medium">{item.thumbnail_score != null ? `${item.thumbnail_score}/100` : 'Not scored'}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{item.title}&quot; will be moved to Trash. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Content?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{item.title}&quot; will be archived and hidden from active views.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
