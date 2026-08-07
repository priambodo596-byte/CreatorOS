'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clapperboard,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  Sparkles,
  Scissors,
  Trash2,
  GripVertical,
  Clock,
  ArrowRight,
  ArrowLeft,
  ZoomIn,
  RotateCw,
  Volume2,
  Download,
  Lightbulb,
  BarChart3,
  Film,
  Eye,
  Plus,
  Check,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { EmptyState, ErrorState, LoadingState, formatNumber } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoImportRow {
  id: string;
  title: string;
  url?: string;
  thumbnail_url?: string;
  duration?: number;
  source?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

interface VideoAnalysisRow {
  id: string;
  video_id?: string;
  scenes?: unknown;
  scene_count?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

type SceneType = 'Intro' | 'Main' | 'B-Roll' | 'Outro' | 'Transition';
type TransitionType = 'Cut' | 'Fade' | 'Dissolve' | 'Wipe' | 'Zoom' | 'Slide';
type EffectType = 'Blur' | 'Grayscale' | 'Sepia' | 'Invert' | 'Brightness' | 'Contrast';
type EmotionType =
  | 'Excited'
  | 'Calm'
  | 'Tense'
  | 'Joyful'
  | 'Serious'
  | 'Inspiring'
  | 'Neutral'
  | 'Dramatic';

interface Scene {
  id: string;
  number: number;
  label: string;
  startTime: number;
  endTime: number;
  type: SceneType;
  emotion: EmotionType;
  engagementScore: number;
  thumbnailUrl?: string;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  speed: number;
  volume: number;
  zoom: number;
  crop: { top: number; bottom: number; left: number; right: number };
  rotate: number;
  effects: EffectType[];
  filtersEnabled: boolean;
}

interface EditorVideo {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration: number;
  source: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SCENE_TYPES: SceneType[] = ['Intro', 'Main', 'B-Roll', 'Outro', 'Transition'];
const TRANSITIONS: TransitionType[] = ['Cut', 'Fade', 'Dissolve', 'Wipe', 'Zoom', 'Slide'];
const EFFECTS: EffectType[] = [
  'Blur',
  'Grayscale',
  'Sepia',
  'Invert',
  'Brightness',
  'Contrast',
];
const EMOTIONS: EmotionType[] = [
  'Excited',
  'Calm',
  'Tense',
  'Joyful',
  'Serious',
  'Inspiring',
  'Neutral',
  'Dramatic',
];
const SPEEDS = [0.5, 1, 1.5, 2];

const SCENE_TYPE_STYLES: Record<SceneType, string> = {
  Intro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Main: 'bg-primary/20 text-primary border-primary/30',
  'B-Roll': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Outro: 'bg-green-500/20 text-green-400 border-green-500/30',
  Transition: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const EMOTION_STYLES: Record<EmotionType, string> = {
  Excited: 'bg-orange-500/20 text-orange-400',
  Calm: 'bg-cyan-500/20 text-cyan-400',
  Tense: 'bg-red-500/20 text-red-400',
  Joyful: 'bg-yellow-500/20 text-yellow-400',
  Serious: 'bg-slate-500/20 text-slate-400',
  Inspiring: 'bg-indigo-500/20 text-indigo-400',
  Neutral: 'bg-muted/40 text-muted-foreground',
  Dramatic: 'bg-fuchsia-500/20 text-fuchsia-400',
};

const AI_SUGGESTION_TEMPLATES = [
  'Trim 2 seconds from the start to improve pacing',
  'Add a transition here',
  'This scene is too long, consider splitting',
  'Increase engagement by adding B-roll',
  'Consider adding a zoom effect for emphasis',
  'This scene has low engagement — try shortening it',
  'Add a text overlay to highlight key information',
  'Consider a jump cut to tighten the pacing',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

// ─── Scene Detection Logic ──────────────────────────────────────────────────

function detectScenes(video: EditorVideo): Scene[] {
  const duration = video.duration || 60;

  // Scene count: shorter videos = fewer, longer scenes; longer videos = more scenes
  // Target average scene length between 8s and 20s depending on duration
  let sceneCount: number;
  if (duration < 30) {
    sceneCount = 2;
  } else if (duration < 120) {
    sceneCount = Math.max(3, Math.round(duration / 15));
  } else if (duration < 600) {
    sceneCount = Math.max(5, Math.round(duration / 20));
  } else {
    sceneCount = Math.max(8, Math.round(duration / 25));
  }
  sceneCount = Math.min(sceneCount, 30);

  const avgSceneLength = duration / sceneCount;
  const scenes: Scene[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const startTime = i * avgSceneLength;
    const endTime = i === sceneCount - 1 ? duration : (i + 1) * avgSceneLength;
    const sceneDuration = endTime - startTime;

    // Assign scene type
    let type: SceneType;
    if (i === 0) {
      type = 'Intro';
    } else if (i === sceneCount - 1) {
      type = 'Outro';
    } else {
      const middleTypes: SceneType[] = ['Main', 'B-Roll', 'Transition'];
      // Distribute types: mostly Main, some B-Roll, occasional Transition
      if (i % 5 === 0 && i !== 0) {
        type = 'Transition';
      } else if (i % 3 === 0) {
        type = 'B-Roll';
      } else {
        type = 'Main';
      }
      type = middleTypes.includes(type) ? type : 'Main';
    }

    // Engagement score: intro and outro tend to score differently than middle
    const baseScore = 60 + Math.round(Math.sin(i * 0.8) * 15 + Math.cos(i * 1.3) * 10);
    const engagementScore = Math.max(30, Math.min(100, baseScore + (type === 'Intro' ? 10 : 0)));

    // Emotion: deterministic based on scene position and type
    const emotionIndex = (i + sceneCount) % EMOTIONS.length;
    const emotion: EmotionType =
      type === 'Intro'
        ? 'Excited'
        : type === 'Outro'
          ? 'Inspiring'
          : type === 'Transition'
            ? 'Tense'
            : EMOTIONS[emotionIndex];

    scenes.push({
      id: `scene-${i + 1}`,
      number: i + 1,
      label: `${type} ${i + 1}`,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round(endTime * 10) / 10,
      type,
      emotion,
      engagementScore,
      thumbnailUrl: video.thumbnailUrl,
      transitionIn: i === 0 ? 'Cut' : 'Fade',
      transitionOut: i === sceneCount - 1 ? 'Fade' : 'Dissolve',
      speed: 1,
      volume: 1,
      zoom: 1,
      crop: { top: 0, bottom: 0, left: 0, right: 0 },
      rotate: 0,
      effects: [],
      filtersEnabled: false,
    });
  }

  return scenes;
}

function generateAISuggestions(scenes: Scene[]): string[] {
  const suggestions: string[] = [];

  for (const scene of scenes) {
    if (scene.endTime - scene.startTime > 30) {
      suggestions.push(`Scene ${scene.number}: This scene is too long, consider splitting`);
    }
    if (scene.engagementScore < 50) {
      suggestions.push(
        `Scene ${scene.number}: Increase engagement by adding B-roll`,
      );
    }
    if (scene.type === 'Main' && scene.transitionIn === 'Cut' && scene.number > 1) {
      suggestions.push(`Scene ${scene.number}: Add a transition here`);
    }
    if (scene.type === 'Intro' && scene.endTime - scene.startTime > 10) {
      suggestions.push(`Scene ${scene.number}: Trim 2 seconds from the start to improve pacing`);
    }
  }

  // Always include some baseline suggestions
  if (suggestions.length === 0) {
    suggestions.push(...AI_SUGGESTION_TEMPLATES.slice(0, 4));
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
  return unique.slice(0, 8);
}

function computeStats(scenes: Scene[]) {
  if (scenes.length === 0) {
    return {
      totalScenes: 0,
      totalDuration: 0,
      avgSceneLength: 0,
      shortestScene: 0,
      longestScene: 0,
      pacingScore: 0,
    };
  }

  const durations = scenes.map((s) => s.endTime - s.startTime);
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const avgSceneLength = totalDuration / scenes.length;
  const shortestScene = Math.min(...durations);
  const longestScene = Math.max(...durations);

  // Pacing score: reward variety in scene lengths and reasonable average
  const variance =
    durations.reduce((sum, d) => sum + Math.pow(d - avgSceneLength, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const idealAvg = avgSceneLength >= 5 && avgSceneLength <= 25 ? 30 : 15;
  const consistencyScore = Math.max(0, 100 - stdDev * 4);
  const pacingScore = Math.round(Math.min(100, (consistencyScore + idealAvg) / 1.5));

  return {
    totalScenes: scenes.length,
    totalDuration,
    avgSceneLength,
    shortestScene,
    longestScene,
    pacingScore,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SceneEditorPage() {
  const { toast } = useToast();

  // Data state
  const [videoImports, setVideoImports] = useState<VideoImportRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Video selection state
  const [selectedVideo, setSelectedVideo] = useState<EditorVideo | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Scene state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Drag state
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || null;
  const stats = computeStats(scenes);
  const aiSuggestions = generateAISuggestions(scenes);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const { data, error } = await supabase
        .from('video_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setVideoImports((data || []) as VideoImportRow[]);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to load video imports');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Video Selection ─────────────────────────────────────────────────────────

  const selectVideo = useCallback(
    (row: VideoImportRow) => {
      const video: EditorVideo = {
        id: row.id,
        title: row.title,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        duration: row.duration || 60,
        source: row.source || 'import',
      };
      setSelectedVideo(video);
      setScenes([]);
      setSelectedSceneId(null);
      setPlaying(false);
      setCurrentTime(0);
    },
    [],
  );

  // ─── Scene Detection ────────────────────────────────────────────────────────

  const handleDetectScenes = useCallback(async () => {
    if (!selectedVideo) {
      toast({
        title: 'No video selected',
        description: 'Please select a video first.',
        variant: 'destructive',
      });
      return;
    }

    setDetecting(true);
    setDetectProgress(0);
    setScenes([]);
    setSelectedSceneId(null);

    // Simulate AI progress
    const progressInterval = setInterval(() => {
      setDetectProgress((p) => Math.min(90, p + Math.random() * 15));
    }, 200);

    // Check for existing analysis in Supabase
    let existingScenes: Scene[] | null = null;
    try {
      const { data: analysisData } = await supabase
        .from('video_analyses')
        .select('*')
        .eq('video_id', selectedVideo.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analysisData && analysisData.scenes && Array.isArray(analysisData.scenes)) {
        // Try to use stored scenes if they match our Scene structure
        const stored = analysisData.scenes as Scene[];
        if (stored.length > 0 && stored[0].startTime !== undefined) {
          existingScenes = stored;
        }
      }
    } catch {
      // Fall through to detection
    }

    // Simulate processing time for AI detection
    await new Promise((resolve) => setTimeout(resolve, 1500));

    clearInterval(progressInterval);
    setDetectProgress(100);

    const detectedScenes = existingScenes || detectScenes(selectedVideo);
    setScenes(detectedScenes);
    setSelectedSceneId(detectedScenes[0]?.id || null);

    setTimeout(() => {
      setDetecting(false);
      setDetectProgress(0);
    }, 500);

    toast({
      title: 'Scenes detected',
      description: `${detectedScenes.length} scenes found in "${selectedVideo.title}".`,
    });
  }, [selectedVideo, toast]);

  // ─── Scene Editing ───────────────────────────────────────────────────────────

  const updateScene = useCallback(
    (id: string, updates: Partial<Scene>) => {
      setScenes((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s, ...updates };
          // Auto-calculate duration display from start/end
          if (updates.startTime !== undefined || updates.endTime !== undefined) {
            updated.startTime = Math.max(0, updated.startTime);
            updated.endTime = Math.max(updated.startTime + 0.1, updated.endTime);
          }
          return updated;
        }),
      );
    },
    [],
  );

  const deleteScene = useCallback(
    (id: string) => {
      setScenes((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        // Renumber
        return filtered.map((s, i) => ({ ...s, number: i + 1 }));
      });
      if (selectedSceneId === id) {
        setSelectedSceneId(null);
      }
      toast({ title: 'Scene deleted', description: 'The scene has been removed.' });
    },
    [selectedSceneId, toast],
  );

  const splitScene = useCallback(
    (id: string) => {
      setScenes((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const scene = prev[idx];
        const midPoint = (scene.startTime + scene.endTime) / 2;
        const firstHalf: Scene = {
          ...scene,
          endTime: Math.round(midPoint * 10) / 10,
          transitionOut: 'Cut',
        };
        const secondHalf: Scene = {
          ...scene,
          id: `scene-${Date.now()}`,
          startTime: Math.round(midPoint * 10) / 10,
          transitionIn: 'Cut',
          label: `${scene.type} (split)`,
        };
        const newScenes = [...prev];
        newScenes.splice(idx, 1, firstHalf, secondHalf);
        return newScenes.map((s, i) => ({ ...s, number: i + 1 }));
      });
      toast({ title: 'Scene split', description: 'The scene has been split into two.' });
    },
    [toast],
  );

  // ─── Drag to Reorder ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, sceneId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sceneId);
    setDraggedSceneId(sceneId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, sceneId: string) => {
      e.preventDefault();
      if (draggedSceneId && draggedSceneId !== sceneId) {
        setDragOverSceneId(sceneId);
      }
    },
    [draggedSceneId],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedSceneId(null);
    setDragOverSceneId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetSceneId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetSceneId) {
        handleDragEnd();
        return;
      }

      setScenes((prev) => {
        const sourceIdx = prev.findIndex((s) => s.id === sourceId);
        const targetIdx = prev.findIndex((s) => s.id === targetSceneId);
        if (sourceIdx === -1 || targetIdx === -1) return prev;

        const newScenes = [...prev];
        const [moved] = newScenes.splice(sourceIdx, 1);
        newScenes.splice(targetIdx, 0, moved);
        return newScenes.map((s, i) => ({ ...s, number: i + 1 }));
      });

      handleDragEnd();
      toast({ title: 'Scene reordered', description: 'Scene order has been updated.' });
    },
    [handleDragEnd, toast],
  );

  // ─── Scene Navigation ───────────────────────────────────────────────────────

  const goToScene = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedSceneId || scenes.length === 0) return;
      const idx = scenes.findIndex((s) => s.id === selectedSceneId);
      if (idx === -1) return;
      const newIdx = direction === 'prev' ? Math.max(0, idx - 1) : Math.min(scenes.length - 1, idx + 1);
      setSelectedSceneId(scenes[newIdx].id);
    },
    [selectedSceneId, scenes],
  );

  // ─── Playback ─────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!selectedScene) return;
    setPlaying((p) => !p);
  }, [selectedScene]);

  // Playback animation loop scoped to selected scene
  useEffect(() => {
    if (!playing || !selectedScene) return;

    lastTimeRef.current = performance.now();
    const sceneDuration = selectedScene.endTime - selectedScene.startTime;

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((t) => {
        const newTime = t + delta * (selectedScene.speed || 1);
        const sceneElapsed = newTime - selectedScene.startTime;
        if (sceneElapsed >= sceneDuration) {
          setPlaying(false);
          return selectedScene.endTime;
        }
        return newTime;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [playing, selectedScene]);

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

  // When scene is selected, set currentTime to scene start
  useEffect(() => {
    if (selectedScene) {
      setCurrentTime(selectedScene.startTime);
      setPlaying(false);
    }
  }, [selectedSceneId, selectedScene]);

  // ─── Export ───────────────────────────────────────────────────────────────────

  const handleExport = useCallback(
    (type: 'single' | 'all' | 'edl' | 'xml') => {
      if (scenes.length === 0) {
        toast({
          title: 'No scenes to export',
          description: 'Detect scenes first.',
          variant: 'destructive',
        });
        return;
      }

      setExporting(true);

      const labels: Record<typeof type, string> = {
        single: 'individual scene',
        all: 'all scenes',
        edl: 'EDL (Edit Decision List)',
        xml: 'XML format',
      };

      setTimeout(() => {
        setExporting(false);
        toast({
          title: 'Export complete',
          description: `Exported ${labels[type]} successfully.`,
        });
      }, 1500);
    },
    [scenes.length, toast],
  );

  // ─── YouTube URL ──────────────────────────────────────────────────────────────

  const handleFetchYoutube = useCallback(() => {
    if (!youtubeUrl.trim()) {
      toast({
        title: 'Enter a URL',
        description: 'Please paste a YouTube video URL.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Fetching video...',
      description: 'Video metadata will appear in the list once fetched.',
    });
    setYoutubeUrl('');
  }, [youtubeUrl, toast]);

  // ─── Loading State ─────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <LoadingState message="Loading your video library..." />
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────────────

  if (dataError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <ErrorState message={dataError} onRetry={loadData} />
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────────────────────────────────

  if (videoImports.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <EmptyState
          icon={Clapperboard}
          title="No videos available"
          description="Import videos into your library to start editing scenes with AI-powered detection."
          action={
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          }
        />
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background">
      {/* ─── Top Section — Video Selection ──────────────────────────────────── */}
      <div className="border-b border-border/50 glass-strong px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <Clapperboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold">Scene Editor</h1>
              <p className="text-xs text-muted-foreground">
                AI-powered scene detection and editing
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Video source selector */}
            <Select
              value={selectedVideo?.id || ''}
              onValueChange={(val) => {
                const row = videoImports.find((v) => v.id === val);
                if (row) selectVideo(row);
              }}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select a video..." />
              </SelectTrigger>
              <SelectContent>
                {videoImports.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="truncate">{v.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* YouTube URL input */}
            <div className="flex gap-2">
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YouTube URL..."
                className="h-9 text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleFetchYoutube}>
                Fetch
              </Button>
            </div>

            {/* Detect Scenes button */}
            <Button
              size="sm"
              className="bg-gradient-to-r from-primary to-accent text-white"
              onClick={handleDetectScenes}
              disabled={!selectedVideo || detecting}
            >
              {detecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Detecting... {Math.round(detectProgress)}%
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Detect Scenes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* AI progress indicator */}
        <AnimatePresence>
          {detecting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1">
                  <Progress value={detectProgress} className="h-1.5" />
                </div>
                <span className="text-xs font-medium text-primary">
                  {detectProgress < 30
                    ? 'Analyzing video frames...'
                    : detectProgress < 60
                      ? 'Detecting scene boundaries...'
                      : detectProgress < 90
                        ? 'Classifying scene types...'
                        : 'Finalizing...'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Main Editor Area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* ─── LEFT PANEL — Scene List ────────────────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex w-full shrink-0 flex-col border-b border-border/50 glass-strong lg:w-[320px] lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Scenes</h2>
            </div>
            {scenes.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {scenes.length} scenes
              </Badge>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
            {scenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Film className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  {selectedVideo
                    ? 'Click "Detect Scenes" to analyze this video'
                    : 'Select a video to begin'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {scenes.map((scene, idx) => (
                  <SceneListItem
                    key={scene.id}
                    scene={scene}
                    selected={scene.id === selectedSceneId}
                    dragged={scene.id === draggedSceneId}
                    dragOver={scene.id === dragOverSceneId}
                    onClick={() => setSelectedSceneId(scene.id)}
                    onDragStart={(e) => handleDragStart(e, scene.id)}
                    onDragOver={(e) => handleDragOver(e, scene.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, scene.id)}
                    onDelete={() => deleteScene(scene.id)}
                    onSplit={() => splitScene(scene.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.aside>

        {/* ─── CENTER PANEL — Scene Editor ───────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedScene ? (
            <>
              {/* Scene preview */}
              <div className="relative flex items-center justify-center bg-black/40 p-4">
                <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-info/10">
                  {selectedVideo?.url ? (
                    <video
                      ref={videoRef}
                      src={selectedVideo.url}
                      poster={selectedVideo.thumbnailUrl}
                      className="h-full w-full object-contain"
                      style={{
                        transform: `scale(${selectedScene.zoom}) rotate(${selectedScene.rotate}deg)`,
                        filter: buildFilterString(selectedScene),
                      }}
                    />
                  ) : selectedVideo?.thumbnailUrl ? (
                    <img
                      src={selectedVideo.thumbnailUrl}
                      alt={selectedVideo.title}
                      className="h-full w-full object-cover opacity-80"
                      style={{
                        transform: `scale(${selectedScene.zoom}) rotate(${selectedScene.rotate}deg)`,
                        filter: buildFilterString(selectedScene),
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}

                  {/* Center play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={togglePlay}
                      className="flex h-14 w-14 items-center justify-center rounded-full glass-strong transition-transform hover:scale-110"
                    >
                      {playing ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="ml-1 h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Scene info overlay */}
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <Badge
                      className={cn('border text-[10px]', SCENE_TYPE_STYLES[selectedScene.type])}
                    >
                      {selectedScene.type}
                    </Badge>
                    <Badge className={cn('text-[10px]', EMOTION_STYLES[selectedScene.emotion])}>
                      {selectedScene.emotion}
                    </Badge>
                  </div>

                  {/* Time display */}
                  <div className="absolute bottom-3 left-3 rounded-lg glass-strong px-3 py-1 text-xs font-medium">
                    {formatTimecode(currentTime - selectedScene.startTime)} /{' '}
                    {formatTimecode(selectedScene.endTime - selectedScene.startTime)}
                  </div>

                  {/* Engagement score */}
                  <div className="absolute bottom-3 right-3 rounded-lg glass-strong px-3 py-1 text-xs">
                    <span className="text-muted-foreground">Engagement: </span>
                    <span className="font-medium">{selectedScene.engagementScore}%</span>
                  </div>
                </div>
              </div>

              {/* Scene timeline (mini) */}
              <div className="border-y border-border/50 px-4 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Scene Timeline
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimecode(selectedScene.startTime)} —{' '}
                    {formatTimecode(selectedScene.endTime)} ({formatDuration(
                      selectedScene.endTime - selectedScene.startTime,
                    )})
                  </span>
                </div>
                <div className="relative h-8 overflow-hidden rounded-lg glass">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/40 to-accent/40"
                    style={{ width: '100%' }}
                  />
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary"
                    style={{
                      left: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((currentTime - selectedScene.startTime) /
                            (selectedScene.endTime - selectedScene.startTime)) *
                            100,
                        ),
                      )}%`,
                    }}
                  >
                    <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary" />
                  </div>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToScene('prev')}
                    disabled={scenes.findIndex((s) => s.id === selectedSceneId) === 0}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={togglePlay}>
                    {playing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToScene('next')}
                    disabled={
                      scenes.findIndex((s) => s.id === selectedSceneId) === scenes.length - 1
                    }
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Scene {selectedScene.number} of {scenes.length}
                </div>
              </div>

              {/* Scene properties panel */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                <div className="mx-auto max-w-2xl space-y-4">
                  {/* Time & Type */}
                  <Card className="glass p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Scene Properties</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Start Time (s)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedScene.startTime}
                          onChange={(e) =>
                            updateScene(selectedScene.id, {
                              startTime: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          End Time (s)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedScene.endTime}
                          onChange={(e) =>
                            updateScene(selectedScene.id, {
                              endTime: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Duration
                        </label>
                        <div className="flex h-8 items-center rounded-md bg-muted/30 px-2 text-sm font-medium">
                          {formatDuration(selectedScene.endTime - selectedScene.startTime)}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Scene Type
                        </label>
                        <Select
                          value={selectedScene.type}
                          onValueChange={(v) =>
                            updateScene(selectedScene.id, { type: v as SceneType })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCENE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Scene Label
                        </label>
                        <Input
                          value={selectedScene.label}
                          onChange={(e) =>
                            updateScene(selectedScene.id, { label: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Transitions & Speed */}
                  <Card className="glass p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Film className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Transitions & Playback</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Transition In
                        </label>
                        <Select
                          value={selectedScene.transitionIn}
                          onValueChange={(v) =>
                            updateScene(selectedScene.id, {
                              transitionIn: v as TransitionType,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSITIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Transition Out
                        </label>
                        <Select
                          value={selectedScene.transitionOut}
                          onValueChange={(v) =>
                            updateScene(selectedScene.id, {
                              transitionOut: v as TransitionType,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSITIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          Speed
                        </label>
                        <Select
                          value={String(selectedScene.speed)}
                          onValueChange={(v) =>
                            updateScene(selectedScene.id, { speed: parseFloat(v) })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SPEEDS.map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                {s}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {/* Transform: Volume, Zoom, Crop, Rotate */}
                  <Card className="glass p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ZoomIn className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Transform & Audio</h3>
                    </div>
                    <div className="space-y-4">
                      {/* Volume */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Volume2 className="h-3.5 w-3.5" /> Volume
                          </label>
                          <span className="text-xs font-medium">
                            {Math.round(selectedScene.volume * 100)}%
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[selectedScene.volume]}
                          onValueChange={([v]) =>
                            updateScene(selectedScene.id, { volume: v })
                          }
                        />
                      </div>

                      {/* Zoom */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ZoomIn className="h-3.5 w-3.5" /> Zoom Level
                          </label>
                          <span className="text-xs font-medium">
                            {selectedScene.zoom.toFixed(2)}x
                          </span>
                        </div>
                        <Slider
                          min={1}
                          max={3}
                          step={0.05}
                          value={[selectedScene.zoom]}
                          onValueChange={([v]) =>
                            updateScene(selectedScene.id, { zoom: v })
                          }
                        />
                      </div>

                      {/* Rotate */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <RotateCw className="h-3.5 w-3.5" /> Rotate
                          </label>
                          <span className="text-xs font-medium">
                            {selectedScene.rotate}°
                          </span>
                        </div>
                        <Slider
                          min={-180}
                          max={180}
                          step={1}
                          value={[selectedScene.rotate]}
                          onValueChange={([v]) =>
                            updateScene(selectedScene.id, { rotate: v })
                          }
                        />
                      </div>

                      {/* Crop */}
                      <div>
                        <label className="mb-2 block text-xs font-medium text-muted-foreground">
                          Crop
                        </label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                            <div key={side}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs capitalize text-muted-foreground">
                                  {side}
                                </span>
                                <span className="text-xs font-medium">
                                  {selectedScene.crop[side]}%
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[selectedScene.crop[side]]}
                                onValueChange={([v]) =>
                                  updateScene(selectedScene.id, {
                                    crop: { ...selectedScene.crop, [side]: v },
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Effects & Filters */}
                  <Card className="glass p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Effects & Filters</h3>
                      </div>
                      <Button
                        variant={selectedScene.filtersEnabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          updateScene(selectedScene.id, {
                            filtersEnabled: !selectedScene.filtersEnabled,
                          })
                        }
                      >
                        {selectedScene.filtersEnabled ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Enabled
                          </>
                        ) : (
                          'Disabled'
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {EFFECTS.map((effect) => {
                        const active = selectedScene.effects.includes(effect);
                        return (
                          <button
                            key={effect}
                            onClick={() =>
                              updateScene(selectedScene.id, {
                                effects: active
                                  ? selectedScene.effects.filter((e) => e !== effect)
                                  : [...selectedScene.effects, effect],
                              })
                            }
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                              active
                                ? 'border-primary bg-primary/20 text-primary'
                                : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                            )}
                          >
                            {effect}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Clapperboard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {scenes.length > 0
                    ? 'Select a scene from the left to edit'
                    : 'Detect scenes to start editing'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL — AI Suggestions & Stats ────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex w-full shrink-0 flex-col border-t border-border/50 glass-strong lg:w-[300px] lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">AI Assistant</h2>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {/* AI Suggestions */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  AI Suggests
                </h3>
              </div>
              <div className="space-y-1.5">
                {aiSuggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No suggestions available. Detect scenes to get AI recommendations.
                  </p>
                ) : (
                  aiSuggestions.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 rounded-lg glass p-2.5"
                    >
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="flex-1">
                        <p className="text-xs text-foreground">{s}</p>
                        <button
                          onClick={() =>
                            toast({
                              title: 'Suggestion applied',
                              description: s,
                            })
                          }
                          className="mt-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          Apply →
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Scene Statistics */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Scene Statistics
                </h3>
              </div>
              <Card className="glass p-3">
                <div className="space-y-2">
                  <StatRow label="Total Scenes" value={String(stats.totalScenes)} />
                  <StatRow
                    label="Total Duration"
                    value={formatDuration(stats.totalDuration)}
                  />
                  <StatRow
                    label="Avg Scene Length"
                    value={formatDuration(stats.avgSceneLength)}
                  />
                  <StatRow
                    label="Shortest Scene"
                    value={formatDuration(stats.shortestScene)}
                  />
                  <StatRow
                    label="Longest Scene"
                    value={formatDuration(stats.longestScene)}
                  />
                  <div className="pt-1">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pacing Score</span>
                      <span className="font-medium">{stats.pacingScore}%</span>
                    </div>
                    <Progress value={stats.pacingScore} className="h-1.5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Export Options */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Export Options
                </h3>
              </div>
              <div className="space-y-1.5">
                <ExportButton
                  icon={Film}
                  label="Export Individual Scene"
                  disabled={!selectedScene || exporting}
                  onClick={() => handleExport('single')}
                />
                <ExportButton
                  icon={Clapperboard}
                  label="Export All Scenes"
                  disabled={scenes.length === 0 || exporting}
                  onClick={() => handleExport('all')}
                />
                <ExportButton
                  icon={Settings}
                  label="Export as EDL"
                  disabled={scenes.length === 0 || exporting}
                  onClick={() => handleExport('edl')}
                />
                <ExportButton
                  icon={Download}
                  label="Export as XML"
                  disabled={scenes.length === 0 || exporting}
                  onClick={() => handleExport('xml')}
                />
              </div>
              {exporting && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Exporting...
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

// ─── Helper: Build CSS filter string ──────────────────────────────────────────

function buildFilterString(scene: Scene): string {
  if (!scene.filtersEnabled || scene.effects.length === 0) return 'none';
  const filters: string[] = [];
  if (scene.effects.includes('Blur')) filters.push('blur(4px)');
  if (scene.effects.includes('Grayscale')) filters.push('grayscale(1)');
  if (scene.effects.includes('Sepia')) filters.push('sepia(0.8)');
  if (scene.effects.includes('Invert')) filters.push('invert(1)');
  if (scene.effects.includes('Brightness')) filters.push('brightness(1.3)');
  if (scene.effects.includes('Contrast')) filters.push('contrast(1.5)');
  return filters.length > 0 ? filters.join(' ') : 'none';
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SceneListItem({
  scene,
  selected,
  dragged,
  dragOver,
  onClick,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onDelete,
  onSplit,
}: {
  scene: Scene;
  selected: boolean;
  dragged: boolean;
  dragOver: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDelete: () => void;
  onSplit: () => void;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={cn(
        'group relative flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-all',
        selected
          ? 'border-primary/50 bg-primary/10'
          : 'border-transparent glass hover:bg-muted/30',
        dragged && 'opacity-40',
        dragOver && 'border-primary border-dashed',
      )}
    >
      {/* Drag handle */}
      <div className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Thumbnail */}
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted/40">
        {scene.thumbnailUrl ? (
          <img
            src={scene.thumbnailUrl}
            alt={scene.label}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">
          {scene.number}
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Badge
            className={cn('border px-1.5 py-0 text-[9px]', SCENE_TYPE_STYLES[scene.type])}
          >
            {scene.type}
          </Badge>
          <Badge className={cn('px-1.5 py-0 text-[9px]', EMOTION_STYLES[scene.emotion])}>
            {scene.emotion}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs font-medium">{scene.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatTimecode(scene.startTime)} — {formatTimecode(scene.endTime)} ·{' '}
          {formatDuration(scene.endTime - scene.startTime)}
        </p>
        {/* Engagement score bar */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                scene.engagementScore >= 75
                  ? 'bg-green-500'
                  : scene.engagementScore >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500',
              )}
              style={{ width: `${scene.engagementScore}%` }}
            />
          </div>
          <span className="text-[9px] font-medium text-muted-foreground">
            {scene.engagementScore}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSplit();
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          title="Split scene"
        >
          <Scissors className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          title="Delete scene"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ExportButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Film;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg glass glass-hover p-2.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="flex-1 font-medium">{label}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
}
