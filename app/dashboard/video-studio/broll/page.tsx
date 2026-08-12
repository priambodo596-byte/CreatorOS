'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Upload,
  Search,
  Trash2,
  Download,
  Loader2,
  Play,
  Video,
  HardDrive,
  Calendar,
  Star,
  Sparkles,
  Tag,
  Eye,
  X,
  Layers,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  SearchInput,
  formatBytes,
} from '@/components/dashboard/shared';
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
import { useToast } from '@/hooks/use-toast';
import { fetchAssets, uploadAsset, deleteAsset, type AssetItem } from '@/lib/video-tools';

type SortBy = 'newest' | 'oldest' | 'largest' | 'smallest';
type Category = 'All' | 'Nature' | 'City' | 'Technology' | 'People' | 'Abstract' | 'Business' | 'Food' | 'Travel';

const CATEGORIES: Category[] = [
  'All',
  'Nature',
  'City',
  'Technology',
  'People',
  'Abstract',
  'Business',
  'Food',
  'Travel',
];

// AI recommendation presets — categories the engine suggests for common video types.
const AI_RECOMMENDATIONS: { category: Category; reason: string; gradient: string }[] = [
  { category: 'Nature', reason: 'Great for vlogs & travel intros', gradient: 'from-emerald-500/20 to-teal-500/10' },
  { category: 'City', reason: 'Perfect for lifestyle & urban content', gradient: 'from-sky-500/20 to-indigo-500/10' },
  { category: 'Technology', reason: 'Ideal for tech reviews & tutorials', gradient: 'from-violet-500/20 to-fuchsia-500/10' },
  { category: 'Business', reason: 'Suits corporate & explainer videos', gradient: 'from-amber-500/20 to-orange-500/10' },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getTags(asset: AssetItem): string[] {
  const tags = asset.metadata?.tags;
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string');
  }
  return [];
}

function getCategory(asset: AssetItem): string {
  const cat = asset.metadata?.category;
  return typeof cat === 'string' ? cat : 'Abstract';
}

export default function BRollPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ─── Load assets ───────────────────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssets('video');
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load B-roll assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // ─── Favorites (persisted locally) ──────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('broll-favorites');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('broll-favorites', JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ─── Filtering & sorting ──────────────────────────────────────────────────
  const filteredAssets = assets
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .filter((a) => category === 'All' || getCategory(a) === category)
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'largest':
          return b.size - a.size;
        case 'smallest':
          return a.size - b.size;
      }
    });

  // ─── Upload (file picker + drag & drop) ──────────────────────────────────────
  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      setUploading(true);
      let success = 0;
      try {
        for (const file of files) {
          if (!file.type.startsWith('video/')) {
            toast({
              title: 'Invalid file type',
              description: file.name,
              variant: 'destructive',
            });
            continue;
          }
          await uploadAsset(file, 'video');
          success++;
        }
        if (success > 0) {
          toast({
            title: 'Upload complete',
            description: `${success} file${success > 1 ? 's' : ''} uploaded`,
          });
          await loadAssets();
        }
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [loadAssets, toast],
  );

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ─── Asset actions ──────────────────────────────────────────────────────────
  const handleDelete = async (asset: AssetItem) => {
    try {
      await deleteAsset(asset.id, asset.metadata?.storage_path as string | undefined);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast({ title: 'Asset deleted' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (asset: AssetItem) => {
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = asset.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const applyRecommendation = (cat: Category) => {
    setCategory(cat);
    setSearch('');
    toast({
      title: `Showing ${cat} B-roll`,
      description: 'Filtered your library for this recommendation.',
    });
  };

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const totalSize = assets.reduce((sum, a) => sum + a.size, 0);
  const favCount = favorites.size;

  return (
    <div
      className="space-y-6"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      <PageHeader
        title="B-Roll Library"
        description="Browse, upload, and manage your video B-roll assets"
        actions={
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </>
            )}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {/* AI Recommendations */}
      <Card className="glass overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Recommended B-Roll for your videos
          </h2>
          <Badge variant="secondary" className="ml-auto">
            AI
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {AI_RECOMMENDATIONS.map((rec, i) => (
            <motion.div
              key={rec.category}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div
                className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br ${rec.gradient} p-4`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold">{rec.category}</span>
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{rec.reason}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 h-7 w-full text-xs"
                  onClick={() => applyRecommendation(rec.category)}
                >
                  Use
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search B-roll assets..." />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="largest">Largest first</SelectItem>
              <SelectItem value="smallest">Smallest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? 'default' : 'outline'}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      {!loading && !error && assets.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" />
            {assets.length} asset{assets.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            {formatBytes(totalSize)}
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" />
            {favCount} favorite{favCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {filteredAssets.length} shown
          </span>
        </div>
      )}

      {/* Drag overlay hint */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 px-12 py-10"
            >
              <Upload className="h-10 w-10 text-primary" />
              <p className="font-display text-lg font-semibold">Drop videos to upload</p>
              <p className="text-sm text-muted-foreground">Release to add them to your B-roll library</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <Card className="glass p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading B-roll assets...</span>
          </div>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={loadAssets} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={Film}
          title={search || category !== 'All' ? 'No matching assets' : 'No B-roll assets yet'}
          description={
            search || category !== 'All'
              ? 'Try a different search term or category.'
              : 'Upload video files to build your B-roll library.'
          }
          action={
            !search && category === 'All' ? (
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First Video
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <Card
                className={`glass glass-hover group relative overflow-hidden p-0 transition-all ${
                  dragOverId === asset.id ? 'ring-2 ring-primary' : ''
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverId(asset.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  toast({
                    title: 'Drag into timeline',
                    description: `${asset.name} — open the timeline to drop this clip.`,
                  });
                }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  <video
                    src={asset.url}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => {
                      const v = e.currentTarget;
                      v.currentTime = 0;
                      void v.play().catch(() => {});
                    }}
                    onMouseLeave={(e) => {
                      const v = e.currentTarget;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                  {/* Duration badge */}
                  {asset.duration ? (
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(asset.duration)}
                    </span>
                  ) : null}
                  {/* Favorite toggle */}
                  <button
                    type="button"
                    aria-label={favorites.has(asset.id) ? 'Remove favorite' : 'Add favorite'}
                    onClick={() => toggleFavorite(asset.id)}
                    className="absolute left-2 top-2 rounded-full bg-black/40 p-1 backdrop-blur-sm transition-colors hover:bg-black/60"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        favorites.has(asset.id)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-white/80'
                      }`}
                    />
                  </button>
                  {/* Hover overlay: preview + drag hint */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      onClick={() => setPreviewAsset(asset)}
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                    <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                      <Layers className="h-3 w-3" />
                      Drag to timeline
                    </span>
                  </div>
                  {/* Quick actions */}
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 glass"
                      title="Preview"
                      onClick={() => setPreviewAsset(asset)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 glass"
                      title="Download"
                      onClick={() => handleDownload(asset)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => handleDelete(asset)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="truncate text-sm font-medium" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(asset.size)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(asset.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {/* Tags */}
                  {getTags(asset).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {getTags(asset).slice(0, 4).map((t) => (
                        <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {getTags(asset).length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{getTags(asset).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl"
            >
              <Card className="glass overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                  <h3 className="truncate font-display text-sm font-semibold" title={previewAsset.name}>
                    {previewAsset.name}
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setPreviewAsset(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <video
                  src={previewAsset.url}
                  className="aspect-video w-full bg-black"
                  controls
                  autoPlay
                />
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{formatBytes(previewAsset.size)}</Badge>
                    {previewAsset.duration ? (
                      <Badge variant="secondary">{formatDuration(previewAsset.duration)}</Badge>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(previewAsset.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFavorite(previewAsset.id)}
                    >
                      <Star
                        className={`mr-2 h-3.5 w-3.5 ${
                          favorites.has(previewAsset.id)
                            ? 'fill-amber-400 text-amber-400'
                            : ''
                        }`}
                      />
                      {favorites.has(previewAsset.id) ? 'Favorited' : 'Favorite'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(previewAsset)}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const toDelete = previewAsset;
                        setPreviewAsset(null);
                        handleDelete(toDelete);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
                {getTags(previewAsset).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 px-4 py-3">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    {getTags(previewAsset).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
