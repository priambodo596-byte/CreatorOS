'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Video,
  Image as ImageIcon,
  FileText,
  Hash,
  Tag,
  Eye,
  Calendar,
  Globe,
  Check,
  Clock,
  Sparkles,
  Flame,
  TrendingUp,
  MousePointerClick,
  ChevronRight,
  ChevronLeft,
  Play,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
  Youtube,
  Download,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState, LoadingState, formatNumber, parseDuration } from '@/components/dashboard/shared';
import { VideoUpload } from '@/components/youtube/video-upload';
import type { UploadedVideo } from '@/hooks/use-video-upload';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Upload', icon: Upload },
  { label: 'Processing', icon: Video },
  { label: 'Thumbnail', icon: ImageIcon },
  { label: 'Details', icon: FileText },
  { label: 'SEO', icon: TrendingUp },
  { label: 'Playlist', icon: Tag },
  { label: 'Visibility', icon: Globe },
  { label: 'Publish', icon: Check },
];

interface UploadDraft {
  id: string;
  title: string;
  description: string;
  category: string;
  language: string;
  tags: string[];
  hashtags: string[];
  thumbnail_url: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  video_name: string | null;
  video_size: number | null;
  original_youtube_url: string | null;
  download_status: string | null;
  download_error: string | null;
  storage_size: number | null;
  storage_mime: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  scheduled: boolean;
  scheduled_date: string;
  scheduled_time: string;
  status: 'draft' | 'ready';
  created_at: string;
  updated_at: string;
}

interface ChecklistItem {
  item: string;
  done: boolean;
}

export default function PublishingPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<UploadDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<UploadDraft | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; title: string; item_count: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();
  const currentDraftRef = useRef<UploadDraft | null>(null);
  currentDraftRef.current = currentDraft;

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('publishing_drafts')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      const mapped: UploadDraft[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        category: row.category || 'Science & Technology',
        language: row.language || 'English',
        tags: row.tags || [],
        hashtags: row.hashtags || [],
        thumbnail_url: row.thumbnail_url,
        video_url: row.video_url,
        video_storage_path: row.video_storage_path ?? null,
        video_name: row.title,
        video_size: row.storage_size ?? null,
        original_youtube_url: row.original_youtube_url ?? null,
        download_status: row.download_status ?? null,
        download_error: row.download_error ?? null,
        storage_size: row.storage_size ?? null,
        storage_mime: row.storage_mime ?? null,
        visibility: row.visibility || 'public',
        scheduled: row.scheduled || false,
        scheduled_date: row.scheduled_at ? row.scheduled_at.split('T')[0] : '',
        scheduled_time: row.scheduled_at ? row.scheduled_at.split('T')[1]?.substring(0, 5) || '15:00' : '15:00',
        status: row.status || 'draft',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setDrafts(mapped);
      if (mapped.length > 0 && !currentDraftRef.current) {
        setCurrentDraft(mapped[0]);
      }
    }
    setLoadingDrafts(false);
  }, []);

  const loadPlaylists = useCallback(async () => {
    const { data } = await supabase
      .from('youtube_playlists')
      .select('playlist_id, title, item_count')
      .order('title', { ascending: true });
    if (data) {
      setPlaylists(data.map((p: any) => ({ id: p.playlist_id, title: p.title, item_count: p.item_count })));
    }
  }, []);

  useEffect(() => {
    loadDrafts().then(() => {
      const params = new URLSearchParams(window.location.search);
      const draftId = params.get('draft');
      if (draftId) {
        setDrafts((prev) => {
          const found = prev.find((d) => d.id === draftId);
          if (found) {
            setCurrentDraft(found);
            setStep(1);
          }
          return prev;
        });
      }
    });
    loadPlaylists();
  }, [loadDrafts, loadPlaylists]);

  const checklist: ChecklistItem[] = currentDraft ? [
    { item: 'Video uploaded', done: !!currentDraft.video_url },
    { item: 'Thumbnail selected', done: !!currentDraft.thumbnail_url },
    { item: 'Title optimized', done: currentDraft.title.length >= 20 && currentDraft.title.length <= 70 },
    { item: 'Description added', done: currentDraft.description.length >= 100 },
    { item: 'Tags added', done: currentDraft.tags.length >= 3 },
    { item: 'Hashtags added', done: currentDraft.hashtags.length >= 2 },
    { item: 'Subtitles generated', done: false },
    { item: 'End screen configured', done: false },
  ] : [];

  const completedCount = checklist.filter((c) => c.done).length;
  const checklistProgress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

  const seoScore = currentDraft ? Math.min(100, Math.round(
    (currentDraft.title.length >= 20 && currentDraft.title.length <= 70 ? 25 : 0) +
    (currentDraft.description.length >= 100 ? 25 : 0) +
    (currentDraft.tags.length >= 3 ? 25 : 0) +
    (currentDraft.hashtags.length >= 2 ? 15 : 0) +
    (currentDraft.thumbnail_url ? 10 : 0)
  )) : 0;

  const aiScore = currentDraft ? Math.min(100, Math.round(
    (currentDraft.title ? 30 : 0) +
    (currentDraft.description ? 30 : 0) +
    (currentDraft.tags.length >= 3 ? 20 : 0) +
    (currentDraft.thumbnail_url ? 20 : 0)
  )) : 0;

  const viralChance = currentDraft ? (seoScore > 70 ? 'High' : seoScore > 40 ? 'Medium' : 'Low') : 'Low';

  const handleVideoUploaded = useCallback(async (video: UploadedVideo) => {
    const title = video.filename.replace(/\.[^/.]+$/, '');
    const { data: draftData, error: insErr } = await supabase
      .from('publishing_drafts')
      .insert({
        title,
        video_storage_path: video.storagePath,
        video_url: video.publicUrl,
        storage_size: video.filesize,
        storage_mime: video.mimeType,
        status: 'draft',
      })
      .select('*')
      .single();
    if (insErr || !draftData) {
      toast({ title: 'Failed to create draft', description: insErr?.message, variant: 'destructive' });
      return;
    }

    await supabase
      .from('uploaded_videos')
      .update({ status: 'READY' })
      .eq('id', video.id);

    const newDraft: UploadDraft = {
      id: draftData.id,
      title: draftData.title,
      description: '',
      category: 'Science & Technology',
      language: 'English',
      tags: [],
      hashtags: [],
      thumbnail_url: null,
      video_url: video.publicUrl,
      video_storage_path: video.storagePath,
      video_name: video.filename,
      video_size: video.filesize,
      original_youtube_url: null,
      download_status: 'none',
      download_error: null,
      storage_size: video.filesize,
      storage_mime: video.mimeType,
      visibility: 'public',
      scheduled: false,
      scheduled_date: '',
      scheduled_time: '15:00',
      status: 'draft',
      created_at: draftData.created_at,
      updated_at: draftData.created_at,
    };
    setDrafts((prev) => [newDraft, ...prev]);
    setCurrentDraft(newDraft);
    setStep(1);

    setProcessing(true);
    setProcessProgress(0);
    const interval = setInterval(() => {
      setProcessProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setProcessing(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  }, [toast]);

  const handleThumbnailUpload = async (file: File) => {
    if (!currentDraft) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const filePath = `${userData.user.id}/${currentDraft.id}_thumbnail_${file.name}`;
    const { error } = await supabase.storage.from('clips').upload(filePath, file, { upsert: true });
    if (error) {
      toast({ title: 'Thumbnail upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data: urlData } = supabase.storage.from('clips').getPublicUrl(filePath);
    updateDraft({ thumbnail_url: urlData.publicUrl });
    toast({ title: 'Thumbnail uploaded' });
  };

  const updateDraft = (updates: Partial<UploadDraft>) => {
    if (!currentDraft) return;
    const updated = { ...currentDraft, ...updates, updated_at: new Date().toISOString() };
    setCurrentDraft(updated);
    setDrafts((prev) => prev.map((d) => d.id === updated.id ? updated : d));
  };

  const handleSaveDraft = async () => {
    if (!currentDraft) return;
    setSaving(true);
    const scheduledAt = currentDraft.scheduled && currentDraft.scheduled_date
      ? new Date(`${currentDraft.scheduled_date}T${currentDraft.scheduled_time}:00`).toISOString()
      : null;
    const { error } = await supabase
      .from('publishing_drafts')
      .update({
        title: currentDraft.title,
        description: currentDraft.description,
        category: currentDraft.category,
        language: currentDraft.language,
        tags: currentDraft.tags,
        hashtags: currentDraft.hashtags,
        thumbnail_url: currentDraft.thumbnail_url,
        visibility: currentDraft.visibility,
        scheduled: currentDraft.scheduled,
        scheduled_at: scheduledAt,
        status: 'ready',
      })
      .eq('id', currentDraft.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Draft saved' });
    }
  };

  const handleDownloadFromYoutube = async () => {
    if (!currentDraft) return;
    setDownloading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/youtube-download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ draftId: currentDraft.id }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Download failed (${response.status})`);
      }

      toast({
        title: result.cached ? 'Video already stored' : 'Download complete',
        description: result.cached
          ? 'Video file was already in Supabase Storage.'
          : `Downloaded and uploaded to Storage (${(result.file_size / (1024 * 1024)).toFixed(1)} MB)`,
      });

      await loadDrafts();
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePublish = async () => {
    if (!currentDraft) return;

    const ytPatterns = ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'];
    const isYouTubeUrl = (url: string) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return ytPatterns.some((p) => host === p || host.endsWith(`.${p}`));
      } catch {
        return false;
      }
    };

    if (currentDraft.video_url && isYouTubeUrl(currentDraft.video_url)) {
      toast({
        title: 'Cannot publish',
        description: 'video_url contains a YouTube watch URL, not a video file. Click "Download from YouTube" first to download the video to Storage.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentDraft.video_storage_path) {
      toast({
        title: 'Cannot publish',
        description: currentDraft.original_youtube_url
          ? 'Video file belum diupload ke Supabase Storage. Click "Download from YouTube" first to download the video.'
          : 'Video file belum diupload ke Supabase Storage. Upload a video file first.',
        variant: 'destructive',
      });
      return;
    }

    setPublishing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/youtube-publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ draftId: currentDraft.id }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Publish failed (${response.status})`);
      }

      toast({
        title: 'Published to YouTube',
        description: result.videoId
          ? `Video ID: ${result.videoId}`
          : 'Your video has been published.',
      });

      await loadDrafts();
    } catch (err) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim() || !currentDraft) return;
    if (currentDraft.tags.includes(tag.trim())) return;
    updateDraft({ tags: [...currentDraft.tags, tag.trim()] });
  };

  const handleRemoveTag = (tag: string) => {
    if (!currentDraft) return;
    updateDraft({ tags: currentDraft.tags.filter((t) => t !== tag) });
  };

  const handleAddHashtag = (tag: string) => {
    if (!tag.trim() || !currentDraft) return;
    const cleaned = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`;
    if (currentDraft.hashtags.includes(cleaned)) return;
    updateDraft({ hashtags: [...currentDraft.hashtags, cleaned] });
  };

  const handleRemoveHashtag = (tag: string) => {
    if (!currentDraft) return;
    updateDraft({ hashtags: currentDraft.hashtags.filter((t) => t !== tag) });
  };

  if (loadingDrafts) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Upload Center" description="Upload, optimize, and publish your video to YouTube." />
        <LoadingState message="Loading your drafts…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Upload Center" description="Upload, optimize, and publish your video to YouTube." />
        <ErrorState message={error} onRetry={loadDrafts} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Upload Center"
        description="Upload, optimize, and publish your video to YouTube."
        actions={
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!currentDraft || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Draft
          </Button>
        }
      />

      {/* Draft selector */}
      {drafts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              onClick={() => { setCurrentDraft(draft); setStep(0); }}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border p-2 transition-colors',
                currentDraft?.id === draft.id ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-primary/30'
              )}
            >
              <div className="flex h-10 w-14 items-center justify-center rounded bg-muted/30 overflow-hidden">
                {draft.thumbnail_url ? (
                  <img src={draft.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Video className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="text-left">
                <p className="max-w-32 truncate text-xs font-medium">{draft.title || 'Untitled'}</p>
                <p className="text-[10px] text-muted-foreground">{draft.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step indicator */}
      <Card className="glass p-5">
        <div className="flex items-center justify-between overflow-x-auto scrollbar-thin">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div
                className={cn(
                  'flex flex-col items-center gap-2',
                  i === step ? 'text-primary' : i < step ? 'text-success' : 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                    i === step ? 'bg-primary/20 neon-glow' : i < step ? 'bg-success/15' : 'glass'
                  )}
                >
                  {i < step ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <span className="text-xs font-medium whitespace-nowrap">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('mx-2 h-px w-8 md:w-16', i < step ? 'bg-success' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main upload area */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {step === 0 && (
                <VideoUpload onUploaded={handleVideoUploaded} />
              )}

              {step === 1 && (
                <Card className="glass p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold">Processing Video</h2>
                    <Badge variant="secondary" className="bg-info/15 text-info">
                      {processing ? 'Processing' : 'Ready'}
                    </Badge>
                  </div>
                  <div className="relative aspect-video overflow-hidden rounded-xl glass">
                    {currentDraft?.thumbnail_url ? (
                      <img src={currentDraft.thumbnail_url} alt="Processing" className="h-full w-full object-cover opacity-60" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Video className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {processing ? (
                        <>
                          <div className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                          <p className="text-sm text-muted-foreground">Processing... {processProgress}%</p>
                        </>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                          <Check className="h-6 w-6 text-success" />
                        </div>
                      )}
                    </div>
                  </div>
                  <Progress value={processProgress} className="mt-4 h-2" />
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p className={cn(processProgress >= 30 ? 'text-success' : '')}>✓ Video uploaded</p>
                    <p className={cn(processProgress >= 50 ? 'text-success' : '')}>✓ Extracting frames</p>
                    <p className={cn(processProgress >= 70 ? 'text-success' : processing ? 'text-primary' : '')}>
                      {processProgress >= 70 ? '✓' : processing ? '⟳' : '○'} Generating AI captions…
                    </p>
                    <p className={cn(processProgress >= 90 ? 'text-success' : '')}>
                      {processProgress >= 90 ? '✓' : '○'} Creating thumbnail suggestions
                    </p>
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card className="glass p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">Select Thumbnail</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {currentDraft?.thumbnail_url ? (
                      <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-primary">
                        <img src={currentDraft.thumbnail_url} alt="Selected thumbnail" className="h-full w-full object-cover" />
                        <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <label className="flex aspect-video cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/30 transition-colors">
                      <div className="text-center">
                        <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                        <p className="mt-1 text-xs text-muted-foreground">Upload</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleThumbnailUpload(file);
                        }}
                      />
                    </label>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    Generate AI Thumbnail
                  </Button>
                </Card>
              )}

              {step === 3 && currentDraft && (
                <Card className="glass p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">Video Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Title</label>
                      <Input
                        value={currentDraft.title}
                        onChange={(e) => updateDraft({ title: e.target.value })}
                        placeholder="Enter your video title"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{currentDraft.title.length}/100 characters</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Description</label>
                      <Textarea
                        rows={6}
                        value={currentDraft.description}
                        onChange={(e) => updateDraft({ description: e.target.value })}
                        placeholder="Add your video description..."
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{currentDraft.description.length} characters</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm text-muted-foreground">Category</label>
                        <select
                          value={currentDraft.category}
                          onChange={(e) => updateDraft({ category: e.target.value })}
                          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                        >
                          <option>Science & Technology</option>
                          <option>Education</option>
                          <option>Entertainment</option>
                          <option>Music</option>
                          <option>Gaming</option>
                          <option>Howto & Style</option>
                          <option>People & Blogs</option>
                          <option>News & Politics</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm text-muted-foreground">Language</label>
                        <select
                          value={currentDraft.language}
                          onChange={(e) => updateDraft({ language: e.target.value })}
                          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
                        >
                          <option>English</option>
                          <option>Spanish</option>
                          <option>French</option>
                          <option>German</option>
                          <option>Japanese</option>
                          <option>Portuguese</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {step === 4 && currentDraft && (
                <Card className="glass p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">SEO Optimization</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {currentDraft.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="text-muted-foreground hover:text-foreground">×</button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Add tag and press Enter…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{currentDraft.tags.length} tags</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Hashtags</label>
                      <div className="flex flex-wrap gap-2">
                        {currentDraft.hashtags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 bg-primary/15 text-primary">
                            {tag}
                            <button onClick={() => handleRemoveHashtag(tag)} className="text-muted-foreground hover:text-foreground">×</button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Add hashtag and press Enter…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddHashtag((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="rounded-xl glass p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI SEO Score</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={seoScore} className="h-2 flex-1" />
                        <span className={cn('font-display text-xl font-bold', seoScore >= 70 ? 'text-success' : seoScore >= 40 ? 'text-warning' : 'text-destructive')}>
                          {seoScore}/100
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {step === 5 && (
                <Card className="glass p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">Playlist &amp; End Screen</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Add to Playlist</label>
                      {playlists.length === 0 ? (
                        <p className="rounded-lg glass p-3 text-xs text-muted-foreground">
                          No playlists found. Sync your YouTube channel to load playlists.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {playlists.map((p) => (
                            <label key={p.id} className="flex items-center gap-3 rounded-lg glass p-3 cursor-pointer hover:border-primary/30">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border"
                                checked={selectedPlaylistIds.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedPlaylistIds((prev) => [...prev, p.id]);
                                  else setSelectedPlaylistIds((prev) => prev.filter((id) => id !== p.id));
                                }}
                              />
                              <span className="text-sm">{p.title}</span>
                              <Badge variant="outline" className="ml-auto text-xs">{p.item_count} videos</Badge>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">End Screen</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['Subscribe Button', 'Best For Viewer', 'Last Video', 'Playlist'].map((es) => (
                          <button key={es} className="rounded-lg glass p-3 text-sm hover:border-primary/30">{es}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {step === 6 && currentDraft && (
                <Card className="glass p-6">
                  <h2 className="mb-4 font-display text-lg font-semibold">Visibility &amp; Schedule</h2>
                  <div className="space-y-4">
                    {[
                      { label: 'Public', desc: 'Everyone can see your video', value: 'public' as const },
                      { label: 'Unlisted', desc: 'Only people with the link can see', value: 'unlisted' as const },
                      { label: 'Private', desc: 'Only you can see this video', value: 'private' as const },
                    ].map((opt) => (
                      <label
                        key={opt.label}
                        className={cn(
                          'flex items-center justify-between rounded-lg glass p-4 cursor-pointer',
                          currentDraft.visibility === opt.value && 'border-primary/30'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        <input
                          type="radio"
                          name="visibility"
                          checked={currentDraft.visibility === opt.value}
                          onChange={() => updateDraft({ visibility: opt.value })}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                    <div className="flex items-center justify-between rounded-lg glass p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Schedule for later</p>
                          <p className="text-xs text-muted-foreground">Pick a date and time</p>
                        </div>
                      </div>
                      <Switch
                        checked={currentDraft.scheduled}
                        onCheckedChange={(checked) => updateDraft({ scheduled: checked })}
                      />
                    </div>
                    {currentDraft.scheduled && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={currentDraft.scheduled_date}
                          onChange={(e) => updateDraft({ scheduled_date: e.target.value })}
                        />
                        <Input
                          type="time"
                          value={currentDraft.scheduled_time}
                          onChange={(e) => updateDraft({ scheduled_time: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {step === 7 && currentDraft && (
                <Card className="glass p-6">
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15">
                      <Check className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="font-display text-xl font-semibold">Ready to Publish!</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Your video is optimized and ready to go live.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'AI Score', value: String(aiScore), icon: Sparkles, color: 'text-primary' },
                      { label: 'SEO Score', value: String(seoScore), icon: TrendingUp, color: 'text-success' },
                      { label: 'Viral Chance', value: viralChance, icon: Flame, color: 'text-warning' },
                    ].map((score) => (
                      <div key={score.label} className="rounded-xl glass p-4 text-center">
                        <score.icon className={`mx-auto mb-1 h-5 w-5 ${score.color}`} />
                        <p className="font-display text-xl font-bold">{score.value}</p>
                        <p className="text-xs text-muted-foreground">{score.label}</p>
                      </div>
                    ))}
                  </div>
                  {currentDraft?.original_youtube_url && !currentDraft?.video_storage_path && (
                    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <Youtube className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-200">Video file not in Storage yet</p>
                          <p className="mt-1 text-xs text-amber-200/70">
                            This draft came from a YouTube URL. Download the video file to Supabase Storage before publishing.
                          </p>
                          {currentDraft.download_status === 'failed' && currentDraft.download_error && (
                            <p className="mt-2 text-xs text-red-400">Last error: {currentDraft.download_error}</p>
                          )}
                          <Button
                            className="mt-3 w-full"
                            variant="outline"
                            onClick={handleDownloadFromYoutube}
                            disabled={downloading}
                          >
                            {downloading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Downloading from YouTube...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Download from YouTube
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    className="mt-6 w-full bg-gradient-to-r from-primary to-accent text-white"
                    onClick={handlePublish}
                    disabled={publishing || !currentDraft?.video_storage_path}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Publish to YouTube
                      </>
                    )}
                  </Button>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <span className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-accent text-white"
              onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
              disabled={step === STEPS.length - 1}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sidebar - Checklist + Preview */}
        <div className="space-y-4">
          {/* Checklist */}
          <Card className="glass p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Pre-Upload Checklist</h2>
            {currentDraft ? (
              <>
                <div className="space-y-2">
                  {checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30">
                      <div className={cn('flex h-5 w-5 items-center justify-center rounded-full', item.done ? 'bg-success' : 'glass')}>
                        {item.done && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={cn('text-sm', item.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                        {item.item}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl glass p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{completedCount}/{checklist.length} items</span>
                  </div>
                  <Progress value={checklistProgress} className="mt-2 h-2" />
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">Upload a video to start the checklist.</p>
            )}
          </Card>

          {/* AI Predictions */}
          <Card className="glass p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">AI Predictions</h2>
            </div>
            {currentDraft ? (
              <div className="space-y-3">
                {[
                  { label: 'AI Score', value: `${aiScore}/100`, icon: Sparkles, color: 'text-primary' },
                  { label: 'SEO Score', value: `${seoScore}/100`, icon: TrendingUp, color: 'text-success' },
                  { label: 'Viral Chance', value: viralChance, icon: Flame, color: 'text-warning' },
                  { label: 'Checklist', value: `${completedCount}/${checklist.length}`, icon: Check, color: 'text-info' },
                ].map((pred) => (
                  <div key={pred.label} className="flex items-center justify-between rounded-lg glass p-3">
                    <div className="flex items-center gap-2">
                      <pred.icon className={`h-4 w-4 ${pred.color}`} />
                      <span className="text-sm text-muted-foreground">{pred.label}</span>
                    </div>
                    <span className="text-sm font-medium">{pred.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">Upload a video to see predictions.</p>
            )}
          </Card>

          {/* Video preview */}
          {currentDraft && (
            <Card className="glass overflow-hidden">
              <div className="relative aspect-video">
                {currentDraft.thumbnail_url ? (
                  <img src={currentDraft.thumbnail_url} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/30">
                    <Video className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-10 w-10 text-white" />
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium">{currentDraft.title || 'Untitled'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentDraft.video_name || 'No file'}
                  {currentDraft.video_size ? ` · ${formatBytes(currentDraft.video_size)}` : ''}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
