"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Table as TableIcon,
  LayoutGrid,
  GalleryVertical,
  MoreHorizontal,
  Copy,
  Trash2,
  Video,
  Send,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Archive,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-supabase-query";
import {
  PageHeader,
  EmptyState,
  ErrorState,
  SkeletonTable,
} from "@/components/dashboard/shared";
import {
  listContent,
  updateContent,
  deleteContent,
  duplicateContent,
  bulkDelete,
  bulkPublish,
  listCategories,
  type ContentItem,
  type ContentCategory,
} from "@/lib/content";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-warning/15 text-warning",
  scheduled: "bg-info/15 text-info",
  published: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 12;
type ViewMode = "table" | "grid" | "card";

export default function ArchivedContentPage() {
  const { toast } = useToast();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "created_at" | "updated_at" | "published_at" | "title"
  >("updated_at");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("table");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [publishTarget, setPublishTarget] = useState<ContentItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ContentItem | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContent({
        search: debouncedSearch || undefined,
        status: "archived",
        categoryId: categoryId !== "all" ? categoryId : undefined,
        sortBy,
        sortDir: "desc",
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load archived content"
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryId, sortBy, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.length === items.length ? [] : items.map((i) => i.id)
    );
  }

  async function handleRestore(id: string) {
    try {
      await updateContent(id, { status: "draft" });
      toast({ title: "Restored to Drafts" });
      setRestoreTarget(null);
      load();
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    }
  }

  async function handlePublish(id: string) {
    try {
      await updateContent(id, {
        status: "published",
        published_at: new Date().toISOString(),
      });
      toast({ title: "Published successfully" });
      setPublishTarget(null);
      load();
    } catch {
      toast({ title: "Publish failed", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteContent(deleteTarget.id);
      toast({ title: "Moved to trash" });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function handleDuplicate(item: ContentItem) {
    try {
      await duplicateContent(item.id);
      toast({ title: "Content duplicated" });
      load();
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    }
  }

  async function handleBulkRestore() {
    setBulkActionLoading(true);
    try {
      await Promise.all(
        selectedIds.map((id) => updateContent(id, { status: "draft" }))
      );
      toast({ title: `${selectedIds.length} items restored` });
      setSelectedIds([]);
      load();
    } catch {
      toast({ title: "Bulk restore failed", variant: "destructive" });
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkPublish() {
    setBulkActionLoading(true);
    try {
      await bulkPublish(selectedIds);
      toast({ title: `${selectedIds.length} items published` });
      setSelectedIds([]);
      load();
    } catch {
      toast({ title: "Bulk publish failed", variant: "destructive" });
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkDelete() {
    setBulkActionLoading(true);
    try {
      await bulkDelete(selectedIds);
      toast({ title: `${selectedIds.length} items moved to trash` });
      setSelectedIds([]);
      load();
    } catch {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    } finally {
      setBulkActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Archived"
        description="Content that has been archived and hidden from active views."
        actions={
          <Link href="/dashboard/content">
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-accent text-white"
            >
              <Plus className="mr-2 h-4 w-4" /> New Content
            </Button>
          </Link>
        }
      />

      {/* Status summary */}
      <div className="flex flex-wrap gap-3">
        <Card className="glass flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Archive className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total Archived</p>
          </div>
        </Card>
        <Card className="glass flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <RotateCcw className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {selectedIds.length > 0 ? selectedIds.length : 0}
            </p>
            <p className="text-xs text-muted-foreground">Selected</p>
          </div>
        </Card>
      </div>

      {/* Info banner */}
      {items.length > 0 && (
        <Card className="glass p-4 border-muted">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Archived items are hidden from active views. Restore them to
              Drafts to continue working, or Publish them directly.
            </p>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="glass p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search archived..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Last Updated</SelectItem>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-9">
                <TabsTrigger value="table" className="px-2">
                  <TableIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="grid" className="px-2">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="card" className="px-2">
                  <GalleryVertical className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* Bulk toolbar */}
      {selectedIds.length > 0 && (
        <Card className="glass flex items-center justify-between p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRestore}
              disabled={bulkActionLoading}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore to Drafts
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkPublish}
              disabled={bulkActionLoading}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
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
          icon={Archive}
          title="No archived content"
          description="Archived content will appear here. You can archive content from Draft, Scheduled, or Published pages."
          action={
            <Link href="/dashboard/content">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Browse Content
              </Button>
            </Link>
          }
        />
      ) : view === "table" ? (
        <Card className="glass overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === items.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <Link
                      href={`/dashboard/content/${item.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <div className="h-9 w-16 shrink-0 overflow-hidden rounded bg-muted">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Video className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="truncate text-sm font-medium">
                        {item.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {categories.find((c) => c.id === item.category_id)?.name ||
                      "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[item.status]}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <ArchivedRowActions
                      item={item}
                      onRestore={setRestoreTarget}
                      onPublish={setPublishTarget}
                      onDuplicate={handleDuplicate}
                      onDelete={setDeleteTarget}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ArchivedCard
              key={item.id}
              item={item}
              categories={categories}
              selected={selectedIds.includes(item.id)}
              onToggle={() => toggleSelect(item.id)}
              onRestore={setRestoreTarget}
              onPublish={setPublishTarget}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ArchivedRow
              key={item.id}
              item={item}
              categories={categories}
              selected={selectedIds.includes(item.id)}
              onToggle={() => toggleSelect(item.id)}
              onRestore={setRestoreTarget}
              onPublish={setPublishTarget}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Restore confirmation */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore to Drafts?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{restoreTarget?.title}&quot; will be moved back to Drafts where you
              can continue editing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && handleRestore(restoreTarget.id)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore to Drafts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish confirmation */}
      <AlertDialog
        open={!!publishTarget}
        onOpenChange={(o) => !o && setPublishTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Archived Content?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{publishTarget?.title}&quot; will be published immediately and made
              visible to your audience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishTarget && handlePublish(publishTarget.id)}
            >
              <Send className="mr-2 h-4 w-4" />
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; will be moved from Archived to Trash. You
              can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ArchivedRowActions({
  item,
  onRestore,
  onPublish,
  onDuplicate,
  onDelete,
}: {
  item: ContentItem;
  onRestore: (item: ContentItem) => void;
  onPublish: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/content/${item.id}`}>Preview</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRestore(item)}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Restore to Drafts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPublish(item)}>
          <Send className="mr-2 h-3.5 w-3.5" />
          Publish
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDuplicate(item)}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(item)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ArchivedCard({
  item,
  categories,
  selected,
  onToggle,
  onRestore,
  onPublish,
  onDuplicate,
  onDelete,
}: {
  item: ContentItem;
  categories: ContentCategory[];
  selected: boolean;
  onToggle: () => void;
  onRestore: (item: ContentItem) => void;
  onPublish: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <Card className="glass glass-hover overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
      <div className="relative aspect-video bg-muted">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            className="bg-background/80"
          />
        </div>
        <div className="absolute right-2 top-2">
          <ArchivedRowActions
            {...{ item, onRestore, onPublish, onDuplicate, onDelete }}
          />
        </div>
        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="glass-strong">
            <Archive className="mr-1 h-3 w-3" />
            Archived
          </Badge>
        </div>
      </div>
      <div className="p-3">
        <Link
          href={`/dashboard/content/${item.id}`}
          className="line-clamp-2 text-sm font-medium hover:underline"
        >
          {item.title}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="secondary" className={STATUS_COLORS[item.status]}>
            {item.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {categories.find((c) => c.id === item.category_id)?.name || "—"}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onRestore(item)}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Restore
          </Button>
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-8 text-xs"
            onClick={() => onPublish(item)}
          >
            <Send className="mr-1 h-3 w-3" />
            Publish
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ArchivedRow({
  item,
  categories,
  selected,
  onToggle,
  onRestore,
  onPublish,
  onDuplicate,
  onDelete,
}: {
  item: ContentItem;
  categories: ContentCategory[];
  selected: boolean;
  onToggle: () => void;
  onRestore: (item: ContentItem) => void;
  onPublish: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <Card className="glass glass-hover flex items-center gap-4 p-3 opacity-80 hover:opacity-100 transition-opacity">
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/content/${item.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {item.title}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Archived · Updated {new Date(item.updated_at).toLocaleDateString()}
        </p>
      </div>
      <Badge variant="secondary" className={STATUS_COLORS[item.status]}>
        {item.status}
      </Badge>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => onRestore(item)}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Restore
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-8 text-xs"
          onClick={() => onPublish(item)}
        >
          <Send className="mr-1 h-3 w-3" />
          Publish
        </Button>
        <ArchivedRowActions
          {...{ item, onRestore, onPublish, onDuplicate, onDelete }}
        />
      </div>
    </Card>
  );
}
