'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  HardDrive,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Trash2,
  Download,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState, StatCard } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { fetchAssets, deleteAsset, insertActivityLog, type AssetRow } from '@/lib/automation';

const CATEGORIES = [
  { key: 'videos', label: 'Videos', icon: Video, color: 'text-destructive', bg: 'bg-destructive/10' },
  { key: 'images', label: 'Images', icon: ImageIcon, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'thumbnails', label: 'Thumbnails', icon: ImageIcon, color: 'text-accent', bg: 'bg-accent/10' },
  { key: 'audio', label: 'Audio', icon: Music, color: 'text-info', bg: 'bg-info/10' },
  { key: 'voice_overs', label: 'Voice Overs', icon: Music, color: 'text-success', bg: 'bg-success/10' },
  { key: 'subtitles', label: 'Subtitles', icon: FileText, color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'documents', label: 'Documents', icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'brand_assets', label: 'Brand Assets', icon: ImageIcon, color: 'text-accent', bg: 'bg-accent/10' },
  { key: 'ai_generated', label: 'AI Generated', icon: ImageIcon, color: 'text-success', bg: 'bg-success/10' },
  { key: 'exports', label: 'Exports', icon: Download, color: 'text-warning', bg: 'bg-warning/10' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function StoragePage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAssets();
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
      await deleteAsset(asset.id, false);
      await insertActivityLog({
        module: 'assets',
        action: 'soft_delete',
        entity_type: 'asset',
        entity_id: asset.id,
        details: { name: asset.name },
        level: 'warning',
      });
      toast({ title: 'Asset moved to trash' });
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

  const totalBytes = assets.reduce((s, a) => s + (a.size_bytes ?? 0), 0);
  const fileCount = assets.length;
  const largestFile = assets.reduce((max, a) => (a.size_bytes > (max?.size_bytes ?? 0) ? a : max), null as AssetRow | null);
  const avgSize = fileCount > 0 ? totalBytes / fileCount : 0;

  const byCategory = CATEGORIES.map((cat) => {
    const items = assets.filter((a) => a.category === cat.key);
    const size = items.reduce((s, a) => s + (a.size_bytes ?? 0), 0);
    return { ...cat, count: items.length, size };
  }).filter((c) => c.count > 0);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Storage"
        description="Monitor Supabase Storage usage, capacity, and file statistics."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? (
        <LoadingState message="Loading storage data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Storage" value={formatBytes(totalBytes)} icon={HardDrive} color="text-primary" bg="bg-primary/10" delay={0} />
            <StatCard label="File Count" value={fileCount} icon={Database} color="text-accent" bg="bg-accent/10" delay={0.1} />
            <StatCard label="Largest File" value={largestFile ? formatBytes(largestFile.size_bytes) : '—'} icon={FileText} color="text-warning" bg="bg-warning/10" delay={0.2} />
            <StatCard label="Avg File Size" value={formatBytes(avgSize)} icon={HardDrive} color="text-success" bg="bg-success/10" delay={0.3} />
          </div>

          {/* Usage bar */}
          <Card className="glass p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">Storage Usage</h3>
              <span className="text-sm text-muted-foreground">{formatBytes(totalBytes)} used</span>
            </div>
            <Progress value={Math.min(100, (totalBytes / (1024 * 1024 * 1024)) * 100)} className="h-3" />
            <p className="mt-2 text-xs text-muted-foreground">Assuming 1 GB total quota</p>
          </Card>

          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <Card className="glass p-5">
              <h3 className="mb-4 font-display text-sm font-semibold">By Category</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byCategory.map((cat, i) => {
                  const Icon = cat.icon;
                  return (
                    <motion.div
                      key={cat.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 rounded-lg border border-border/30 p-3"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cat.bg}`}>
                        <Icon className={`h-5 w-5 ${cat.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.count} files · {formatBytes(cat.size)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* File list */}
          <div className="space-y-4">
            <h3 className="font-display text-sm font-semibold">All Files</h3>
            {assets.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No files stored"
                description="Upload assets from the Media Library or other modules to see them here."
              />
            ) : (
              <Card className="glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-xs text-muted-foreground">
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Category</th>
                        <th className="p-3 font-medium">Size</th>
                        <th className="p-3 font-medium">Created</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset, i) => (
                        <motion.tr
                          key={asset.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b border-border/20 last:border-0"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {asset.is_favorite && <span className="text-xs text-warning">★</span>}
                              <span className="text-sm font-medium">{asset.name}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs">{asset.category}</Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{formatBytes(asset.size_bytes)}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(asset.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                <a href={asset.url} download={asset.name}>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
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
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
