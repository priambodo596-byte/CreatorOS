'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileOutput,
  Download,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Video,
  Image as ImageIcon,
  FileText,
  Music,
  Archive,
} from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState, StatCard } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fetchAssets, deleteAsset, deleteStorageFile, insertActivityLog, type AssetRow } from '@/lib/automation';

const EXPORT_CATEGORIES = ['all', 'videos', 'images', 'thumbnails', 'audio', 'voice_overs', 'subtitles', 'documents'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getIconForCategory(category: string) {
  switch (category) {
    case 'videos': return Video;
    case 'images':
    case 'thumbnails': return ImageIcon;
    case 'audio':
    case 'voice_overs': return Music;
    case 'documents':
    case 'subtitles': return FileText;
    default: return Archive;
  }
}

export default function ExportsPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAssets('exports');
      setAssets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (asset: AssetRow) => {
    setBusyId(asset.id);
    try {
      if (asset.storage_path) {
        await deleteStorageFile(asset.storage_path).catch(() => {});
      }
      await deleteAsset(asset.id, true);
      await insertActivityLog({
        module: 'assets',
        action: 'export_deleted',
        entity_type: 'asset',
        entity_id: asset.id,
        details: { name: asset.name },
        level: 'warning',
      });
      toast({ title: 'Export deleted permanently' });
      await load();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = category === 'all' ? assets : assets.filter((a) => a.category === category);
  const totalSize = assets.reduce((s, a) => s + (a.size_bytes ?? 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Exports"
        description="Central hub for all exported files stored in Supabase Storage."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingState message="Loading exports..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Exports" value={assets.length} icon={FileOutput} color="text-primary" bg="bg-primary/10" delay={0} />
            <StatCard label="Total Size" value={formatBytes(totalSize)} icon={Archive} color="text-accent" bg="bg-accent/10" delay={0.1} />
            <StatCard label="Videos" value={assets.filter((a) => a.category === 'videos').length} icon={Video} color="text-destructive" bg="bg-destructive/10" delay={0.2} />
            <StatCard label="Documents" value={assets.filter((a) => a.category === 'documents').length} icon={FileText} color="text-warning" bg="bg-warning/10" delay={0.3} />
          </div>

          {/* Filter */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPORT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c === 'all' ? 'All Categories' : c.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileOutput}
              title="No exports yet"
              description="Exported videos, thumbnails, subtitles, and documents will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((asset, i) => {
                const Icon = getIconForCategory(asset.category);
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="glass glass-hover overflow-hidden">
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">{asset.name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{asset.category}</Badge>
                            <span className="text-xs text-muted-foreground">{formatBytes(asset.size_bytes)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(asset.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 border-t border-border/20 p-3">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <a href={asset.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="mr-1 h-3.5 w-3.5" /> View
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={asset.url} download={asset.name}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(asset)}
                          disabled={busyId === asset.id}
                        >
                          {busyId === asset.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
