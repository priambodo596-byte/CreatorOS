'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Upload,
  Search,
  Trash2,
  Download,
  Star,
  Eye,
  Loader2,
  Plus,
  X,
  Tag,
  Grid3x3,
  Filter,
  FileImage,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState, SearchInput, formatBytes } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────
type AssetCategory = 'Backgrounds' | 'Logos' | 'Faces' | 'Icons' | 'Shapes' | 'Textures' | 'Overlays';

interface Asset {
  id: string;
  name: string;
  url: string;
  type: string;
  category: AssetCategory | string;
  size: number;
  mime_type: string;
  tags: string[];
  favorite: boolean;
  used_count: number;
  created_at: string;
  user_id: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES: { value: AssetCategory; label: string; icon: typeof ImageIcon }[] = [
  { value: 'Backgrounds', label: 'Backgrounds', icon: ImageIcon },
  { value: 'Logos', label: 'Logos', icon: Plus },
  { value: 'Faces', label: 'Faces', icon: Eye },
  { value: 'Icons', label: 'Icons', icon: Star },
  { value: 'Shapes', label: 'Shapes', icon: Filter },
  { value: 'Textures', label: 'Textures', icon: Grid3x3 },
  { value: 'Overlays', label: 'Overlays', icon: FileImage },
];

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Component ───────────────────────────────────────────────────────────────
export default function AssetLibraryPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'All'>('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagEditor, setShowTagEditor] = useState<string | null>(null);

  // ─── Load assets ──────────────────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data, error: fetchErr } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('type', 'image')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setAssets((data as Asset[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // ─── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const invalid = fileArray.filter(
      (f) => !ACCEPTED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE,
    );
    if (invalid.length > 0) {
      toast({
        title: 'Invalid files',
        description: `${invalid.length} file(s) rejected. Only PNG, JPG, SVG, WebP up to 10MB.`,
        variant: 'destructive',
      });
    }

    const valid = fileArray.filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE,
    );
    if (valid.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || 'anonymous';

      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        const ext = file.name.split('.').pop();
        const path = `${userId}/asset-library/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from('assets').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);

        // Infer category from filename or default to 'Overlays'
        const lowerName = file.name.toLowerCase();
        let category: string = 'Overlays';
        for (const cat of CATEGORIES) {
          if (lowerName.includes(cat.value.toLowerCase().slice(0, -1))) {
            category = cat.value;
            break;
          }
        }

        const record = {
          user_id: userId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: urlData.publicUrl,
          type: 'image',
          category,
          size: file.size,
          mime_type: file.type,
          tags: [],
          favorite: false,
          used_count: 0,
        };

        const { data: insertData, error: insertErr } = await supabase
          .from('assets')
          .insert(record)
          .select()
          .single();

        if (insertErr) throw insertErr;
        if (insertData) {
          setAssets((prev) => [insertData as Asset, ...prev]);
        }

        setUploadProgress(Math.round(((i + 1) / valid.length) * 100));
      }

      toast({
        title: 'Upload complete',
        description: `${valid.length} asset(s) uploaded successfully`,
      });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Drag and drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleDownload = async (asset: Asset) => {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = asset.mime_type.split('/')[1] || 'png';
      link.download = `${asset.name}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: asset.name });
    } catch {
      // Fallback: open in new tab
      window.open(asset.url, '_blank');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const asset = assets.find((a) => a.id === id);
      // Delete from storage if we can extract the path
      if (asset?.url) {
        const url = new URL(asset.url);
        const pathMatch = url.pathname.match(/\/assets\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('assets').remove([pathMatch[1]]);
        }
      }
      const { error: delErr } = await supabase.from('assets').delete().eq('id', id);
      if (delErr) throw delErr;
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      toast({ title: 'Asset deleted' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const toggleFavorite = async (asset: Asset) => {
    try {
      const { error: updErr } = await supabase
        .from('assets')
        .update({ favorite: !asset.favorite })
        .eq('id', asset.id);
      if (updErr) throw updErr;
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? { ...a, favorite: !a.favorite } : a)),
      );
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleAddTag = async (assetId: string, tag: string) => {
    const tagTrim = tag.trim().toLowerCase();
    if (!tagTrim) return;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    if (asset.tags.includes(tagTrim)) {
      setTagInput('');
      return;
    }
    const newTags = [...asset.tags, tagTrim];
    try {
      const { error: updErr } = await supabase.from('assets').update({ tags: newTags }).eq('id', assetId);
      if (updErr) throw updErr;
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, tags: newTags } : a)));
      setTagInput('');
    } catch (err) {
      toast({
        title: 'Failed to add tag',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTag = async (assetId: string, tag: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    const newTags = asset.tags.filter((t) => t !== tag);
    try {
      const { error: updErr } = await supabase.from('assets').update({ tags: newTags }).eq('id', assetId);
      if (updErr) throw updErr;
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, tags: newTags } : a)));
    } catch (err) {
      toast({
        title: 'Failed to remove tag',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleSetCategory = async (assetId: string, category: string) => {
    try {
      const { error: updErr } = await supabase.from('assets').update({ category }).eq('id', assetId);
      if (updErr) throw updErr;
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, category } : a)));
      toast({ title: 'Category updated', description: category });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // ─── Filtered assets ────────────────────────────────────────────────────────
  const filteredAssets = assets.filter((a) => {
    if (favoritesOnly && !a.favorite) return false;
    if (activeCategory !== 'All' && a.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Category counts
  const categoryCounts = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.value] = assets.filter((a) => a.category === cat.value).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Asset Library" description="Manage your thumbnail image assets" />
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading assets...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Asset Library" description="Manage your thumbnail image assets" />
        <ErrorState message={error} onRetry={loadAssets} />
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Asset Library"
        description="Upload and manage background images, logos, faces, icons, and overlays"
        actions={
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Assets
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      {/* Drag-and-drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition',
          dragOver
            ? 'border-primary bg-primary/10'
            : 'border-border/50 glass hover:border-primary/30 hover:bg-primary/5',
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading... {uploadProgress}%</p>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="font-display text-base font-semibold">
              Drag & drop images here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              PNG, JPG, SVG, WebP — up to 10MB each
            </p>
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('All')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              activeCategory === 'All'
                ? 'bg-primary text-white'
                : 'glass hover:bg-primary/10',
            )}
          >
            All ({assets.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                activeCategory === cat.value
                  ? 'bg-primary text-white'
                  : 'glass hover:bg-primary/10',
              )}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label} ({categoryCounts[cat.value] || 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              favoritesOnly ? 'bg-warning/20 text-warning' : 'glass hover:bg-warning/10',
            )}
          >
            <Star className={cn('h-3.5 w-3.5', favoritesOnly && 'fill-current')} />
            Favorites
          </button>
          <div className="w-48">
            <SearchInput value={search} onChange={setSearch} placeholder="Search assets..." />
          </div>
        </div>
      </div>

      {/* Assets grid */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={assets.length === 0 ? 'No assets yet' : 'No matching assets'}
          description={
            assets.length === 0
              ? 'Upload images to build your asset library for thumbnail creation.'
              : 'Try adjusting your filters or search query.'
          }
          action={
            assets.length === 0 ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-r from-primary to-accent text-white"
              >
                <Upload className="mr-2 h-4 w-4" /> Upload First Asset
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredAssets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
            >
              <Card className="glass glass-hover group overflow-hidden">
                {/* Thumbnail */}
                <div
                  className="relative aspect-video cursor-pointer overflow-hidden bg-muted/30"
                  onClick={() => setPreviewAsset(asset)}
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAsset(asset);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(asset);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className={cn('h-8 w-8 p-0', asset.favorite && 'text-warning')}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(asset);
                      }}
                    >
                      <Star className={cn('h-4 w-4', asset.favorite && 'fill-current')} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(asset.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Favorite badge */}
                  {asset.favorite && (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-warning/90 p-1">
                      <Star className="h-3 w-3 fill-current text-white" />
                    </div>
                  )}
                  {/* Used count badge */}
                  {asset.used_count > 0 && (
                    <div className="absolute left-1.5 top-1.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-xs font-bold text-white">
                      {asset.used_count}× used
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="truncate text-sm font-medium" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{asset.category}</Badge>
                    <span>{formatBytes(asset.size)}</span>
                  </div>

                  {/* Tags */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-0.5 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{asset.tags.length - 3}</span>
                    )}
                  </div>

                  {/* Tag editor toggle */}
                  <button
                    onClick={() => setShowTagEditor(showTagEditor === asset.id ? null : asset.id)}
                    className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add tag
                  </button>

                  {showTagEditor === asset.id && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-1">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(asset.id, tagInput);
                            }
                          }}
                          placeholder="Tag name..."
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleAddTag(asset.id, tagInput)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {asset.tags.map((tag) => (
                            <span
                              key={tag}
                              className="flex items-center gap-0.5 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs"
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(asset.id, tag)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
                {/* Image */}
                <div className="relative flex max-h-[60vh] items-center justify-center bg-black/30">
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.name}
                    className="max-h-[60vh] w-full object-contain"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute right-2 top-2 h-8 w-8 p-0"
                    onClick={() => setPreviewAsset(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold">{previewAsset.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(previewAsset.size)} · {previewAsset.mime_type}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFavorite(previewAsset)}
                      >
                        <Star className={cn('mr-1.5 h-3.5 w-3.5', previewAsset.favorite && 'fill-current text-warning')} />
                        {previewAsset.favorite ? 'Favorited' : 'Favorite'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(previewAsset)}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </div>

                  {/* Category selector */}
                  <div className="mb-3">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => {
                            handleSetCategory(previewAsset.id, cat.value);
                            setPreviewAsset({ ...previewAsset, category: cat.value });
                          }}
                          className={cn(
                            'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition',
                            previewAsset.category === cat.value
                              ? 'bg-primary text-white'
                              : 'glass hover:bg-primary/10',
                          )}
                        >
                          {previewAsset.category === cat.value && <CheckCircle2 className="h-3 w-3" />}
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="mb-3">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {previewAsset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                          <button
                            onClick={() => {
                              handleRemoveTag(previewAsset.id, tag);
                              setPreviewAsset({ ...previewAsset, tags: previewAsset.tags.filter((t) => t !== tag) });
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {previewAsset.tags.length === 0 && (
                        <p className="text-xs text-muted-foreground">No tags yet</p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(previewAsset.id, tagInput);
                            setPreviewAsset({ ...previewAsset, tags: [...previewAsset.tags, tagInput.trim().toLowerCase()] });
                          }
                        }}
                        placeholder="Add a tag..."
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          handleAddTag(previewAsset.id, tagInput);
                          setPreviewAsset({ ...previewAsset, tags: [...previewAsset.tags, tagInput.trim().toLowerCase()] });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 rounded-lg glass p-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Used in thumbnails: </span>
                      <span className="font-bold">{previewAsset.used_count}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Uploaded: </span>
                      <span className="font-medium">
                        {new Date(previewAsset.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="mt-4 flex justify-end gap-2">
                    {deleteConfirm === previewAsset.id ? (
                      <>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            handleDelete(previewAsset.id);
                            setPreviewAsset(null);
                          }}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" /> Confirm Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm(previewAsset.id)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Asset
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation (grid-level) */}
      <AnimatePresence>
        {deleteConfirm && !previewAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="glass p-6">
                <h3 className="mb-2 font-display text-lg font-bold">Delete this asset?</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  This action cannot be undone. The image will be permanently removed from your library and storage.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
