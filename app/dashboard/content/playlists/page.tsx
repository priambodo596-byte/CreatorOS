"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  ListMusic,
  Trash2,
  Loader2,
  Search,
  Youtube,
  RefreshCw,
  Import,
  Film,
  Calendar,
  CheckCircle2,
  Music2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-supabase-query";
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/shared";
import {
  listPlaylists,
  createPlaylist,
  deletePlaylist,
  type ContentPlaylist,
} from "@/lib/content";
import {
  getSyncedPlaylists,
  triggerFullSync,
  getConnection,
  type SyncedPlaylist,
} from "@/lib/youtube";
import { useAuth } from "@/lib/auth-context";

// ─── YouTube Playlist with sync info ─────────────────────────────────────────
interface ExtendedSyncedPlaylist extends SyncedPlaylist {
  isImported?: boolean;
  expanded?: boolean;
}

export default function PlaylistsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Local playlists
  const [localPlaylists, setLocalPlaylists] = useState<ContentPlaylist[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // YouTube playlists
  const [ytPlaylists, setYtPlaylists] = useState<ExtendedSyncedPlaylist[]>([]);
  const [loadingYt, setLoadingYt] = useState(true);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytConnected, setYtConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Search & filter
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ContentPlaylist | null>(
    null
  );

  // Import dialog
  const [importTarget, setImportTarget] =
    useState<ExtendedSyncedPlaylist | null>(null);
  const [importing, setImporting] = useState(false);

  // Expanded playlists
  const [expandedYtPlaylist, setExpandedYtPlaylist] = useState<string | null>(
    null
  );

  // ─── Load Data ──────────────────────────────────────────────────────────────

  const loadLocal = useCallback(async () => {
    setLoadingLocal(true);
    setLocalError(null);
    try {
      setLocalPlaylists(await listPlaylists());
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to load playlists"
      );
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const loadYt = useCallback(async () => {
    if (!ytConnected) return;
    setLoadingYt(true);
    setYtError(null);
    try {
      const ytData = await getSyncedPlaylists();
      const localNames = new Set(
        localPlaylists.map((p) => p.name.toLowerCase())
      );
      const enriched = ytData.map((p) => ({
        ...p,
        isImported: localNames.has(p.title?.toLowerCase() || ""),
      }));
      setYtPlaylists(enriched);
    } catch (err) {
      setYtError(
        err instanceof Error ? err.message : "Failed to load YouTube playlists"
      );
    } finally {
      setLoadingYt(false);
    }
  }, [localPlaylists, ytConnected]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await loadLocal();
      const connection = await getConnection();
      setYtConnected(!!connection);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load YT playlists when connection state is determined
  useEffect(() => {
    if (ytConnected) loadYt();
  }, [ytConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Create ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createPlaylist(newName.trim(), newDescription || undefined);
      toast({ title: "Playlist created" });
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      loadLocal();
    } catch {
      toast({ title: "Failed to create playlist", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deletePlaylist(deleteTarget.id);
      toast({ title: "Playlist deleted" });
      setDeleteTarget(null);
      loadLocal();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  // ─── Sync YouTube ──────────────────────────────────────────────────────────

  async function handleSync() {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await triggerFullSync(user.id, {
        syncComments: false,
        syncAnalytics: false,
      });
      toast({
        title: "Sync completed",
        description: `${result.stats.playlistsSynced} playlists synced from YouTube.`,
      });
      await loadYt();
    } catch (err) {
      toast({
        title: "Sync failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not sync YouTube playlists",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  // ─── Import YouTube Playlist to Local ──────────────────────────────────────

  async function handleImport() {
    if (!importTarget) return;
    setImporting(true);
    try {
      await createPlaylist(
        importTarget.title || "Untitled YouTube Playlist",
        importTarget.description ||
          `Imported from YouTube playlist (${importTarget.item_count} items)`
      );
      toast({
        title: "Imported successfully",
        description: `"${importTarget.title}" is now available as a local playlist.`,
      });
      setImportTarget(null);
      loadLocal();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  // ─── Toggle expand ─────────────────────────────────────────────────────────

  function toggleExpand(playlistId: string) {
    setExpandedYtPlaylist((prev) => (prev === playlistId ? null : playlistId));
  }

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filteredLocal = localPlaylists.filter(
    (p) =>
      !debouncedSearch ||
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const filteredYt = ytPlaylists.filter(
    (p) =>
      !debouncedSearch ||
      p.title?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Playlists"
        description="Manage local playlists and sync playlists from your YouTube channel."
        actions={
          <div className="flex gap-2">
            {ytConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync YouTube
              </Button>
            )}
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-accent text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Playlist
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search playlists..."
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="local" className="space-y-6">
        <TabsList className="glass">
          <TabsTrigger value="local" className="flex items-center gap-2">
            <ListMusic className="h-4 w-4" />
            Local Playlists
            {localPlaylists.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {localPlaylists.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="youtube" className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-destructive" />
            YouTube Playlists
            {ytPlaylists.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {ytPlaylists.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── LOCAL PLAYLISTS ──────────────────────────────────────────────── */}
        <TabsContent value="local">
          {loadingLocal ? (
            <LoadingState message="Loading playlists..." />
          ) : localError ? (
            <ErrorState message={localError} onRetry={loadLocal} />
          ) : filteredLocal.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title={
                debouncedSearch
                  ? "No playlists match your search"
                  : "No playlists yet"
              }
              description="Create a playlist to group related content together."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Playlist
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLocal.map((pl) => (
                <Card key={pl.id} className="glass glass-hover p-4 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                        <Music2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pl.name}</p>
                        {pl.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {pl.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setDeleteTarget(pl)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Created {new Date(pl.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── YOUTUBE PLAYLISTS ──────────────────────────────────────────── */}
        <TabsContent value="youtube">
          {!ytConnected ? (
            <Card className="glass p-6">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Youtube className="mb-3 h-10 w-10 text-destructive" />
                <h3 className="font-display text-lg font-semibold">
                  Not Connected to YouTube
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Connect your YouTube account to sync your playlists and import
                  them for content management.
                </p>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/dashboard/settings?tab=integrations">
                      <Youtube className="mr-2 h-4 w-4" />
                      Connect YouTube
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ) : loadingYt ? (
            <LoadingState message="Loading YouTube playlists..." />
          ) : ytError ? (
            <ErrorState message={ytError} onRetry={loadYt} />
          ) : filteredYt.length === 0 ? (
            <EmptyState
              icon={Youtube}
              title={
                debouncedSearch
                  ? "No YouTube playlists match your search"
                  : "No YouTube playlists found"
              }
              description="Try syncing your YouTube channel to pull in playlists."
              action={
                <Button size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredYt.map((pl) => (
                <Card
                  key={pl.playlist_id}
                  className="glass glass-hover overflow-hidden"
                >
                  <div className="flex items-start gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {pl.thumbnail_url ? (
                        <img
                          src={pl.thumbnail_url}
                          alt={pl.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ListMusic className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-destructive" />
                            <p className="text-sm font-medium">
                              {pl.title || "Untitled Playlist"}
                            </p>
                          </div>
                          {pl.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {pl.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(pl.playlist_id)}
                          className="shrink-0 text-xs"
                        >
                          {expandedYtPlaylist === pl.playlist_id
                            ? "Hide"
                            : "Show"}{" "}
                          Videos
                        </Button>
                      </div>

                      {/* Stats */}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Film className="h-3 w-3" />
                          {pl.item_count || 0} videos
                        </Badge>
                        {pl.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(pl.published_at).toLocaleDateString()}
                          </span>
                        )}
                        {pl.isImported && (
                          <Badge
                            variant="outline"
                            className="bg-success/10 text-success border-success/30"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Imported
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        {!pl.isImported ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => setImportTarget(pl)}
                          >
                            <Import className="mr-1 h-3 w-3" />
                            Import to Local
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Already Imported
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded section - shows video count info */}
                  {expandedYtPlaylist === pl.playlist_id && (
                    <div className="border-t border-border/30 px-4 py-3">
                      <div className="rounded-lg glass p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          This YouTube playlist has{" "}
                          <strong>{pl.item_count || 0}</strong> videos.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pl.isImported
                            ? "It has been imported as a local playlist. Assign content items to it from the content editor."
                            : "Import it as a local playlist to assign your content items to it."}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. AI Series"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; will be removed. Content in it will remain,
              but will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Import Confirmation ───────────────────────────────────────────── */}
      <AlertDialog
        open={!!importTarget}
        onOpenChange={(o) => !o && setImportTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import YouTube Playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{importTarget?.title}&quot; ({importTarget?.item_count || 0} videos)
              will be imported as a local playlist. You can then assign content
              items to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importing}>
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Import className="mr-2 h-4 w-4" />
              )}
              Import Playlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
