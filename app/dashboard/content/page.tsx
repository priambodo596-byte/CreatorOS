'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Search,
  Table as TableIcon,
  LayoutGrid,
  GalleryVertical,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Video,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-supabase-query';
import { PageHeader, EmptyState, ErrorState, SkeletonTable } from '@/components/dashboard/shared';
import {
  listContent, createContent, updateContent, deleteContent, duplicateContent,
  archiveContent, bulkDelete, bulkPublish, bulkArchive, listCategories, listPlaylists,
  type ContentItem, type ContentStatus, type ContentCategory, type ContentPlaylist,
} from '@/lib/content';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-warning/15 text-warning',
  scheduled: 'bg-info/15 text-info',
  published: 'bg-success/15 text-success',
  archived: 'bg-muted text-muted-foreground',
};

const PAGE_SIZE = 12;

type ViewMode = 'table' | 'grid' | 'card';

interface ContentFormState {
  id?: string;
  title: string;
  description: string;
  content_type: string;
  status: ContentStatus;
  visibility: 'public' | 'unlisted' | 'private';
  category_id: string;
  playlist_id: string;
  channel_name: string;
  tags: string;
  scheduled_at: string;
}

const EMPTY_FORM: ContentFormState = {
  title: '', description: '', content_type: 'video', status: 'draft',
  visibility: 'private', category_id: '', playlist_id: '', channel_name: '',
  tags: '', scheduled_at: '',
};

function ContentPageInner() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as ContentStatus | null) || 'all';

  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState<ContentStatus | 'all'>(initialStatus);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [playlistId, setPlaylistId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'published_at' | 'title'>('updated_at');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('table');

  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [playlists, setPlaylists] = useState<ContentPlaylist[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ContentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ContentItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
    listPlaylists().then(setPlaylists).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContent({
        search: debouncedSearch || undefined,
        status,
        categoryId,
        playlistId,
        sortBy,
        sortDir: 'desc',
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, categoryId, playlistId, sortBy, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, categoryId, playlistId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(item: ContentItem) {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description || '',
      content_type: item.content_type,
      status: item.status,
      visibility: item.visibility,
      category_id: item.category_id || '',
      playlist_id: item.playlist_id || '',
      channel_name: item.channel_name || '',
      tags: (item.tags || []).join(', '),
      scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        content_type: form.content_type,
        status: form.status,
        visibility: form.visibility,
        category_id: form.category_id || null,
        playlist_id: form.playlist_id || null,
        channel_name: form.channel_name || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      };
      if (form.id) {
        await updateContent(form.id, payload);
        toast({ title: 'Content updated' });
      } else {
        await createContent(payload);
        toast({ title: 'Content created' });
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteContent(deleteTarget.id);
      toast({ title: 'Moved to trash' });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await archiveContent(archiveTarget.id);
      toast({ title: 'Content archived' });
      setArchiveTarget(null);
      load();
    } catch (err) {
      toast({ title: 'Archive failed', variant: 'destructive' });
    }
  }

  async function handleDuplicate(item: ContentItem) {
    try {
      await duplicateContent(item.id);
      toast({ title: 'Content duplicated' });
      load();
    } catch (err) {
      toast({ title: 'Duplicate failed', variant: 'destructive' });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === items.length ? [] : items.map((i) => i.id)));
  }

  async function handleBulkPublish() {
    try {
      await bulkPublish(selectedIds);
      toast({ title: `${selectedIds.length} items published` });
      setSelectedIds([]);
      load();
    } catch { toast({ title: 'Bulk publish failed', variant: 'destructive' }); }
  }

  async function handleBulkArchive() {
    try {
      await bulkArchive(selectedIds);
      toast({ title: `${selectedIds.length} items archived` });
      setSelectedIds([]);
      load();
    } catch { toast({ title: 'Bulk archive failed', variant: 'destructive' }); }
  }

  async function handleBulkDelete() {
    try {
      await bulkDelete(selectedIds);
      toast({ title: `${selectedIds.length} items moved to trash` });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      load();
    } catch { toast({ title: 'Bulk delete failed', variant: 'destructive' }); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Content"
        description="Manage every piece of content across your channels."
        actions={
          <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-primary to-accent text-white">
            <Plus className="mr-2 h-4 w-4" /> New Content
          </Button>
        }
      />

      {/* Filters */}
      <Card className="glass p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search content..." className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as ContentStatus | 'all')}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={playlistId} onValueChange={setPlaylistId}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Playlist" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Playlists</SelectItem>
                {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Last Updated</SelectItem>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="published_at">Publish Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-9">
                <TabsTrigger value="table" className="px-2"><TableIcon className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="grid" className="px-2"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="card" className="px-2"><GalleryVertical className="h-4 w-4" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* Bulk toolbar */}
      {selectedIds.length > 0 && (
        <Card className="glass flex items-center justify-between p-3">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkPublish}><Send className="mr-1.5 h-3.5 w-3.5" />Publish</Button>
            <Button size="sm" variant="outline" onClick={handleBulkArchive}><Archive className="mr-1.5 h-3.5 w-3.5" />Archive</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
          </div>
        </Card>
      )}

      {/* Content list */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No content found"
          description="Try adjusting your filters, or create your first piece of content."
          action={<Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Content</Button>}
        />
      ) : view === 'table' ? (
        <Card className="glass overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selectedIds.length === items.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                  <TableCell className="max-w-[280px]">
                    <Link href={`/dashboard/content/${item.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="h-9 w-16 shrink-0 overflow-hidden rounded bg-muted">
                        {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Video className="h-4 w-4 text-muted-foreground" /></div>}
                      </div>
                      <span className="truncate text-sm font-medium">{item.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.channel_name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{categories.find((c) => c.id === item.category_id)?.name || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[item.status]}>{item.status}</Badge></TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{item.visibility}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.author || '—'}</TableCell>
                  <TableCell className="text-right">
                    <RowActions item={item} onEdit={openEdit} onDuplicate={handleDuplicate} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} categories={categories} selected={selectedIds.includes(item.id)} onToggle={() => toggleSelect(item.id)} onEdit={openEdit} onDuplicate={handleDuplicate} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ContentRow key={item.id} item={item} categories={categories} selected={selectedIds.includes(item.id)} onToggle={() => toggleSelect(item.id)} onEdit={openEdit} onDuplicate={handleDuplicate} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Content' : 'Create Content'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Content title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe this content..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ContentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Playlist</Label>
                <Select value={form.playlist_id || 'none'} onValueChange={(v) => setForm({ ...form, playlist_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as ContentFormState['visibility'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Channel</Label>
                <Input value={form.channel_name} onChange={(e) => setForm({ ...form, channel_name: e.target.value })} placeholder="Channel name" />
              </div>
            </div>
            {form.status === 'scheduled' && (
              <div>
                <Label>Scheduled at</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ai, tutorial, shorts" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? 'Save Changes' : 'Create Content'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleteTarget?.title}&quot; will be moved to Trash. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Content?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{archiveTarget?.title}&quot; will be archived and hidden from active views.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedIds.length} items to Trash?</AlertDialogTitle>
            <AlertDialogDescription>These items will be moved to Trash. You can restore them later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row Actions Dropdown ─────────────────────────────────────────────────────

function RowActions({
  item, onEdit, onDuplicate, onArchive, onDelete,
}: {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onArchive: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/content/${item.id}`}>Preview</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(item)}><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onArchive(item)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Move to Trash</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function ContentCard({
  item, categories, selected, onToggle, onEdit, onDuplicate, onArchive, onDelete,
}: {
  item: ContentItem;
  categories: ContentCategory[];
  selected: boolean;
  onToggle: () => void;
  onEdit: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onArchive: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <Card className="glass glass-hover overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Video className="h-8 w-8 text-muted-foreground" /></div>
        )}
        <div className="absolute left-2 top-2"><Checkbox checked={selected} onCheckedChange={onToggle} className="bg-background/80" /></div>
        <div className="absolute right-2 top-2"><RowActions item={item} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} /></div>
      </div>
      <div className="p-3">
        <Link href={`/dashboard/content/${item.id}`} className="line-clamp-2 text-sm font-medium hover:underline">{item.title}</Link>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="secondary" className={STATUS_COLORS[item.status]}>{item.status}</Badge>
          <span className="text-xs text-muted-foreground">{categories.find((c) => c.id === item.category_id)?.name || '—'}</span>
        </div>
      </div>
    </Card>
  );
}

// ─── Card/List Row (compact) ───────────────────────────────────────────────────

function ContentRow({
  item, categories, selected, onToggle, onEdit, onDuplicate, onArchive, onDelete,
}: {
  item: ContentItem;
  categories: ContentCategory[];
  selected: boolean;
  onToggle: () => void;
  onEdit: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onArchive: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <Card className="glass glass-hover flex items-center gap-4 p-3">
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Video className="h-5 w-5 text-muted-foreground" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/content/${item.id}`} className="truncate text-sm font-medium hover:underline">{item.title}</Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.description || 'No description'}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{categories.find((c) => c.id === item.category_id)?.name || 'Uncategorized'}</span>
          <span>·</span>
          <span>{new Date(item.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
      <Badge variant="secondary" className={STATUS_COLORS[item.status]}>{item.status}</Badge>
      <RowActions item={item} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} />
    </Card>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <ContentPageInner />
    </Suspense>
  );
}
