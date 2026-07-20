'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Upload,
  Trash2,
  Search,
  Filter,
  Download,
  HardDrive,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
  X,
  File,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SkeletonGrid,
  SearchInput,
  StatCard,
  formatBytes,
} from '@/components/dashboard/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  user_id: string;
  name: string;
  type: string;
  url: string;
  size_bytes: number;
  created_at: string;
}

type AssetType = 'image' | 'video' | 'audio' | 'document' | 'other';
type SortOption = 'date_desc' | 'date_asc' | 'size_desc' | 'size_asc' | 'name_asc' | 'name_desc';

const STORAGE_BUCKET = 'assets';
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB display limit

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAssetType(fileName: string, mimeType: string): AssetType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(ext)) {
    return 'video';
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
    return 'audio';
  }
  if (
    mimeType.startsWith('application/pdf') ||
    mimeType.startsWith('application/msword') ||
    mimeType.startsWith('application/vnd.openxmlformats-officedocument') ||
    mimeType.startsWith('text/') ||
    ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md', 'rtf'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

const TYPE_META: Record<AssetType, { label: string; icon: typeof ImageIcon; color: string; bg: string }> = {
  image: { label: 'Images', icon: ImageIcon, color: 'text-primary', bg: 'bg-primary/10' },
  video: { label: 'Videos', icon: Video, color: 'text-accent', bg: 'bg-accent/10' },
  audio: { label: 'Audio', icon: Music, color: 'text-info', bg: 'bg-info/10' },
  document: { label: 'Documents', icon: FileText, color: 'text-success', bg: 'bg-success/10' },
  other: { label: 'Other', icon: File, color: 'text-muted-foreground', bg: 'bg-muted/10' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Fetch Assets ──────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAssets((data ?? []) as Asset[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load assets';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // ─── Upload ─────────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to upload files');

      let completed = 0;

      for (const file of files) {
        const assetType = getAssetType(file.name, file.type);
        // Unique path: userId/timestamp-filename
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user.id}/${Date.now()}-${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);

        // Insert asset record
        const { error: insertError } = await supabase.from('assets').insert({
          user_id: user.id,
          name: file.name,
          type: assetType,
          url: urlData.publicUrl,
          size_bytes: file.size,
        });

        if (insertError) throw insertError;

        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));
      }

      toast({
        title: 'Upload complete',
        description: `${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully.`,
      });

      await fetchAssets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({
        title: 'Upload failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      // Attempt to remove from storage (extract path from URL)
      try {
        const url = new URL(deleteTarget.url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from(STORAGE_BUCKET).remove([pathMatch[1]]);
        }
      } catch {
        // URL parsing failed — still try to delete the DB record
      }

      const { error: deleteError } = await supabase
        .from('assets')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteError) throw deleteError;

      setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast({
        title: 'Asset deleted',
        description: `"${deleteTarget.name}" was removed.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete asset';
      toast({
        title: 'Delete failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ─── Derived Data ──────────────────────────────────────────────────────────

  const filteredAssets = assets
    .filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'size_desc':
          return b.size_bytes - a.size_bytes;
        case 'size_asc':
          return a.size_bytes - b.size_bytes;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  const totalSize = assets.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);
  const storagePercent = Math.min((totalSize / STORAGE_LIMIT_BYTES) * 100, 100);

  const typeCounts = {
    image: assets.filter((a) => a.type === 'image').length,
    video: assets.filter((a) => a.type === 'video').length,
    audio: assets.filter((a) => a.type === 'audio').length,
    document: assets.filter((a) => a.type === 'document').length,
    other: assets.filter((a) => a.type === 'other').length,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Asset Manager"
        description="Upload, organize, and manage your media files and documents."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.md,.ppt,.pptx,.xls,.xlsx"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAssets}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-gradient-to-r from-primary to-accent text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </>
        }
      />

      {/* Upload Progress */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Uploading files...</p>
                  <Progress value={uploadProgress} className="mt-2" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{uploadProgress}%</span>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Usage */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Storage Usage</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(totalSize)} of {formatBytes(STORAGE_LIMIT_BYTES)} used
                </p>
              </div>
            </div>
            <Badge variant={storagePercent > 80 ? 'destructive' : 'secondary'}>
              {storagePercent.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={storagePercent} className="mt-4" />
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Images"
          value={typeCounts.image}
          icon={ImageIcon}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Videos"
          value={typeCounts.video}
          icon={Video}
          color="text-accent"
          bg="bg-accent/10"
          delay={0.1}
        />
        <StatCard
          label="Audio"
          value={typeCounts.audio}
          icon={Music}
          color="text-info"
          bg="bg-info/10"
          delay={0.2}
        />
        <StatCard
          label="Documents"
          value={typeCounts.document}
          icon={FileText}
          color="text-success"
          bg="bg-success/10"
          delay={0.3}
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search assets by name..."
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="size_desc">Largest First</SelectItem>
              <SelectItem value="size_asc">Smallest First</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter indicator */}
      {(searchQuery || typeFilter !== 'all') && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Showing {filteredAssets.length} of {assets.length} assets
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
            }}
            className="h-7 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAssets} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={assets.length === 0 ? Inbox : Search}
          title={assets.length === 0 ? 'No assets yet' : 'No matching assets'}
          description={
            assets.length === 0
              ? 'Upload images, videos, audio, or documents to get started.'
              : 'Try adjusting your search or filter criteria.'
          }
          action={
            assets.length === 0 ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-r from-primary to-accent text-white"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )
          }
        />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredAssets.map((asset, i) => {
              const meta = TYPE_META[asset.type as AssetType] ?? TYPE_META.other;
              const Icon = meta.icon;

              return (
                <motion.div
                  key={asset.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="glass glass-hover group overflow-hidden p-0">
                    {/* Thumbnail / Icon */}
                    <div className="relative flex h-36 items-center justify-center overflow-hidden bg-muted/20">
                      {asset.type === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${meta.bg}`}>
                          <Icon className={`h-8 w-8 ${meta.color}`} />
                        </div>
                      )}
                      {/* Type badge */}
                      <div className="absolute left-2 top-2">
                        <Badge variant="secondary" className="glass text-xs capitalize">
                          {asset.type}
                        </Badge>
                      </div>
                      {/* Actions */}
                      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-lg glass hover:bg-primary/20"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setDeleteTarget(asset)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg glass hover:bg-destructive/20"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="truncate text-sm font-medium" title={asset.name}>
                        {asset.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(asset.size_bytes ?? 0)}</span>
                        <span>{formatDate(asset.created_at)}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> from your storage
              and remove the asset record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
