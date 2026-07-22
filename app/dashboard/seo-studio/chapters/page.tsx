'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Video,
  Link as LinkIcon,
  GripVertical,
  Save,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase-client';
import { getSyncedVideos, type SyncedVideo } from '@/lib/youtube';

interface Chapter {
  id: string;
  timestamp: string; // "0:00" or "1:23:45"
  label: string;
}

interface ChaptersResult {
  chapters: Chapter[];
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function secondsToTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ChaptersGeneratorPage() {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<'select' | 'url'>('select');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videos, setVideos] = useState<SyncedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [copiedChapters, setCopiedChapters] = useState(false);
  const [copiedYouTube, setCopiedYouTube] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editLabel, setEditLabel] = useState('');

  // Load synced videos on mount
  useEffect(() => {
    let cancelled = false;
    async function loadVideos() {
      setLoadingVideos(true);
      setVideosError(null);
      try {
        const data = await getSyncedVideos(50, 0);
        if (!cancelled) setVideos(data);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load videos';
          setVideosError(msg);
        }
      } finally {
        if (!cancelled) setLoadingVideos(false);
      }
    }
    loadVideos();
    return () => { cancelled = true; };
  }, []);

  const selectedVideo = useMemo(
    () => videos.find((v) => v.video_id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const videoTitle = useMemo(() => {
    if (inputMode === 'select' && selectedVideo) return selectedVideo.title;
    if (inputMode === 'url') {
      // Try to extract video ID from URL and match
      const match = videoUrl.match(/(?:youtu\.be\/|v=)([^&]+)/);
      const id = match?.[1];
      return videos.find((v) => v.video_id === id)?.title || '';
    }
    return '';
  }, [inputMode, selectedVideo, videoUrl, videos]);

  const videoIdForRequest = useMemo(() => {
    if (inputMode === 'select') return selectedVideoId;
    if (inputMode === 'url') {
      const match = videoUrl.match(/(?:youtu\.be\/|v=)([^&]+)/);
      return match?.[1] || videoUrl.trim();
    }
    return '';
  }, [inputMode, selectedVideoId, videoUrl]);

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => parseTimestampToSeconds(a.timestamp) - parseTimestampToSeconds(b.timestamp)),
    [chapters]
  );

  const maxSeconds = useMemo(() => {
    if (!sortedChapters.length) return 0;
    return Math.max(...sortedChapters.map((c) => parseTimestampToSeconds(c.timestamp)), 1);
  }, [sortedChapters]);

  const handleGenerate = useCallback(async () => {
    if (!videoIdForRequest.trim()) {
      toast({ title: 'Please select a video or enter a URL', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setError(null);
    setChapters([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(`${supabaseUrl}/functions/v1/seo-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token || supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'chapters',
          videoId: videoIdForRequest.trim(),
          title: videoTitle || selectedVideo?.title || '',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const rawChapters: Chapter[] = (data.chapters || []).map(
        (c: { timestamp?: string; time?: string; label?: string; title?: string }, i: number) => ({
          id: generateId(),
          timestamp: c.timestamp || c.time || '0:00',
          label: c.label || c.title || `Chapter ${i + 1}`,
        })
      );

      setChapters(rawChapters);
      toast({ title: 'Chapters generated', description: `${rawChapters.length} chapters found` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast({ title: 'Generation failed', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [videoIdForRequest, videoTitle, selectedVideo, toast]);

  const handleAddChapter = useCallback(() => {
    const newChapter: Chapter = {
      id: generateId(),
      timestamp: '0:00',
      label: 'New Chapter',
    };
    setChapters((prev) => [...prev, newChapter]);
  }, []);

  const handleRemoveChapter = useCallback((id: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleStartEdit = useCallback((chapter: Chapter) => {
    setEditingId(chapter.id);
    setEditTimestamp(chapter.timestamp);
    setEditLabel(chapter.label);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    setChapters((prev) =>
      prev.map((c) =>
        c.id === editingId
          ? { ...c, timestamp: editTimestamp || '0:00', label: editLabel || 'Untitled' }
          : c
      )
    );
    setEditingId(null);
    setEditTimestamp('');
    setEditLabel('');
  }, [editingId, editTimestamp, editLabel]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTimestamp('');
    setEditLabel('');
  }, []);

  const handleCopyChapters = useCallback(async () => {
    if (!sortedChapters.length) return;
    const text = sortedChapters.map((c) => `${c.timestamp} ${c.label}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedChapters(true);
    setTimeout(() => setCopiedChapters(false), 2000);
    toast({ title: 'Chapters copied', description: `${sortedChapters.length} chapters` });
  }, [sortedChapters, toast]);

  const handleCopyYouTubeFormat = useCallback(async () => {
    if (!sortedChapters.length) return;
    const text = sortedChapters.map((c) => `${c.timestamp} ${c.label}`).join('\n');
    const formatted = `${videoTitle || 'Video Chapters'}\n\n${text}\n\nChapters generated by SEO Studio`;
    await navigator.clipboard.writeText(formatted);
    setCopiedYouTube(true);
    setTimeout(() => setCopiedYouTube(false), 2000);
    toast({ title: 'YouTube format copied', description: 'Paste directly into your video description' });
  }, [sortedChapters, videoTitle, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chapters Generator"
        description="Generate timestamped chapters for your videos with a visual timeline"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'select' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('select')}
            >
              <Video className="mr-2 h-3.5 w-3.5" />
              Select Video
            </Button>
            <Button
              variant={inputMode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('url')}
            >
              <LinkIcon className="mr-2 h-3.5 w-3.5" />
              Video URL
            </Button>
          </div>

          {inputMode === 'select' ? (
            <div>
              <Label htmlFor="chapter-video" className="mb-2 block">Select Synced Video</Label>
              {loadingVideos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading synced videos...
                </div>
              ) : videosError ? (
                <ErrorState message={videosError} />
              ) : videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No synced videos found. Connect your YouTube account and sync videos first.
                </p>
              ) : (
                <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a video..." />
                  </SelectTrigger>
                  <SelectContent>
                    {videos.map((v) => (
                      <SelectItem key={v.video_id} value={v.video_id}>
                        {v.title.length > 60 ? `${v.title.slice(0, 60)}...` : v.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="chapter-url" className="mb-2 block">Video URL</Label>
              <Input
                id="chapter-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || !videoIdForRequest.trim()}
            className="w-full sm:w-auto"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Chapters
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {generating ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">Generating chapters...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzing video content to identify key timestamps
                </p>
              </div>
            </Card>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState message={error} onRetry={handleGenerate} />
          </motion.div>
        ) : chapters.length > 0 ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-display text-lg font-semibold">
                    {sortedChapters.length} Chapters
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleAddChapter}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Chapter
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyChapters}>
                    {copiedChapters ? (
                      <>
                        <Check className="mr-2 h-3.5 w-3.5 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copy Chapters
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyYouTubeFormat}>
                    {copiedYouTube ? (
                      <>
                        <Check className="mr-2 h-3.5 w-3.5 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copy as YouTube Format
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Visual Timeline */}
              <Card className="glass p-5">
                <h3 className="mb-3 font-display text-sm font-semibold">Timeline Preview</h3>
                <div className="relative h-16 rounded-xl bg-muted/30">
                  {/* Progress bar track */}
                  <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-border" />
                  {/* Chapter markers */}
                  {sortedChapters.map((chapter, i) => {
                    const seconds = parseTimestampToSeconds(chapter.timestamp);
                    const percentage = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
                    return (
                      <motion.div
                        key={chapter.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="group absolute top-1/2 -translate-y-1/2"
                        style={{ left: `${percentage}%` }}
                      >
                        <div className="relative flex flex-col items-center">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg bg-popover px-2 py-1 text-xs font-medium shadow-md group-hover:block">
                            {chapter.timestamp} — {chapter.label}
                          </div>
                          {/* Marker dot */}
                          <div className="h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm transition-transform group-hover:scale-125" />
                          {/* Timestamp label below */}
                          <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {chapter.timestamp}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>

              {/* Chapter list */}
              <Card className="glass p-5">
                <div className="space-y-2">
                  {sortedChapters.map((chapter, i) => {
                    const isEditing = editingId === chapter.id;
                    return (
                      <motion.div
                        key={chapter.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                          isEditing ? 'border-primary/50 bg-primary/5' : 'border-border glass-hover'
                        )}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50" />

                        {isEditing ? (
                          // Edit mode
                          <>
                            <Input
                              value={editTimestamp}
                              onChange={(e) => setEditTimestamp(e.target.value)}
                              placeholder="0:00"
                              className="w-20 font-mono text-sm"
                            />
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder="Chapter label"
                              className="flex-1 text-sm"
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                              <span className="text-xs text-muted-foreground">✕</span>
                            </Button>
                          </>
                        ) : (
                          // Display mode
                          <>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {i + 1}
                            </div>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {chapter.timestamp}
                            </Badge>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {chapter.label}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleStartEdit(chapter)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveChapter(chapter.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Clock}
              title="No chapters generated yet"
              description="Select a synced video or paste a video URL above, then click Generate to create timestamped chapters."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
