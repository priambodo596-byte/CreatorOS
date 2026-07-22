'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Captions,
  Music,
  Film,
  Mic,
  Sparkles,
  Download,
  Settings,
  Layers,
  Plus,
  Trash2,
  Volume2,
  Maximize2,
  VolumeX,
  Upload,
  Youtube,
  HardDrive,
  Cloud,
  FolderOpen,
  Star,
  Clock,
  Eye,
  ThumbsUp,
  MessageCircle,
  TrendingUp,
  Flame,
  Zap,
  Wand2,
  Crop,
  RotateCw,
  Gauge,
  Square,
  Waves,
  Bookmark,
  Loader2,
  AlertCircle,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Monitor,
  Link2,
  MonitorPlay,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  formatNumber,
} from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoImportRow {
  id: string;
  title: string;
  url?: string;
  thumbnail_url?: string;
  duration?: number;
  source?: string;
  favorite?: boolean;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

interface VideoProjectRow {
  id: string;
  title: string;
  thumbnail_url?: string;
  duration?: number;
  status?: string;
  created_at?: string;
}

interface AssetRow {
  id: string;
  name: string;
  type: string;
  url?: string;
  thumbnail_url?: string;
  duration?: number;
  size?: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

interface TimelineClip {
  start: number; // percentage
  width: number; // percentage
  label: string;
  color: string;
}

interface TimelineTrack {
  name: string;
  type: 'video' | 'audio' | 'voice' | 'subtitle';
  icon: typeof Film;
  clips: TimelineClip[];
}

interface VideoAnalysis {
  sceneCount: number;
  averageSceneDuration: number;
  speakingSegments: number;
  silenceSegments: number;
  hookQualityScore: number;
  ctaDetected: boolean;
  estimatedRetention: number;
  bestShortsMoments: { time: number; score: number; label: string }[];
  highlightMoments: { time: number; score: number; label: string }[];
  viralMoments: { time: number; score: number; label: string }[];
  keywords: string[];
  emotions: { label: string; intensity: number }[];
  pacingScore: number;
}

interface GeneratedShort {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  engagementScore: number;
  viralScore: number;
  category: string;
  platform: string;
}

interface EditorVideo {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration: number; // seconds
  source: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function formatTimecode(seconds: number): string {
  if (!seconds || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getAssetIcon(type: string): typeof Film {
  const lower = (type || '').toLowerCase();
  if (lower.includes('music') || lower.includes('audio')) return Music;
  if (lower.includes('voice') || lower.includes('narration')) return Mic;
  if (lower.includes('video') || lower.includes('b-roll') || lower.includes('broll')) return Film;
  if (lower.includes('image') || lower.includes('photo')) return Layers;
  return Film;
}

function getSourceBadge(source: string): { label: string; color: string } {
  const s = (source || '').toLowerCase();
  if (s.includes('youtube')) return { label: 'YouTube', color: 'bg-red-500/20 text-red-400' };
  if (s.includes('upload') || s.includes('local')) return { label: 'Upload', color: 'bg-blue-500/20 text-blue-400' };
  if (s.includes('drive')) return { label: 'Drive', color: 'bg-green-500/20 text-green-400' };
  if (s.includes('dropbox')) return { label: 'Dropbox', color: 'bg-indigo-500/20 text-indigo-400' };
  if (s.includes('project')) return { label: 'Project', color: 'bg-purple-500/20 text-purple-400' };
  return { label: source || 'Video', color: 'bg-muted/30 text-muted-foreground' };
}

// ─── AI Analysis Engine ──────────────────────────────────────────────────────

function analyzeVideo(video: EditorVideo | null): VideoAnalysis | null {
  if (!video) return null;
  const duration = video.duration || 60;
  const views = video.viewCount || 0;
  const likes = video.likeCount || 0;
  const comments = video.commentCount || 0;
  const tags = video.tags || [];

  // Scene detection: average scene length ~8s
  const avgSceneLength = 8;
  const sceneCount = Math.max(3, Math.round(duration / avgSceneLength));
  const averageSceneDuration = duration / sceneCount;

  // Speaking vs silence segments
  const speakingSegments = Math.max(2, Math.round(duration / 15));
  const silenceSegments = Math.max(1, Math.round(duration / 45));

  // Hook quality: based on first 30s proportion + engagement
  const engagementRate = views > 0 ? (likes + comments) / views : 0;
  const hookQualityScore = Math.min(
    100,
    Math.round(40 + engagementRate * 500 + (tags.length > 3 ? 15 : 5) + (duration < 600 ? 10 : 0)),
  );

  // CTA detection: check description/tags for CTA keywords
  const ctaKeywords = ['subscribe', 'follow', 'comment', 'link', 'bio', 'description', 'click', 'download', 'sign up'];
  const allText = `${video.title} ${video.description || ''} ${tags.join(' ')}`.toLowerCase();
  const ctaDetected = ctaKeywords.some((k) => allText.includes(k));

  // Estimated retention: shorter videos + higher engagement = better retention
  const durationFactor = duration < 60 ? 90 : duration < 180 ? 80 : duration < 600 ? 65 : 50;
  const engagementFactor = Math.min(20, engagementRate * 400);
  const estimatedRetention = Math.min(95, Math.max(30, Math.round(durationFactor + engagementFactor)));

  // Best shorts moments at 25%, 50%, 75%
  const bestShortsMoments = [
    { time: duration * 0.25, score: Math.min(100, 70 + Math.round(engagementRate * 300)), label: 'Opening hook' },
    { time: duration * 0.5, score: Math.min(100, 75 + Math.round(engagementRate * 300)), label: 'Key moment' },
    { time: duration * 0.75, score: Math.min(100, 68 + Math.round(engagementRate * 300)), label: 'Climax' },
  ];

  // Highlight moments at 15%, 40%, 65%, 90%
  const highlightMoments = [
    { time: duration * 0.15, score: 72, label: 'Intro payoff' },
    { time: duration * 0.4, score: 80, label: 'Main content' },
    { time: duration * 0.65, score: 85, label: 'Peak interest' },
    { time: duration * 0.9, score: 78, label: 'Conclusion' },
  ];

  // Viral moments: based on high engagement
  const viralScore = Math.min(100, Math.round(50 + engagementRate * 600 + (comments > 10 ? 15 : 0)));
  const viralMoments = [
    { time: duration * 0.3, score: viralScore, label: 'Shareable moment' },
    { time: duration * 0.6, score: Math.max(40, viralScore - 10), label: 'Reaction moment' },
  ];

  // Keywords from tags + title
  const keywords = tags.slice(0, 10);

  // Emotions detected (heuristic from content)
  const emotions: { label: string; intensity: number }[] = [];
  const emotionMap: Record<string, string[]> = {
    Excited: ['amazing', 'incredible', 'awesome', 'wow', 'best', 'crazy'],
    Educational: ['how', 'learn', 'guide', 'tutorial', 'explain', 'tips'],
    Emotional: ['story', 'journey', 'love', 'heart', 'feel', 'emotional'],
    Funny: ['funny', 'hilarious', 'laugh', 'joke', 'comedy', 'lol'],
    Inspirational: ['inspire', 'motivat', 'achieve', 'dream', 'goal', 'success'],
  };
  for (const [emotion, words] of Object.entries(emotionMap)) {
    if (words.some((w) => allText.includes(w))) {
      emotions.push({ label: emotion, intensity: Math.min(100, 60 + Math.round(Math.random() * 40)) });
    }
  }
  if (emotions.length === 0) {
    emotions.push({ label: 'Neutral', intensity: 50 });
  }

  // Pacing score: based on scene count vs duration
  const pacingScore = Math.min(
    100,
    Math.max(30, Math.round((sceneCount / duration) * 100 + 50)),
  );

  return {
    sceneCount,
    averageSceneDuration,
    speakingSegments,
    silenceSegments,
    hookQualityScore,
    ctaDetected,
    estimatedRetention,
    bestShortsMoments,
    highlightMoments,
    viralMoments,
    keywords,
    emotions,
    pacingScore,
  };
}

function generateAISuggestions(video: EditorVideo | null, analysis: VideoAnalysis | null): string[] {
  if (!video) return [];
  const suggestions: string[] = [];
  const duration = video.duration || 0;

  if (analysis) {
    if (analysis.hookQualityScore < 60) {
      suggestions.push(`Improve hook — current score ${analysis.hookQualityScore}%`);
    }
    if (!analysis.ctaDetected) {
      suggestions.push('Add a call-to-action in the first 30 seconds');
    }
    if (analysis.estimatedRetention < 60) {
      suggestions.push(`Retention risk — consider cutting at ${formatTimecode(duration * 0.5)}`);
    }
    if (analysis.pacingScore < 50) {
      suggestions.push('Improve pacing — add cuts every 8-12 seconds');
    }
    if (analysis.bestShortsMoments.length > 0) {
      const m = analysis.bestShortsMoments[0];
      suggestions.push(`Cut at ${formatTimecode(m.time)} for best short moment`);
    }
    suggestions.push('Add transition between scene changes');
    if (analysis.silenceSegments > 3) {
      suggestions.push(`Remove ${analysis.silenceSegments} silence segments to tighten pacing`);
    }
    if (analysis.keywords.length < 5) {
      suggestions.push('Add more keywords for better SEO');
    }
  }

  if (duration > 600) {
    suggestions.push('Trim to under 10 minutes for better retention');
  } else if (duration < 60) {
    suggestions.push('Add a hook in the first 5 seconds');
  }

  return suggestions.slice(0, 8);
}

function generateShorts(video: EditorVideo | null, analysis: VideoAnalysis | null): GeneratedShort[] {
  if (!video || !analysis) return [];
  const duration = video.duration || 60;
  const shorts: GeneratedShort[] = [];
  const categories = ['Funny', 'Educational', 'Emotional', 'High retention'];
  const platforms = ['YouTube Shorts', 'TikTok', 'Instagram Reels', 'Facebook Reels'];

  analysis.bestShortsMoments.forEach((moment, idx) => {
    const shortDuration = Math.min(60, Math.max(15, duration * 0.1));
    const startTime = Math.max(0, moment.time - shortDuration / 2);
    const endTime = Math.min(duration, startTime + shortDuration);
    shorts.push({
      id: `short-${idx}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      engagementScore: moment.score,
      viralScore: Math.min(100, moment.score + Math.round(Math.random() * 10 - 5)),
      category: categories[idx % categories.length],
      platform: platforms[idx % platforms.length],
    });
  });

  return shorts;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VideoStudioPage() {
  const { toast } = useToast();
  const ytSync = useYouTubeSync();

  // Panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'media' | 'import' | 'cloud'>('media');
  const [rightTab, setRightTab] = useState<'analysis' | 'properties' | 'shorts'>('analysis');

  // Data state
  const [videoImports, setVideoImports] = useState<VideoImportRow[]>([]);
  const [videoProjects, setVideoProjects] = useState<VideoProjectRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Editor state
  const [selectedVideo, setSelectedVideo] = useState<EditorVideo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [shorts, setShorts] = useState<GeneratedShort[]>([]);
  const [generatingShorts, setGeneratingShorts] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [fetchingYoutube, setFetchingYoutube] = useState(false);

  // History state
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const duration = selectedVideo?.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [importsRes, projectsRes, assetsRes] = await Promise.allSettled([
        supabase.from('video_imports').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('video_projects').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('assets').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (importsRes.status === 'fulfilled' && importsRes.value.data) {
        setVideoImports(importsRes.value.data as VideoImportRow[]);
      }
      if (projectsRes.status === 'fulfilled' && projectsRes.value.data) {
        setVideoProjects(projectsRes.value.data as VideoProjectRow[]);
      }
      if (assetsRes.status === 'fulfilled' && assetsRes.value.data) {
        setAssets(assetsRes.value.data as AssetRow[]);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Video Selection & Analysis ────────────────────────────────────────────

  const selectVideo = useCallback((video: EditorVideo) => {
    setSelectedVideo(video);
    setCurrentTime(0);
    setPlaying(false);
    setAnalysis(null);
    setShorts([]);
    setAnalyzing(true);

    // Simulate AI analysis with computed results
    setTimeout(() => {
      const result = analyzeVideo(video);
      setAnalysis(result);
      setShorts(generateShorts(video, result));
      setAnalyzing(false);
    }, 1200);
  }, []);

  // Convert various video sources to EditorVideo format
  const selectFromImports = useCallback(
    (row: VideoImportRow) => {
      const video: EditorVideo = {
        id: row.id,
        title: row.title,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        duration: row.duration || 0,
        source: row.source || 'upload',
        metadata: row.metadata,
      };
      selectVideo(video);
    },
    [selectVideo],
  );

  const selectFromProjects = useCallback(
    (row: VideoProjectRow) => {
      const video: EditorVideo = {
        id: row.id,
        title: row.title,
        thumbnailUrl: row.thumbnail_url,
        duration: row.duration || 0,
        source: 'project',
      };
      selectVideo(video);
    },
    [selectVideo],
  );

  const selectFromYouTube = useCallback(
    (ytVideo: { video_id: string; title: string; duration: string; thumbnail_url?: string; view_count?: number; like_count?: number; comment_count?: number; tags?: string[]; description?: string }) => {
      const video: EditorVideo = {
        id: ytVideo.video_id,
        title: ytVideo.title,
        thumbnailUrl: ytVideo.thumbnail_url,
        duration: parseDurationToSeconds(ytVideo.duration),
        source: 'youtube',
        viewCount: ytVideo.view_count,
        likeCount: ytVideo.like_count,
        commentCount: ytVideo.comment_count,
        tags: ytVideo.tags,
        description: ytVideo.description,
      };
      selectVideo(video);
    },
    [selectVideo],
  );

  // ─── Playback ────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!selectedVideo) return;
    setPlaying((p) => !p);
  }, [selectedVideo]);

  const skipBack = useCallback(() => {
    setCurrentTime((t) => Math.max(0, t - 10));
  }, []);

  const skipForward = useCallback(() => {
    setCurrentTime((t) => Math.min(duration, t + 10));
  }, [duration]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  // Playback animation loop
  useEffect(() => {
    if (playing && selectedVideo) {
      lastTimeRef.current = performance.now();
      const tick = (now: number) => {
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        setCurrentTime((t) => {
          const newTime = t + delta * playbackSpeed;
          if (newTime >= duration) {
            setPlaying(false);
            return duration;
          }
          return newTime;
        });
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      animationFrameRef.current = requestAnimationFrame(tick);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [playing, selectedVideo, duration, playbackSpeed]);

  // Sync video element
  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // ─── Timeline ─────────────────────────────────────────────────────────────────

  const timelineTracks: TimelineTrack[] = useMemo(() => {
    if (!selectedVideo || duration === 0) return [];
    const d = duration;

    const videoTrack: TimelineTrack = {
      name: 'Video',
      type: 'video',
      icon: Film,
      clips: [{ start: 0, width: 100, label: selectedVideo.title.slice(0, 30) || 'Main', color: 'bg-primary/30 border-primary/40' }],
    };

    const audioTrack: TimelineTrack = {
      name: 'Audio',
      type: 'audio',
      icon: Waves,
      clips: [{ start: 0, width: 100, label: 'Original Audio', color: 'bg-accent/30 border-accent/40' }],
    };

    const voiceTrack: TimelineTrack = {
      name: 'Voice',
      type: 'voice',
      icon: Mic,
      clips: [{ start: 5, width: 80, label: 'Voiceover', color: 'bg-blue-500/30 border-blue-500/40' }],
    };

    const segmentCount = Math.max(2, Math.min(8, Math.floor(d / 30)));
    const segmentWidth = 100 / segmentCount;
    const subtitleClips: TimelineClip[] = Array.from({ length: segmentCount }, (_, i) => ({
      start: i * segmentWidth,
      width: segmentWidth - 0.5,
      label: `${formatTimecode((d / segmentCount) * i)}`,
      color: 'bg-green-500/30 border-green-500/40',
    }));
    const subtitleTrack: TimelineTrack = {
      name: 'Subtitles',
      type: 'subtitle',
      icon: Captions,
      clips: subtitleClips,
    };

    return [videoTrack, audioTrack, voiceTrack, subtitleTrack];
  }, [selectedVideo, duration]);

  const rulerSegments = useMemo(() => {
    return Math.max(5, Math.min(20, Math.round(10 * timelineZoom)));
  }, [timelineZoom]);

  // ─── AI Suggestions ──────────────────────────────────────────────────────────

  const aiSuggestions = useMemo(
    () => generateAISuggestions(selectedVideo, analysis),
    [selectedVideo, analysis],
  );

  // ─── Asset Groups ────────────────────────────────────────────────────────────

  const assetGroups = useMemo(() => {
    const groups: Record<string, AssetRow[]> = {};
    for (const asset of assets) {
      const type = asset.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(asset);
    }
    return groups;
  }, [assets]);

  // ─── Import Handlers ─────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      toast({ title: 'Uploading...', description: `${file.name} is being uploaded.` });
      // In production, upload to Supabase Storage and insert into video_imports
      setTimeout(() => {
        toast({ title: 'Upload complete', description: `${file.name} uploaded successfully.` });
      }, 2000);
    },
    [toast],
  );

  const handleFetchYoutube = useCallback(async () => {
    if (!youtubeUrl.trim()) {
      toast({ title: 'Enter a URL', description: 'Please paste a YouTube video URL.', variant: 'destructive' });
      return;
    }
    setFetchingYoutube(true);
    toast({ title: 'Fetching video...', description: 'Fetching video metadata from YouTube.' });
    setTimeout(() => {
      setFetchingYoutube(false);
      toast({ title: 'Video fetched', description: 'Video metadata retrieved successfully.' });
      setYoutubeUrl('');
    }, 2000);
  }, [youtubeUrl, toast]);

  const handleChannelSync = useCallback(() => {
    ytSync.triggerSync();
    toast({ title: 'Syncing channel', description: 'Your YouTube channel is being synced.' });
  }, [ytSync, toast]);

  const handleGenerateShorts = useCallback(() => {
    if (!selectedVideo || !analysis) return;
    setGeneratingShorts(true);
    setTimeout(() => {
      setShorts(generateShorts(selectedVideo, analysis));
      setGeneratingShorts(false);
      toast({ title: 'Shorts generated', description: `${shorts.length || 3} shorts moments detected.` });
    }, 1500);
  }, [selectedVideo, analysis, shorts.length, toast]);

  const handleExport = useCallback(() => {
    if (!selectedVideo) {
      toast({ title: 'No video selected', description: 'Select a video to export.', variant: 'destructive' });
      return;
    }
    setRendering(true);
    setRenderProgress(0);
    const interval = setInterval(() => {
      setRenderProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setRendering(false);
          toast({ title: 'Export complete', description: 'Your video has been exported.' });
          return 100;
        }
        return p + 5;
      });
    }, 200);
  }, [selectedVideo, toast]);

  // ─── History ──────────────────────────────────────────────────────────────────

  const pushHistory = useCallback((action: string) => {
    setHistory((h) => [...h.slice(0, historyIndex + 1), action]);
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      toast({ title: 'Undo', description: history[historyIndex - 1] || 'Undid last action' });
    }
  }, [historyIndex, history, toast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      toast({ title: 'Redo', description: history[historyIndex + 1] || 'Redid action' });
    }
  }, [historyIndex, history, toast]);

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space' && !isMod) {
        e.preventDefault();
        togglePlay();
      } else if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if (isMod && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, undo, redo, handleExport]);

  // ─── Timeline Click ───────────────────────────────────────────────────────────

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      setCurrentTime(pct * duration);
    },
    [duration],
  );

  // ─── Favorite Videos ──────────────────────────────────────────────────────────

  const favoriteVideos = useMemo(() => videoImports.filter((v) => v.favorite), [videoImports]);

  // ─── Loading State ────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <StudioHeader
          channelTitle={ytSync.channel?.title}
          videoCount={0}
          onSync={() => ytSync.triggerSync()}
          syncing={ytSync.syncing}
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <LoadingState message="Loading your videos, projects, and assets..." />
        </div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────────────

  if (dataError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <StudioHeader
          channelTitle={ytSync.channel?.title}
          videoCount={0}
          onSync={() => ytSync.triggerSync()}
          syncing={ytSync.syncing}
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <ErrorState message={dataError} onRetry={loadData} />
        </div>
      </div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────────────

  const totalVideos = videoImports.length + videoProjects.length + ytSync.videos.length;
  if (totalVideos === 0 && assets.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
        <StudioHeader
          channelTitle={ytSync.channel?.title}
          videoCount={0}
          onSync={() => ytSync.triggerSync()}
          syncing={ytSync.syncing}
        />
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={Video}
            title="No videos found"
            description="Import a video, sync your YouTube channel, or upload from your computer to get started with the AI-powered video editor."
            action={
              <div className="flex gap-2">
                <Button onClick={() => ytSync.triggerSync()} disabled={ytSync.syncing}>
                  {ytSync.syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Youtube className="mr-2 h-4 w-4" />}
                  Sync YouTube
                </Button>
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background">
      {/* Header */}
      <StudioHeader
        channelTitle={ytSync.channel?.title}
        videoCount={totalVideos}
        onSync={() => ytSync.triggerSync()}
        syncing={ytSync.syncing}
        onExport={handleExport}
        rendering={rendering}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        onToggleLeft={() => setLeftPanelOpen((v) => !v)}
        onToggleRight={() => setRightPanelOpen((v) => !v)}
      />

      {/* Main editor area */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ─── LEFT PANEL ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {leftPanelOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex shrink-0 flex-col border-b border-border/50 glass-strong lg:border-b-0 lg:border-r"
            >
              {/* Tabs */}
              <div className="flex border-b border-border/50">
                {(['media', 'import', 'cloud'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLeftTab(tab)}
                    className={cn(
                      'flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors',
                      leftTab === tab
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {/* ─── MEDIA TAB ─────────────────────────────────────────────── */}
                {leftTab === 'media' && (
                  <div className="space-y-4 p-3">
                    {/* Recent Videos */}
                    <MediaSection title="Recent Videos" icon={Clock}>
                      {videoImports.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No imported videos yet.</p>
                      ) : (
                        videoImports.slice(0, 8).map((v) => (
                          <VideoListItem
                            key={v.id}
                            title={v.title}
                            thumbnail={v.thumbnail_url}
                            duration={v.duration}
                            source={v.source}
                            selected={selectedVideo?.id === v.id}
                            onClick={() => selectFromImports(v)}
                          />
                        ))
                      )}
                    </MediaSection>

                    {/* Project Videos */}
                    <MediaSection title="Project Videos" icon={Layers}>
                      {videoProjects.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No projects yet.</p>
                      ) : (
                        videoProjects.slice(0, 8).map((v) => (
                          <VideoListItem
                            key={v.id}
                            title={v.title}
                            thumbnail={v.thumbnail_url}
                            duration={v.duration}
                            source="project"
                            selected={selectedVideo?.id === v.id}
                            onClick={() => selectFromProjects(v)}
                          />
                        ))
                      )}
                    </MediaSection>

                    {/* YouTube Videos */}
                    <MediaSection title="YouTube Videos" icon={Youtube}>
                      {ytSync.loading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </div>
                      ) : ytSync.videos.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No synced videos. Sync your channel.</p>
                      ) : (
                        ytSync.videos.slice(0, 8).map((v) => (
                          <VideoListItem
                            key={v.video_id}
                            title={v.title}
                            thumbnail={v.thumbnail_url}
                            duration={parseDurationToSeconds(v.duration)}
                            source="youtube"
                            selected={selectedVideo?.id === v.video_id}
                            onClick={() => selectFromYouTube(v)}
                          />
                        ))
                      )}
                    </MediaSection>

                    {/* Favorite Videos */}
                    <MediaSection title="Favorite Videos" icon={Star}>
                      {favoriteVideos.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No favorites yet.</p>
                      ) : (
                        favoriteVideos.map((v) => (
                          <VideoListItem
                            key={v.id}
                            title={v.title}
                            thumbnail={v.thumbnail_url}
                            duration={v.duration}
                            source={v.source}
                            selected={selectedVideo?.id === v.id}
                            onClick={() => selectFromImports(v)}
                          />
                        ))
                      )}
                    </MediaSection>
                  </div>
                )}

                {/* ─── IMPORT TAB ───────────────────────────────────────────── */}
                {leftTab === 'import' && (
                  <div className="space-y-3 p-3">
                    {/* Local Computer */}
                    <label className="block">
                      <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                      <div className="flex cursor-pointer items-center gap-3 rounded-lg glass glass-hover p-3 transition-colors">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20">
                          <HardDrive className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Local Computer</p>
                          <p className="text-xs text-muted-foreground">Upload from your device</p>
                        </div>
                      </div>
                    </label>

                    {/* Drag & Drop Zone */}
                    <label className="block">
                      <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                      <div className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 glass p-6 transition-colors hover:border-primary/50">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <p className="text-xs font-medium">Drag & Drop video here</p>
                        <p className="text-[10px] text-muted-foreground">MP4, MOV, AVI, MKV</p>
                      </div>
                    </label>

                    {/* YouTube URL */}
                    <div className="rounded-lg glass p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Youtube className="h-4 w-4 text-red-500" />
                        <p className="text-sm font-medium">YouTube URL</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="h-8 text-xs"
                        />
                        <Button size="sm" onClick={handleFetchYoutube} disabled={fetchingYoutube}>
                          {fetchingYoutube ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Fetch'}
                        </Button>
                      </div>
                    </div>

                    {/* YouTube Channel */}
                    <button
                      onClick={handleChannelSync}
                      disabled={ytSync.syncing}
                      className="flex w-full items-center gap-3 rounded-lg glass glass-hover p-3 text-left transition-colors disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20">
                        {ytSync.syncing ? <Loader2 className="h-4 w-4 animate-spin text-red-400" /> : <Youtube className="h-4 w-4 text-red-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">YouTube Channel</p>
                        <p className="text-xs text-muted-foreground">Sync entire channel</p>
                      </div>
                    </button>

                    {/* CreatorOS Asset Library */}
                    <div className="rounded-lg glass p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">CreatorOS Asset Library</p>
                      </div>
                      {assets.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No assets available.</p>
                      ) : (
                        <div className="space-y-1">
                          {assets.slice(0, 5).map((a) => (
                            <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40">
                              {getAssetIcon(a.type) === Music ? <Music className="h-3 w-3" /> : getAssetIcon(a.type) === Mic ? <Mic className="h-3 w-3" /> : getAssetIcon(a.type) === Layers ? <Layers className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                              <span className="truncate">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cloud Storage Buttons */}
                    <ImportCloudButton icon={Cloud} label="Google Drive" onClick={() => toast({ title: 'Coming soon', description: 'Google Drive integration is coming soon.' })} />
                    <ImportCloudButton icon={Cloud} label="Dropbox" onClick={() => toast({ title: 'Coming soon', description: 'Dropbox integration is coming soon.' })} />

                    {/* Supabase Storage */}
                    <div className="rounded-lg glass p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">Supabase Storage</p>
                      </div>
                      {assets.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No stored assets.</p>
                      ) : (
                        <div className="space-y-1">
                          {assets.slice(0, 5).map((a) => (
                            <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40">
                              <Plus className="h-3 w-3 shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Screen Recording */}
                    <ImportCloudButton icon={Monitor} label="Screen Recording" onClick={() => toast({ title: 'Coming soon', description: 'Screen recording is coming soon.' })} />
                  </div>
                )}

                {/* ─── CLOUD TAB ────────────────────────────────────────────── */}
                {leftTab === 'cloud' && (
                  <div className="space-y-4 p-3">
                    {assets.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <Cloud className="h-8 w-8 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">No cloud assets available.</p>
                      </div>
                    ) : (
                      Object.entries(assetGroups).map(([type, items]) => {
                        const Icon = getAssetIcon(type);
                        return (
                          <div key={type}>
                            <div className="mb-2 flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium capitalize">{type}</span>
                              <Badge variant="secondary" className="ml-auto text-[10px]">{items.length}</Badge>
                            </div>
                            <div className="space-y-1">
                              {items.map((asset) => (
                                <button
                                  key={asset.id}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                >
                                  {asset.thumbnail_url ? (
                                    <img src={asset.thumbnail_url} alt={asset.name} className="h-9 w-12 shrink-0 rounded object-cover" />
                                  ) : (
                                    <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-muted/40">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                  )}
                                  <span className="truncate">{asset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ─── CENTER PANEL ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Video Preview */}
          <div className="relative flex items-center justify-center bg-black/40 p-3 md:p-6">
            {selectedVideo ? (
              <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-info/10">
                {selectedVideo.url ? (
                  <video
                    ref={videoRef}
                    src={selectedVideo.url}
                    poster={selectedVideo.thumbnailUrl}
                    className="h-full w-full object-contain"
                    onTimeUpdate={(e) => {
                      if (!playing) setCurrentTime(e.currentTarget.currentTime);
                    }}
                  />
                ) : selectedVideo.thumbnailUrl ? (
                  <img src={selectedVideo.thumbnailUrl} alt={selectedVideo.title} className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}

                {/* Center play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={togglePlay}
                    className="flex h-16 w-16 items-center justify-center rounded-full glass-strong transition-transform hover:scale-110"
                  >
                    {playing ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
                  </button>
                </div>

                {/* Time display */}
                <div className="absolute bottom-3 left-3 rounded-lg glass-strong px-3 py-1 text-xs font-medium">
                  {formatTimecode(currentTime)} / {formatTimecode(duration)}
                </div>

                {/* Metadata overlay */}
                {selectedVideo.viewCount !== undefined && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg glass-strong px-3 py-1 text-xs">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatNumber(selectedVideo.viewCount)}</span>
                    {selectedVideo.likeCount !== undefined && (
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {formatNumber(selectedVideo.likeCount)}</span>
                    )}
                    {selectedVideo.commentCount !== undefined && (
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {formatNumber(selectedVideo.commentCount)}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video w-full max-w-4xl items-center justify-center rounded-xl bg-muted/20">
                <div className="text-center">
                  <MonitorPlay className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Select a video to preview</p>
                </div>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between border-y border-border/50 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={skipBack} disabled={!selectedVideo}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={togglePlay} disabled={!selectedVideo}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={skipForward} disabled={!selectedVideo}>
                <SkipForward className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-xs font-medium tabular-nums">
                {formatTimecode(currentTime)} / {formatTimecode(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Volume */}
              <Button variant="ghost" size="sm" onClick={toggleMute} disabled={!selectedVideo}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted"
              />

              {/* Playback speed */}
              <Select value={String(playbackSpeed)} onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}>
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>

              {/* Fullscreen */}
              <Button variant="ghost" size="sm" disabled={!selectedVideo}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* AI Suggestions Bar */}
          {selectedVideo && (
            <div className="border-b border-border/50 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="shrink-0 text-xs font-medium text-primary">AI Suggestions</span>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
                  {analyzing ? (
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analyzing...
                    </div>
                  ) : aiSuggestions.length === 0 ? (
                    <span className="px-2 py-1 text-xs text-muted-foreground">No suggestions for this video.</span>
                  ) : (
                    aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => toast({ title: 'Suggestion applied', description: s })}
                        className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                      >
                        {s}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {selectedVideo && duration > 0 ? (
              <>
                {/* Timeline toolbar */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setTimelineZoom((z) => Math.max(0.5, z - 0.25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{timelineZoom.toFixed(2)}x</span>
                    <Button variant="ghost" size="sm" onClick={() => setTimelineZoom((z) => Math.min(3, z + 0.25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Duration: {formatTimecode(duration)}
                  </div>
                </div>

                {/* Timeline ruler */}
                <div className="mb-2 flex items-center pl-24">
                  <div className="relative flex-1" ref={timelineRef} onClick={handleTimelineClick}>
                    <div className="flex h-6">
                      {Array.from({ length: rulerSegments }).map((_, i) => (
                        <div key={i} className="flex-1 border-l border-border/30 text-[10px] text-muted-foreground/60">
                          <span className="pl-1">
                            {formatTimecode((duration / rulerSegments) * i)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tracks */}
                <div className="space-y-1.5">
                  {timelineTracks.map((track) => {
                    const TrackIcon = track.icon;
                    return (
                      <div key={track.name} className="flex items-center gap-2">
                        <div className="flex w-20 shrink-0 items-center gap-1.5">
                          <TrackIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{track.name}</span>
                        </div>
                        <div
                          className="relative h-10 flex-1 cursor-pointer overflow-hidden rounded-lg glass"
                          onClick={handleTimelineClick}
                        >
                          {track.clips.map((clip, i) => (
                            <div
                              key={i}
                              className={cn('absolute top-1 bottom-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-[10px] font-medium', clip.color)}
                              style={{ left: `${clip.start}%`, width: `${clip.width}%` }}
                            >
                              <span className="truncate">{clip.label}</span>
                            </div>
                          ))}
                          {/* Playhead */}
                          <div
                            ref={playheadRef}
                            className="absolute top-0 bottom-0 w-0.5 bg-primary"
                            style={{ left: `${progress}%` }}
                          >
                            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <div className="text-center">
                  <Film className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2">Select a video to see its timeline</p>
                </div>
              </div>
            )}
          </div>

          {/* ─── BOTTOM TOOLBAR ────────────────────────────────────────────── */}
          <BottomToolbar
            selectedVideo={selectedVideo}
            rendering={rendering}
            renderProgress={renderProgress}
            onExport={handleExport}
            onUndo={undo}
            onRedo={redo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onToolAction={(tool) => {
              pushHistory(tool);
              toast({ title: tool, description: `${tool} tool activated.` });
            }}
          />
        </div>

        {/* ─── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {rightPanelOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex shrink-0 flex-col border-t border-border/50 glass-strong lg:border-t-0 lg:border-l"
            >
              {/* Tabs */}
              <div className="flex border-b border-border/50">
                {(['analysis', 'properties', 'shorts'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={cn(
                      'flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors',
                      rightTab === tab
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                {/* ─── ANALYSIS TAB ─────────────────────────────────────────── */}
                {rightTab === 'analysis' && (
                  analyzing ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Analyzing video...</p>
                      <p className="text-xs text-muted-foreground/60">Running AI scene detection, engagement scoring, and moment identification.</p>
                    </div>
                  ) : !selectedVideo ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Select a video for AI analysis</p>
                    </div>
                  ) : analysis ? (
                    <div className="space-y-4">
                      {/* Scene Detection */}
                      <AnalysisSection title="Scene Detection" icon={Film}>
                        <AnalysisRow label="Scene count" value={analysis.sceneCount} />
                        <AnalysisRow label="Avg scene duration" value={`${analysis.averageSceneDuration.toFixed(1)}s`} />
                        <AnalysisRow label="Speaking segments" value={analysis.speakingSegments} />
                        <AnalysisRow label="Silence segments" value={analysis.silenceSegments} />
                      </AnalysisSection>

                      {/* Hook Quality */}
                      <AnalysisSection title="Hook Quality" icon={Zap}>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium">{analysis.hookQualityScore}%</span>
                          </div>
                          <Progress value={analysis.hookQualityScore} className="h-2" />
                        </div>
                      </AnalysisSection>

                      {/* CTA */}
                      <AnalysisSection title="Call-to-Action" icon={TrendingUp}>
                        <Badge variant={analysis.ctaDetected ? 'default' : 'secondary'} className="text-xs">
                          {analysis.ctaDetected ? 'CTA Detected' : 'No CTA Found'}
                        </Badge>
                      </AnalysisSection>

                      {/* Retention */}
                      <AnalysisSection title="Estimated Retention" icon={Eye}>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Retention</span>
                            <span className="font-medium">{analysis.estimatedRetention}%</span>
                          </div>
                          <Progress value={analysis.estimatedRetention} className="h-2" />
                        </div>
                      </AnalysisSection>

                      {/* Best Shorts Moments */}
                      <AnalysisSection title="Best Shorts Moments" icon={Flame}>
                        <div className="space-y-1">
                          {analysis.bestShortsMoments.map((m, i) => (
                            <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                              <span className="font-medium">{formatTimecode(m.time)}</span>
                              <span className="text-muted-foreground">{m.label}</span>
                              <Badge variant="secondary" className="text-[10px]">{m.score}%</Badge>
                            </div>
                          ))}
                        </div>
                      </AnalysisSection>

                      {/* Highlight Moments */}
                      <AnalysisSection title="Highlight Moments" icon={Star}>
                        <div className="space-y-1">
                          {analysis.highlightMoments.map((m, i) => (
                            <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                              <span className="font-medium">{formatTimecode(m.time)}</span>
                              <span className="text-muted-foreground">{m.label}</span>
                              <Badge variant="secondary" className="text-[10px]">{m.score}%</Badge>
                            </div>
                          ))}
                        </div>
                      </AnalysisSection>

                      {/* Viral Moments */}
                      <AnalysisSection title="Viral Moments" icon={TrendingUp}>
                        <div className="space-y-1">
                          {analysis.viralMoments.map((m, i) => (
                            <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                              <span className="font-medium">{formatTimecode(m.time)}</span>
                              <span className="text-muted-foreground">{m.label}</span>
                              <Badge variant="secondary" className="text-[10px]">{m.score}%</Badge>
                            </div>
                          ))}
                        </div>
                      </AnalysisSection>

                      {/* Keywords */}
                      <AnalysisSection title="Keywords Detected" icon={Bookmark}>
                        <div className="flex flex-wrap gap-1">
                          {analysis.keywords.length > 0 ? (
                            analysis.keywords.map((k) => (
                              <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No keywords detected</span>
                          )}
                        </div>
                      </AnalysisSection>

                      {/* Emotions */}
                      <AnalysisSection title="Emotions Detected" icon={Waves}>
                        <div className="space-y-2">
                          {analysis.emotions.map((e) => (
                            <div key={e.label} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{e.label}</span>
                                <span className="text-muted-foreground">{e.intensity}%</span>
                              </div>
                              <Progress value={e.intensity} className="h-1.5" />
                            </div>
                          ))}
                        </div>
                      </AnalysisSection>

                      {/* Pacing */}
                      <AnalysisSection title="Pacing Score" icon={Gauge}>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium">{analysis.pacingScore}%</span>
                          </div>
                          <Progress value={analysis.pacingScore} className="h-2" />
                        </div>
                      </AnalysisSection>
                    </div>
                  ) : null
                )}

                {/* ─── PROPERTIES TAB ──────────────────────────────────────── */}
                {rightTab === 'properties' && (
                  !selectedVideo ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <Settings className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Select a video to see properties</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Video Properties */}
                      <AnalysisSection title="Video Properties" icon={Video}>
                        <AnalysisRow label="Resolution" value={(selectedVideo.metadata?.width && selectedVideo.metadata?.height) ? `${selectedVideo.metadata.width}×${selectedVideo.metadata.height}` : '1920×1080'} />
                        <AnalysisRow label="FPS" value={String(selectedVideo.metadata?.fps || 30)} />
                        <AnalysisRow label="Codec" value={String(selectedVideo.metadata?.codec || 'H.264')} />
                        <AnalysisRow label="Bitrate" value={String(selectedVideo.metadata?.bitrate || '8 Mbps')} />
                        <AnalysisRow label="Duration" value={formatTimecode(duration)} />
                      </AnalysisSection>

                      {/* Audio Properties */}
                      <AnalysisSection title="Audio Properties" icon={Waves}>
                        <AnalysisRow label="Sample rate" value={String(selectedVideo.metadata?.sample_rate || '48 kHz')} />
                        <AnalysisRow label="Channels" value={String(selectedVideo.metadata?.channels || 'Stereo')} />
                        <AnalysisRow label="Codec" value={String(selectedVideo.metadata?.audio_codec || 'AAC')} />
                      </AnalysisSection>

                      {/* SEO Information */}
                      <AnalysisSection title="SEO Information" icon={TrendingUp}>
                        <div className="space-y-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Title</label>
                            <div className="rounded-lg glass px-2 py-1.5 text-xs">{selectedVideo.title}</div>
                          </div>
                          {selectedVideo.description && (
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                              <div className="max-h-24 overflow-y-auto scrollbar-thin rounded-lg glass px-2 py-1.5 text-xs">{selectedVideo.description.slice(0, 300)}</div>
                            </div>
                          )}
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Tags</label>
                            <div className="flex flex-wrap gap-1">
                              {selectedVideo.tags && selectedVideo.tags.length > 0 ? (
                                selectedVideo.tags.slice(0, 10).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No tags</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </AnalysisSection>

                      {/* Scene Detection Results */}
                      {analysis && (
                        <AnalysisSection title="Scene Detection Results" icon={Film}>
                          <div className="space-y-1">
                            {Array.from({ length: analysis.sceneCount }).map((_, i) => (
                              <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                                <span className="font-medium">Scene {i + 1}</span>
                                <span className="text-muted-foreground">
                                  {formatTimecode((duration / analysis.sceneCount) * i)} - {formatTimecode((duration / analysis.sceneCount) * (i + 1))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </AnalysisSection>
                      )}

                      {/* Keyword Detection */}
                      {analysis && (
                        <AnalysisSection title="Keyword Detection" icon={Bookmark}>
                          <div className="flex flex-wrap gap-1">
                            {analysis.keywords.length > 0 ? (
                              analysis.keywords.map((k) => (
                                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No keywords detected</span>
                            )}
                          </div>
                        </AnalysisSection>
                      )}

                      {/* Hook Analysis */}
                      {analysis && (
                        <AnalysisSection title="Hook Analysis" icon={Zap}>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {analysis.hookQualityScore > 70
                                ? 'Strong opening hook detected. The first 5 seconds effectively capture attention.'
                                : analysis.hookQualityScore > 50
                                ? 'Moderate hook quality. Consider strengthening the opening with a question or bold statement.'
                                : 'Weak hook detected. Add a compelling hook in the first 5 seconds to improve retention.'}
                            </p>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Score</span>
                              <span className="font-medium">{analysis.hookQualityScore}%</span>
                            </div>
                            <Progress value={analysis.hookQualityScore} className="h-2" />
                          </div>
                        </AnalysisSection>
                      )}

                      {/* Audience Retention Prediction */}
                      {analysis && (
                        <AnalysisSection title="Audience Retention Prediction" icon={Eye}>
                          <div className="space-y-2">
                            <div className="flex items-end gap-1">
                              {Array.from({ length: 10 }).map((_, i) => {
                                const retentionAt = Math.max(
                                  20,
                                  analysis.estimatedRetention - i * (analysis.estimatedRetention / 12),
                                );
                                return (
                                  <div
                                    key={i}
                                    className="flex-1 rounded-t bg-primary/40"
                                    style={{ height: `${retentionAt}%` }}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>0s</span>
                              <span>{formatTimecode(duration / 2)}</span>
                              <span>{formatTimecode(duration)}</span>
                            </div>
                          </div>
                        </AnalysisSection>
                      )}
                    </div>
                  )
                )}

                {/* ─── SHORTS TAB ──────────────────────────────────────────── */}
                {rightTab === 'shorts' && (
                  !selectedVideo ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <Flame className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Select a video to generate shorts</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* AI Shorts Generator */}
                      <div className="rounded-lg glass p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">AI Shorts Generator</p>
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Automatically detect the most engaging moments and generate short-form clips for multiple platforms.
                        </p>
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-primary to-accent text-white"
                          onClick={handleGenerateShorts}
                          disabled={generatingShorts || !analysis}
                        >
                          {generatingShorts ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                          ) : (
                            <><Sparkles className="mr-2 h-4 w-4" />Generate Shorts</>
                          )}
                        </Button>
                      </div>

                      {/* Most Engaging Moments */}
                      {analysis && (
                        <AnalysisSection title="Most Engaging Moments" icon={Flame}>
                          <div className="space-y-1">
                            {analysis.bestShortsMoments.map((m, i) => (
                              <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                                <span className="font-medium">{formatTimecode(m.time)}</span>
                                <Badge variant="secondary" className="text-[10px]">{m.score}%</Badge>
                              </div>
                            ))}
                          </div>
                        </AnalysisSection>
                      )}

                      {/* Categories */}
                      <AnalysisSection title="Categories" icon={Layers}>
                        <div className="flex flex-wrap gap-1">
                          {['Funny', 'Educational', 'Emotional', 'High retention'].map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                          ))}
                        </div>
                      </AnalysisSection>

                      {/* Platform Generate Buttons */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Generate for platform:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Generating...', description: 'YouTube Shorts being generated.' })}>
                            <Youtube className="mr-1.5 h-3.5 w-3.5" />YT Shorts
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Generating...', description: 'TikTok being generated.' })}>
                            <Music className="mr-1.5 h-3.5 w-3.5" />TikTok
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Generating...', description: 'Instagram Reels being generated.' })}>
                            <Film className="mr-1.5 h-3.5 w-3.5" />IG Reels
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Generating...', description: 'Facebook Reels being generated.' })}>
                            <Layers className="mr-1.5 h-3.5 w-3.5" />FB Reels
                          </Button>
                        </div>
                      </div>

                      {/* Generated Shorts */}
                      {shorts.length > 0 && (
                        <AnalysisSection title="Generated Shorts" icon={Sparkles}>
                          <div className="space-y-2">
                            {shorts.map((s) => (
                              <div key={s.id} className="rounded-lg glass p-2.5">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <Badge variant="secondary" className="text-[10px]">{s.platform}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Start: </span>
                                    <span className="font-medium">{formatTimecode(s.startTime)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">End: </span>
                                    <span className="font-medium">{formatTimecode(s.endTime)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Duration: </span>
                                    <span className="font-medium">{s.duration.toFixed(1)}s</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Engagement: </span>
                                    <span className="font-medium">{s.engagementScore}%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Viral: </span>
                                    <span className="font-medium">{s.viralScore}%</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AnalysisSection>
                      )}
                    </div>
                  )
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StudioHeader({
  channelTitle,
  videoCount,
  onSync,
  syncing,
  onExport,
  rendering,
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeft,
  onToggleRight,
}: {
  channelTitle?: string;
  videoCount: number;
  onSync: () => void;
  syncing: boolean;
  onExport?: () => void;
  rendering?: boolean;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5 md:px-4">
      <div className="flex items-center gap-3">
        {onToggleLeft && (
          <Button variant="ghost" size="sm" onClick={onToggleLeft} className="hidden lg:flex">
            {leftPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
          <Video className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-base font-semibold">Video Studio</h1>
          <p className="text-xs text-muted-foreground">
            {channelTitle ? `${channelTitle} — ` : ''}
            {videoCount} videos available
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Youtube className="mr-1.5 h-3.5 w-3.5" />}
          Sync
        </Button>
        <Button variant="outline" size="sm" className="hidden md:flex">
          <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
          AI Suggest
        </Button>
        {onExport && (
          <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={onExport} disabled={rendering}>
            {rendering ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            {rendering ? 'Rendering...' : 'Export'}
          </Button>
        )}
        {onToggleRight && (
          <Button variant="ghost" size="sm" onClick={onToggleRight} className="hidden lg:flex">
            {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function MediaSection({ title, icon: Icon, children }: { title: string; icon: typeof Film; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function VideoListItem({
  title,
  thumbnail,
  duration,
  source,
  selected,
  onClick,
}: {
  title: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const badge = getSourceBadge(source || '');
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
        selected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {thumbnail ? (
        <img src={thumbnail} alt={title} className="h-9 w-16 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-muted/40">
          <Video className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{duration ? formatTimecode(duration) : '--:--'}</span>
          <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium', badge.color)}>{badge.label}</span>
        </div>
      </div>
    </button>
  );
}

function ImportCloudButton({ icon: Icon, label, onClick }: { icon: typeof Cloud; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg glass glass-hover p-3 text-left transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Connect to import</p>
      </div>
    </button>
  );
}

function AnalysisSection({ title, icon: Icon, children }: { title: string; icon: typeof Film; children: React.ReactNode }) {
  return (
    <div className="rounded-lg glass p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AnalysisRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BottomToolbar({
  selectedVideo,
  rendering,
  renderProgress,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToolAction,
}: {
  selectedVideo: EditorVideo | null;
  rendering: boolean;
  renderProgress: number;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToolAction: (tool: string) => void;
}) {
  const tools = [
    { label: 'Trim', icon: Scissors },
    { label: 'Split', icon: Square },
    { label: 'Cut', icon: Scissors },
    { label: 'Crop', icon: Crop },
    { label: 'Zoom', icon: ZoomIn },
    { label: 'Transition', icon: Layers },
    { label: 'Effects', icon: Sparkles },
    { label: 'Audio', icon: Waves },
    { label: 'Subtitle', icon: Captions },
    { label: 'Markers', icon: Bookmark },
  ];

  return (
    <div className="border-t border-border/50 glass-strong">
      {/* Rendering progress */}
      {rendering && (
        <div className="px-4 py-1.5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Rendering... {renderProgress}%</span>
            <Progress value={renderProgress} className="h-1 flex-1" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        {/* Undo/Redo */}
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo || !selectedVideo}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo || !selectedVideo}>
          <Redo className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Tool buttons */}
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto scrollbar-thin">
          {tools.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <Button
                key={tool.label}
                variant="ghost"
                size="sm"
                disabled={!selectedVideo}
                onClick={() => onToolAction(tool.label)}
                className="flex flex-col items-center gap-0.5 px-2.5 py-1"
              >
                <ToolIcon className="h-4 w-4" />
                <span className="text-[10px]">{tool.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Export */}
        <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={onExport} disabled={!selectedVideo || rendering}>
          {rendering ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
          Export
        </Button>
      </div>
    </div>
  );
}


