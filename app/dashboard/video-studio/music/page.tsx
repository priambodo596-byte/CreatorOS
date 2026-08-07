'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Upload,
  Search,
  Trash2,
  Download,
  Loader2,
  Play,
  Pause,
  HardDrive,
  Clock,
  Volume2,
  Repeat,
  Sparkles,
  AudioLines,
  Headphones,
  ArrowUp,
  ArrowDown,
  X,
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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fetchAssets, uploadAsset, deleteAsset, type AssetItem } from '@/lib/video-tools';
import { cn } from '@/lib/utils';

type SortBy = 'newest' | 'oldest' | 'largest' | 'smallest';

const MUSIC_CATEGORIES = [
  { id: 'all', label: 'All', icon: Music },
  { id: 'background', label: 'Background', icon: AudioLines },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'vlog', label: 'Vlog', icon: Video },
  { id: 'motivation', label: 'Motivation', icon: Flame },
  { id: 'corporate', label: 'Corporate', icon: Briefcase },
  { id: 'technology', label: 'Technology', icon: Cpu },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'podcast', label: 'Podcast', icon: Mic },
  { id: 'happy', label: 'Happy', icon: Smile },
  { id: 'sad', label: 'Sad', icon: Frown },
  { id: 'epic', label: 'Epic', icon: Zap },
];

const AI_RECOMMENDATIONS = [
  { title: 'Upbeat Corporate', category: 'corporate', matchScore: 92, reason: 'Matches your recent business-focused content' },
  { title: 'Epic Cinematic Build', category: 'cinematic', matchScore: 87, reason: 'High retention pattern detected in your top videos' },
  { title: 'Chill Vlog Background', category: 'vlog', matchScore: 84, reason: 'Fits your casual storytelling style' },
];

import { Film, Video, Flame, Briefcase, Cpu, Gamepad2, Mic, Smile, Frown, Zap } from 'lucide-react';

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getCategory(asset: AssetItem): string {
  const meta = asset.metadata as Record<string, unknown> | undefined;
  const cat = (meta?.category as string) || (meta?.genre as string) || 'background';
  return cat.toLowerCase();
}

export default function MusicPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [loopIds, setLoopIds] = useState<Set<string>>(new Set());
  const [fadeInIds, setFadeInIds] = useState<Set<string>>(new Set());
  const [fadeOutIds, setFadeOutIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssets('audio');
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load music assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const filteredAssets = assets
    .filter((a) => activeCategory === 'all' || getCategory(a) === activeCategory)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'largest': return b.size - a.size;
        case 'smallest': return a.size - b.size;
      }
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('audio/')) {
          toast({ title: 'Invalid file type', description: file.name, variant: 'destructive' });
          continue;
        }
        await uploadAsset(file, 'audio');
      }
      toast({ title: 'Upload complete', description: `${files.length} file(s) uploaded` });
      await loadAssets();
    } catch (err) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const togglePlay = (asset: AssetItem) => {
    if (playingId === asset.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      setProgress(0);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const el = new Audio(asset.url);
    el.volume = volume / 100;
    el.loop = loopIds.has(asset.id);
    el.ontimeupdate = () => {
      const pct = (el.currentTime / (el.duration || 1)) * 100;
      setProgress(pct);
    };
    el.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    el.play();
    audioRef.current = el;
    setPlayingId(asset.id);
  };

  const handleVolumeChange = (v: number[]) => {
    setVolume(v[0]);
    if (audioRef.current) audioRef.current.volume = v[0] / 100;
  };

  const toggleLoop = (id: string) => {
    setLoopIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (playingId === id && audioRef.current) audioRef.current.loop = !loopIds.has(id);
  };

  const toggleFadeIn = (id: string) => {
    setFadeInIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFadeOut = (id: string) => {
    setFadeOutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (asset: AssetItem) => {
    if (playingId === asset.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    try {
      await deleteAsset(asset.id, asset.metadata?.storage_path as string | undefined);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast({ title: 'Asset deleted' });
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDownload = (asset: AssetItem) => {
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = asset.name;
    a.target = '_blank';
    a.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const input = fileInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      Array.from(files).forEach((f) => dt.items.add(f));
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Music Library"
        description="Browse, upload, and preview your audio assets with AI-powered recommendations"
        actions={
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>) : (<><Upload className="mr-2 h-4 w-4" />Upload Audio</>)}
          </Button>
        }
      />

      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleUpload} />

      {/* AI Recommendations */}
      <Card className="glass p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">AI Music Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {AI_RECOMMENDATIONS.map((rec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl glass p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                    <Headphones className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="text-xs text-muted-foreground">{rec.category}</p>
                  </div>
                </div>
                <Badge className="bg-success/15 text-success">{rec.matchScore}%</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rec.reason}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => { setActiveCategory(rec.category); toast({ title: `Filtering by ${rec.category}` }); }}
              >
                Browse {rec.category}
              </Button>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {MUSIC_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                activeCategory === cat.id
                  ? 'bg-primary/10 text-primary'
                  : 'glass text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search music assets..." />
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

      {/* Volume control */}
      <Card className="glass p-4">
        <div className="flex items-center gap-4">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Master Volume</span>
          <Slider value={[volume]} onValueChange={handleVolumeChange} max={100} step={1} className="flex-1 max-w-xs" />
          <Badge variant="secondary">{volume}%</Badge>
        </div>
      </Card>

      {/* Drag overlay */}
      {dragOver && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="rounded-2xl border-2 border-dashed border-primary p-12 text-center">
            <Upload className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-lg font-semibold">Drop audio files here</p>
            <p className="text-sm text-muted-foreground">MP3, WAV, AAC, OGG, FLAC</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Card className="glass p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading music assets...</span>
          </div>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={loadAssets} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={Music}
          title={search || activeCategory !== 'all' ? 'No matching tracks' : 'No music assets yet'}
          description={search || activeCategory !== 'all' ? 'Try a different search or category.' : 'Upload audio files to build your music library.'}
          action={!search && activeCategory === 'all' && (
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Upload Your First Track
            </Button>
          )}
        />
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="space-y-2"
        >
          {filteredAssets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="glass glass-hover p-3">
                <div className="flex items-center gap-3">
                  {/* Play button */}
                  <Button
                    size="icon"
                    onClick={() => togglePlay(asset)}
                    className="h-11 w-11 shrink-0 rounded-full"
                  >
                    {playingId === asset.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  {/* Track info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium" title={asset.name}>{asset.name}</p>
                      <Badge variant="outline" className="shrink-0 text-xs capitalize">{getCategory(asset)}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-muted-foreground" />
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-48">
                          <motion.div
                            className="h-full bg-primary"
                            animate={{ width: `${playingId === asset.id ? progress : 0}%` }}
                            transition={{ ease: 'linear' }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {playingId === asset.id ? `${Math.round(progress)}%` : formatDuration(asset.duration)}
                      </span>
                    </div>
                  </div>

                  {/* Waveform-like decoration */}
                  <div className="hidden items-center gap-0.5 md:flex">
                    {Array.from({ length: 20 }).map((_, j) => (
                      <motion.div
                        key={j}
                        className="w-0.5 rounded-full bg-primary/30"
                        animate={{
                          height: playingId === asset.id
                            ? [4, 12 + Math.random() * 8, 4]
                            : [4, 6, 4],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: playingId === asset.id ? Infinity : 0,
                          delay: j * 0.05,
                        }}
                      />
                    ))}
                  </div>

                  {/* Toggles */}
                  <div className="hidden items-center gap-1 lg:flex">
                    <Button
                      size="sm"
                      variant={loopIds.has(asset.id) ? 'secondary' : 'ghost'}
                      className="h-8 w-8 p-0"
                      onClick={() => toggleLoop(asset.id)}
                      title="Loop"
                    >
                      <Repeat className={cn('h-3.5 w-3.5', loopIds.has(asset.id) && 'text-primary')} />
                    </Button>
                    <Button
                      size="sm"
                      variant={fadeInIds.has(asset.id) ? 'secondary' : 'ghost'}
                      className="h-8 w-8 p-0"
                      onClick={() => toggleFadeIn(asset.id)}
                      title="Fade In"
                    >
                      <ArrowUp className={cn('h-3.5 w-3.5', fadeInIds.has(asset.id) && 'text-primary')} />
                    </Button>
                    <Button
                      size="sm"
                      variant={fadeOutIds.has(asset.id) ? 'secondary' : 'ghost'}
                      className="h-8 w-8 p-0"
                      onClick={() => toggleFadeOut(asset.id)}
                      title="Fade Out"
                    >
                      <ArrowDown className={cn('h-3.5 w-3.5', fadeOutIds.has(asset.id) && 'text-primary')} />
                    </Button>
                  </div>

                  {/* Meta */}
                  <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(asset.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(asset.size)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDownload(asset)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDelete(asset)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
