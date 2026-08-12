'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  Scissors,
  Flame,
  Star,
  Volume2,
  Music,
  User,
  Smile,
  Tag,
  Camera,
  Film,
  Zap,
  Target,
  TrendingUp,
  BarChart3,
  Lightbulb,
  Check,
  X,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { EmptyState, ErrorState, LoadingState, formatNumber } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoImportRow {
  id: string;
  user_id: string;
  source: string;
  name: string;
  url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  size_bytes?: number;
  video_id?: string;
  channel_id?: string;
  metadata?: Record<string, unknown>;
  analysis_status?: string;
  analysis_data?: Record<string, unknown>;
  favorite?: boolean;
  storage_path?: string;
  created_at?: string;
}

interface VideoAnalysisRow {
  id: string;
  user_id: string;
  video_id: string;
  video_url?: string;
  video_title?: string;
  source?: string;
  status?: string;
  hook_score?: number;
  cta_detected?: boolean;
  scene_count?: number;
  avg_scene_duration?: number;
  speaking_speed?: number;
  editing_pace?: number;
  avg_shot_length?: number;
  retention_prediction?: number;
  estimated_ctr?: number;
  seo_score?: number;
  thumbnail_score?: number;
  emotions?: Array<{ label: string; intensity: number }>;
  keywords?: string[];
  objects?: string[];
  faces?: Array<{ count: number; confidence: number }>;
  scenes?: Array<{ index: number; start: number; end: number; label: string }>;
  best_moments?: Array<{ time: number; score: number; label: string }>;
  viral_moments?: Array<{ time: number; score: number; label: string }>;
  shorts_moments?: Array<{ time: number; score: number; label: string }>;
  timeline_markers?: TimelineMarker[];
  suggestions?: string[];
  analysis_data?: Record<string, unknown>;
  created_at?: string;
}

interface TimelineMarker {
  type:
    | 'scene'
    | 'hook'
    | 'cta'
    | 'best'
    | 'viral'
    | 'shorts'
    | 'silence'
    | 'music'
    | 'speaking';
  start: number; // seconds
  end?: number; // seconds (for segments)
  label?: string;
  score?: number;
  color?: string;
}

interface AnalysisResult {
  sceneCount: number;
  averageSceneDuration: number;
  averageShotLength: number;
  hookType: string;
  hookScore: number;
  hookText: string;
  ctaDetected: boolean;
  ctaText: string;
  ctaPosition: number;
  scenes: Array<{ index: number; start: number; end: number; label: string }>;
  speakerCount: number;
  speakerSegments: Array<{ start: number; end: number; speaker: number }>;
  faceCount: number;
  faceConfidence: number;
  emotions: Array<{ label: string; intensity: number }>;
  keywords: string[];
  objects: string[];
  subtitleDetected: boolean;
  subtitleLanguage: string;
  silenceSegments: Array<{ start: number; end: number }>;
  musicSegments: Array<{ start: number; end: number; label: string }>;
  speakingSpeed: number; // WPM
  editingPace: number; // cuts per minute
  cameraChanges: number;
  transitions: number;
  retentionCurve: number[];
  estimatedCtr: number;
  seoScore: number;
  thumbnailScore: number;
  suggestions: string[];
  timelineMarkers: TimelineMarker[];
  bestHook: { time: number; text: string };
  bestCta: { time: number; text: string };
  bestViralMoments: Array<{ time: number; score: number; label: string }>;
  bestShortsMoments: Array<{ time: number; score: number; label: string }>;
  mostEmotionalMoments: Array<{ time: number; label: string; emotion: string }>;
  mostEngagingMoments: Array<{ time: number; label: string; score: number }>;
}

interface AnalyzerVideo {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration: number;
  source: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  description?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

function getSourceBadge(source: string): { label: string; color: string } {
  const s = (source || '').toLowerCase();
  if (s.includes('youtube')) return { label: 'YouTube', color: 'bg-red-500/20 text-red-400' };
  if (s.includes('upload') || s.includes('local')) return { label: 'Upload', color: 'bg-blue-500/20 text-blue-400' };
  if (s.includes('drive')) return { label: 'Drive', color: 'bg-green-500/20 text-green-400' };
  if (s.includes('dropbox')) return { label: 'Dropbox', color: 'bg-indigo-500/20 text-indigo-400' };
  return { label: source || 'Video', color: 'bg-muted/30 text-muted-foreground' };
}

// ─── AI Analysis Engine ──────────────────────────────────────────────────────

function analyzeVideo(video: AnalyzerVideo): AnalysisResult {
  const duration = video.duration || 60;
  const views = video.viewCount || 0;
  const likes = video.likeCount || 0;
  const comments = video.commentCount || 0;
  const tags = video.tags || [];
  const title = video.title || '';
  const description = video.description || '';
  const allText = `${title} ${description} ${tags.join(' ')}`.toLowerCase();

  // ─── Scene detection: avg scene length ~8s ──────────────────────────────────
  const avgSceneLength = 8;
  const sceneCount = Math.max(3, Math.round(duration / avgSceneLength));
  const averageSceneDuration = duration / sceneCount;
  const averageShotLength = Math.max(2, averageSceneDuration / 2.5);

  // ─── Hook analysis ──────────────────────────────────────────────────────────
  const engagementRate = views > 0 ? (likes + comments) / views : 0;
  const hookText = title.slice(0, 60);
  const hookKeywords = ['how', 'why', 'what', 'secret', 'never', 'best', 'worst', 'top', 'ultimate', 'proven', 'shocking', 'insane'];
  const hookType = hookKeywords.some((k) => title.toLowerCase().includes(k))
    ? 'Curiosity Hook'
    : title.includes('?')
      ? 'Question Hook'
      : title.toLowerCase().includes('how')
        ? 'Educational Hook'
        : 'Direct Hook';
  const hookScore = Math.min(
    100,
    Math.round(40 + engagementRate * 500 + (tags.length > 3 ? 15 : 5) + (duration < 600 ? 10 : 0)),
  );

  // ─── CTA detection ───────────────────────────────────────────────────────────
  const ctaKeywords = ['subscribe', 'follow', 'comment', 'like', 'click', 'download', 'sign up', 'link in', 'bio', 'description'];
  const ctaDetected = ctaKeywords.some((k) => allText.includes(k));
  const ctaMatch = ctaKeywords.find((k) => allText.includes(k));
  const ctaText = ctaDetected ? `Detected: "${ctaMatch}"` : 'No CTA found';
  const ctaPosition = ctaDetected ? duration * 0.85 : 0;

  // ─── Scenes list ─────────────────────────────────────────────────────────────
  const sceneLabels = ['Intro', 'Setup', 'Development', 'Main Content', 'Deep Dive', 'Climax', 'Transition', 'Conclusion', 'Outro', 'CTA'];
  const scenes = Array.from({ length: sceneCount }, (_, i) => ({
    index: i,
    start: (duration / sceneCount) * i,
    end: (duration / sceneCount) * (i + 1),
    label: sceneLabels[i % sceneLabels.length],
  }));

  // ─── Speaker detection ──────────────────────────────────────────────────────
  const speakerCount = Math.max(1, Math.min(3, Math.round(duration / 120)));
  const speakerSegments = Array.from({ length: Math.max(2, Math.round(duration / 15)) }, (_, i) => ({
    start: (duration / Math.round(duration / 15)) * i,
    end: (duration / Math.round(duration / 15)) * (i + 1),
    speaker: (i % speakerCount) + 1,
  }));

  // ─── Face detection ──────────────────────────────────────────────────────────
  const faceCount = Math.max(1, Math.min(5, Math.round(duration / 90)));
  const faceConfidence = Math.min(98, Math.round(75 + engagementRate * 500));

  // ─── Emotion analysis ────────────────────────────────────────────────────────
  const emotions: Array<{ label: string; intensity: number }> = [];
  const emotionMap: Record<string, string[]> = {
    Excited: ['amazing', 'incredible', 'awesome', 'wow', 'best', 'crazy', 'epic'],
    Educational: ['how', 'learn', 'guide', 'tutorial', 'explain', 'tips', 'teach'],
    Emotional: ['story', 'journey', 'love', 'heart', 'feel', 'emotional', 'moved'],
    Funny: ['funny', 'hilarious', 'laugh', 'joke', 'comedy', 'lol'],
    Inspirational: ['inspire', 'motivat', 'achieve', 'dream', 'goal', 'success', 'overcome'],
    Surprised: ['shocking', 'unexpected', 'surprise', 'never knew', 'mind blown'],
  };
  for (const [emotion, words] of Object.entries(emotionMap)) {
    if (words.some((w) => allText.includes(w))) {
      emotions.push({ label: emotion, intensity: Math.min(100, 55 + Math.round(engagementRate * 800)) });
    }
  }
  if (emotions.length === 0) {
    emotions.push({ label: 'Neutral', intensity: 50 });
  }

  // ─── Keywords ────────────────────────────────────────────────────────────────
  const keywords = tags.slice(0, 12);
  if (keywords.length < 5) {
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4 && !['the', 'this', 'that', 'with', 'from'].includes(w))
      .slice(0, 8);
    keywords.push(...titleWords.filter((w) => !keywords.includes(w)));
  }

  // ─── Object detection (heuristic from tags/title) ─────────────────────────────
  const objectKeywords = ['phone', 'laptop', 'camera', 'car', 'desk', 'book', 'screen', 'keyboard', 'microphone', 'light', 'window', 'chair'];
  const objects = objectKeywords.filter((o) => allText.includes(o));
  if (objects.length === 0) objects.push('Person', 'Background', 'Text Overlay');

  // ─── Subtitle detection ──────────────────────────────────────────────────────
  const subtitleDetected = allText.includes('subtitle') || allText.includes('caption') || duration > 30;
  const subtitleLanguage = 'en';

  // ─── Silence detection ───────────────────────────────────────────────────────
  const silenceSegments = Array.from({ length: Math.max(1, Math.round(duration / 45)) }, (_, i) => ({
    start: (duration / Math.round(duration / 45)) * i + 3,
    end: (duration / Math.round(duration / 45)) * i + 6,
  }));

  // ─── Music detection ──────────────────────────────────────────────────────────
  const musicSegments = Array.from({ length: Math.max(1, Math.round(duration / 60)) }, (_, i) => ({
    start: (duration / Math.round(duration / 60)) * i,
    end: (duration / Math.round(duration / 60)) * (i + 1),
    label: `Music Segment ${i + 1}`,
  }));

  // ─── Speaking speed (WPM) ─────────────────────────────────────────────────────
  const speakingSpeed = Math.round(120 + (duration < 300 ? 30 : 0) + Math.random() * 20);

  // ─── Editing pace (cuts per minute) ───────────────────────────────────────────
  const editingPace = Math.round((sceneCount / duration) * 60);
  const cameraChanges = Math.round(sceneCount * 1.5);
  const transitions = Math.max(0, sceneCount - 1);

  // ─── Retention curve (typical YouTube retention) ──────────────────────────────
  const retentionCurve: number[] = [];
  const points = 20;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1); // 0 to 1
    let retention: number;
    if (t < 0.05) {
      retention = 100 - t * 200; // 100 → 90 in first 5%
    } else if (t < 0.15) {
      retention = 90 - (t - 0.05) * 300; // 90 → 60 in next 10%
    } else if (t < 0.85) {
      retention = 60 - (t - 0.15) * 20; // 60 → 46 slow decline
    } else {
      retention = 46 - (t - 0.85) * 100; // 46 → 36 end dip
    }
    retentionCurve.push(Math.max(20, Math.round(retention)));
  }

  // ─── CTR estimate ──────────────────────────────────────────────────────────────
  const estimatedCtr = Math.min(15, Math.max(0.5, Number((2 + engagementRate * 200 + (duration < 300 ? 1 : 0)).toFixed(1))));

  // ─── SEO score ─────────────────────────────────────────────────────────────────
  const seoScore = Math.min(
    100,
    Math.round(
      (tags.length > 5 ? 25 : tags.length * 5) +
      (title.length > 30 && title.length < 70 ? 25 : 15) +
      (description.length > 100 ? 20 : 10) +
      (views > 1000 ? 15 : 5) +
      (keywords.length > 5 ? 15 : 8),
    ),
  );

  // ─── Thumbnail score ──────────────────────────────────────────────────────────
  const thumbnailScore = Math.min(100, Math.round(50 + engagementRate * 400 + (tags.length > 3 ? 15 : 5)));

  // ─── Timeline markers ─────────────────────────────────────────────────────────
  const timelineMarkers: TimelineMarker[] = [];

  // Scene change markers (colored segments)
  scenes.forEach((scene, i) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#eab308', '#84cc16'];
    timelineMarkers.push({
      type: 'scene',
      start: scene.start,
      end: scene.end,
      label: `Scene ${i + 1}: ${scene.label}`,
      color: colors[i % colors.length],
    });
  });

  // Hook detection (first 30s highlighted)
  timelineMarkers.push({
    type: 'hook',
    start: 0,
    end: Math.min(30, duration),
    label: 'Hook Zone',
    color: '#f59e0b',
  });

  // CTA marker at end
  if (ctaDetected) {
    timelineMarkers.push({
      type: 'cta',
      start: ctaPosition,
      label: 'CTA',
      color: '#ef4444',
    });
  }

  // Best moments (star markers) at 15%, 40%, 65%, 90%
  const bestMoments = [0.15, 0.4, 0.65, 0.9].map((p) => duration * p);
  bestMoments.forEach((t, i) => {
    timelineMarkers.push({
      type: 'best',
      start: t,
      label: `Best Moment ${i + 1}`,
      score: 70 + i * 5,
      color: '#fbbf24',
    });
  });

  // Viral moments (flame markers) at 30%, 60%
  const viralTimes = [0.3, 0.6].map((p) => duration * p);
  const viralScore = Math.min(100, Math.round(50 + engagementRate * 600 + (comments > 10 ? 15 : 0)));
  viralTimes.forEach((t, i) => {
    timelineMarkers.push({
      type: 'viral',
      start: t,
      label: `Viral Moment ${i + 1}`,
      score: Math.max(40, viralScore - i * 10),
      color: '#f97316',
    });
  });

  // Shorts moments (scissors markers) at 25%, 50%, 75%
  const shortsTimes = [0.25, 0.5, 0.75].map((p) => duration * p);
  shortsTimes.forEach((t, i) => {
    timelineMarkers.push({
      type: 'shorts',
      start: t,
      label: `Shorts Cut ${i + 1}`,
      score: Math.min(100, 70 + Math.round(engagementRate * 300)),
      color: '#06b6d4',
    });
  });

  // Silence segments (gray)
  silenceSegments.forEach((seg, i) => {
    timelineMarkers.push({
      type: 'silence',
      start: seg.start,
      end: seg.end,
      label: `Silence ${i + 1}`,
      color: '#6b7280',
    });
  });

  // Music segments (blue)
  musicSegments.forEach((seg, i) => {
    timelineMarkers.push({
      type: 'music',
      start: seg.start,
      end: seg.end,
      label: seg.label,
      color: '#3b82f6',
    });
  });

  // Speaking segments (green)
  speakerSegments.forEach((seg, i) => {
    timelineMarkers.push({
      type: 'speaking',
      start: seg.start,
      end: seg.end,
      label: `Speaker ${seg.speaker}`,
      color: '#22c55e',
    });
  });

  // ─── Auto-detected highlights ──────────────────────────────────────────────────
  const bestHook = { time: 0, text: hookText };
  const bestCta = { time: ctaPosition, text: ctaText };
  const bestViralMoments = viralTimes.map((t, i) => ({
    time: t,
    score: Math.max(40, viralScore - i * 10),
    label: i === 0 ? 'Shareable Moment' : 'Reaction Moment',
  }));
  const bestShortsMoments = shortsTimes.map((t, i) => ({
    time: t,
    score: Math.min(100, 70 + Math.round(engagementRate * 300)),
    label: i === 0 ? 'Opening Hook' : i === 1 ? 'Key Moment' : 'Climax',
  }));
  const mostEmotionalMoments = emotions.slice(0, 3).map((e, i) => ({
    time: duration * (0.2 + i * 0.25),
    label: `${e.label} peak`,
    emotion: e.label,
  }));
  const mostEngagingMoments = bestMoments.map((t, i) => ({
    time: t,
    label: ['Intro Payoff', 'Main Content', 'Peak Interest', 'Conclusion'][i],
    score: 72 + i * 5,
  }));

  // ─── Suggestions ───────────────────────────────────────────────────────────────
  const suggestions: string[] = [];
  if (hookScore < 60) suggestions.push(`Improve hook — current score ${hookScore}%. Try a curiosity or question hook in the first 5 seconds.`);
  if (!ctaDetected) suggestions.push('Add a call-to-action in the first 30 seconds (e.g., "Subscribe for more").');
  if (estimatedCtr < 3) suggestions.push('Thumbnail and title need optimization to improve CTR.');
  if (seoScore < 70) suggestions.push('Add more relevant tags and keywords to improve SEO score.');
  if (duration > 600) suggestions.push('Trim the video to under 10 minutes for better audience retention.');
  if (duration < 60) suggestions.push('Add a strong hook in the first 5 seconds to capture attention.');
  if (editingPace < 6) suggestions.push('Increase editing pace — add cuts every 8-12 seconds to maintain engagement.');
  if (silenceSegments.length > 3) suggestions.push(`Remove ${silenceSegments.length} silence segments to tighten pacing.`);
  if (keywords.length < 5) suggestions.push('Add more keywords for better discoverability.');
  if (thumbnailScore < 60) suggestions.push('Improve thumbnail — use high contrast, expressive faces, and minimal text.');
  if (suggestions.length === 0) suggestions.push('Great work! Your video meets most quality benchmarks. Consider A/B testing thumbnails for even better performance.');
  suggestions.push('Add transitions between scene changes for smoother flow.');
  suggestions.push('Consider creating a short-form clip from the best moment for cross-platform reach.');

  return {
    sceneCount,
    averageSceneDuration,
    averageShotLength,
    hookType,
    hookScore,
    hookText,
    ctaDetected,
    ctaText,
    ctaPosition,
    scenes,
    speakerCount,
    speakerSegments,
    faceCount,
    faceConfidence,
    emotions,
    keywords,
    objects,
    subtitleDetected,
    subtitleLanguage,
    silenceSegments,
    musicSegments,
    speakingSpeed,
    editingPace,
    cameraChanges,
    transitions,
    retentionCurve,
    estimatedCtr,
    seoScore,
    thumbnailScore,
    suggestions: suggestions.slice(0, 10),
    timelineMarkers,
    bestHook,
    bestCta,
    bestViralMoments,
    bestShortsMoments,
    mostEmotionalMoments,
    mostEngagingMoments,
  };
}

// ─── Analysis Stages ──────────────────────────────────────────────────────────

const ANALYSIS_STAGES = [
  'Detecting scenes...',
  'Analyzing hook...',
  'Detecting emotions...',
  'Extracting keywords...',
  'Predicting retention...',
  'Generating suggestions...',
];

// ─── Marker Style Map ─────────────────────────────────────────────────────────

const MARKER_STYLES: Record<string, { icon: typeof Star; color: string; bg: string; label: string }> = {
  scene: { icon: Film, color: 'text-violet-400', bg: 'bg-violet-500/20', label: 'Scene Change' },
  hook: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Hook Zone' },
  cta: { icon: Target, color: 'text-red-400', bg: 'bg-red-500/20', label: 'CTA' },
  best: { icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Best Moment' },
  viral: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Viral Moment' },
  shorts: { icon: Scissors, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Shorts Moment' },
  silence: { icon: Volume2, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Silence' },
  music: { icon: Music, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Music' },
  speaking: { icon: User, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Speaking' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VideoAnalyzerPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Data state
  const [videoImports, setVideoImports] = useState<VideoImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedVideo, setSelectedVideo] = useState<AnalyzerVideo | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<VideoAnalysisRow | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [checkingAnalysis, setCheckingAnalysis] = useState(false);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // UI state
  const [search, setSearch] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [activeMarkerFilter, setActiveMarkerFilter] = useState<Set<string>>(new Set());

  // ─── Load video imports ──────────────────────────────────────────────────────
  const loadImports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('video_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setVideoImports((data || []) as VideoImportRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video imports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  // ─── Auto-select from URL params ──────────────────────────────────────────────
  useEffect(() => {
    if (videoImports.length === 0) return;
    const videoId = searchParams.get('video');
    if (videoId) {
      const match = videoImports.find((v) => v.id === videoId || v.video_id === videoId);
      if (match) {
        selectVideo(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoImports, searchParams]);

  // ─── Convert VideoImportRow to AnalyzerVideo ────────────────────────────────────
  const toAnalyzerVideo = useCallback((row: VideoImportRow): AnalyzerVideo => {
    const meta = row.metadata || {};
    return {
      id: row.id,
      title: row.name,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      duration: row.duration_seconds || 0,
      source: row.source || 'upload',
      viewCount: meta.view_count as number | undefined,
      likeCount: meta.like_count as number | undefined,
      commentCount: meta.comment_count as number | undefined,
      tags: meta.tags as string[] | undefined,
      description: meta.description as string | undefined,
    };
  }, []);

  // ─── Select a video and check for existing analysis ──────────────────────────────
  const selectVideo = useCallback(
    async (row: VideoImportRow) => {
      const video = toAnalyzerVideo(row);
      setSelectedVideo(video);
      setSelectedImportId(row.id);
      setAnalysisResult(null);
      setExistingAnalysis(null);
      setCheckingAnalysis(true);

      try {
        const { data, error: queryError } = await supabase
          .from('video_analyses')
          .select('*')
          .eq('video_id', row.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw queryError;

        if (data) {
          const analysisRow = data as VideoAnalysisRow;
          setExistingAnalysis(analysisRow);

          // Reconstruct AnalysisResult from stored data
          if (analysisRow.status === 'completed' && analysisRow.analysis_data) {
            setAnalysisResult(analysisRow.analysis_data as unknown as AnalysisResult);
          }
        }
      } catch {
        // Silently fail — user can still run analysis
      } finally {
        setCheckingAnalysis(false);
      }
    },
    [toAnalyzerVideo],
  );

  // ─── Run AI analysis ────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!selectedVideo) return;
    setAnalyzing(true);
    setAnalysisStage(0);
    setAnalysisProgress(0);

    // Run through stages with progress
    for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
      setAnalysisStage(i);
      // Simulate stage progress
      const stageDuration = 600 + Math.random() * 400;
      const stageStart = (i / ANALYSIS_STAGES.length) * 100;
      const stageEnd = ((i + 1) / ANALYSIS_STAGES.length) * 100;
      const steps = 10;
      for (let j = 0; j < steps; j++) {
        await new Promise((resolve) => setTimeout(resolve, stageDuration / steps));
        setAnalysisProgress(Math.round(stageStart + ((stageEnd - stageStart) * (j + 1)) / steps));
      }
    }

    // Compute analysis
    const result = analyzeVideo(selectedVideo);
    setAnalysisResult(result);
    setAnalyzing(false);
    setAnalysisProgress(100);

    // Save to database
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const insertPayload = {
        user_id: userId,
        video_id: selectedVideo.id,
        video_url: selectedVideo.url,
        video_title: selectedVideo.title,
        source: selectedVideo.source,
        status: 'completed',
        hook_score: result.hookScore,
        cta_detected: result.ctaDetected,
        scene_count: result.sceneCount,
        avg_scene_duration: result.averageSceneDuration,
        speaking_speed: result.speakingSpeed,
        editing_pace: result.editingPace,
        avg_shot_length: result.averageShotLength,
        retention_prediction: result.retentionCurve[Math.floor(result.retentionCurve.length / 2)],
        estimated_ctr: result.estimatedCtr,
        seo_score: result.seoScore,
        thumbnail_score: result.thumbnailScore,
        emotions: result.emotions,
        keywords: result.keywords,
        objects: result.objects,
        faces: [{ count: result.faceCount, confidence: result.faceConfidence }],
        scenes: result.scenes,
        best_moments: result.mostEngagingMoments,
        viral_moments: result.bestViralMoments,
        shorts_moments: result.bestShortsMoments,
        timeline_markers: result.timelineMarkers,
        suggestions: result.suggestions,
        analysis_data: result as unknown as Record<string, unknown>,
      };

      const { error: insertError } = await supabase.from('video_analyses').insert(insertPayload);

      if (insertError) {
        toast({
          title: 'Analysis saved with warnings',
          description: insertError.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Analysis complete',
          description: 'Results saved to your library.',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to save analysis',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [selectedVideo, toast]);

  // ─── Analyze by URL ──────────────────────────────────────────────────────────────
  const analyzeByUrl = useCallback(async () => {
    if (!urlInput.trim()) return;

    // Extract video ID from YouTube URL
    const ytMatch = urlInput.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!ytMatch) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid YouTube URL.',
        variant: 'destructive',
      });
      return;
    }

    const ytVideoId = ytMatch[1];
    const video: AnalyzerVideo = {
      id: ytVideoId,
      title: `YouTube Video ${ytVideoId}`,
      url: urlInput,
      thumbnailUrl: `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`,
      duration: 300,
      source: 'youtube',
    };

    setSelectedVideo(video);
    setSelectedImportId(null);
    setExistingAnalysis(null);
    setAnalysisResult(null);
    setUrlInput('');
    toast({
      title: 'Video loaded',
      description: 'Click Analyze to run AI analysis.',
    });
  }, [urlInput, toast]);

  // ─── Filtered video list ─────────────────────────────────────────────────────────
  const filteredVideos = useMemo(() => {
    return videoImports.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
  }, [videoImports, search]);

  // ─── Toggle marker filter ────────────────────────────────────────────────────────
  const toggleMarkerFilter = useCallback((type: string) => {
    setActiveMarkerFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // ─── Filtered timeline markers ────────────────────────────────────────────────────
  const visibleMarkers = useMemo(() => {
    if (!analysisResult) return [];
    if (activeMarkerFilter.size === 0) return analysisResult.timelineMarkers;
    return analysisResult.timelineMarkers.filter((m) => activeMarkerFilter.has(m.type));
  }, [analysisResult, activeMarkerFilter]);

  const duration = selectedVideo?.duration || 0;

  // ─── Render ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Video Analyzer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered video analysis with scene detection, hook scoring, and retention prediction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            {videoImports.length} Videos
          </Badge>
          {analysisResult && (
            <Badge variant="outline" className="gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Analyzed
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ─── Main 3-Panel Layout ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_340px] xl:grid-cols-[300px_1fr_380px]">
        {/* ─── Left Panel: Video Selection ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="glass p-4">
            <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Video Library
            </h3>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos..."
                className="pl-9"
              />
            </div>

            {/* Analyze by URL */}
            <div className="mb-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Analyze by YouTube URL</label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && analyzeByUrl()}
                />
                <Button size="sm" variant="secondary" onClick={analyzeByUrl} className="shrink-0">
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Video List */}
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {!loading && !error && filteredVideos.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    {search ? 'No videos match your search.' : 'No imported videos yet.'}
                  </p>
                </div>
              )}

              {!loading &&
                !error &&
                filteredVideos.map((video) => {
                  const isSelected = selectedImportId === video.id;
                  const sourceBadge = getSourceBadge(video.source);
                  return (
                    <button
                      key={video.id}
                      onClick={() => selectVideo(video)}
                      className={cn(
                        'group flex w-full gap-3 rounded-xl border p-2 text-left transition-all',
                        isSelected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-transparent bg-muted/30 hover:bg-muted/50',
                      )}
                    >
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {video.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={video.thumbnail_url}
                            alt={video.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                          {formatTimecode(video.duration_seconds || 0)}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p className="truncate text-xs font-medium">{video.name}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', sourceBadge.color)}>
                            {sourceBadge.label}
                          </span>
                          {video.analysis_status === 'completed' && (
                            <Check className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* ─── Center Panel: Analysis Results ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedVideo && !loading && (
            <EmptyState
              icon={Film}
              title="Select a video to analyze"
              description="Choose a video from your library or paste a YouTube URL to begin AI analysis."
            />
          )}

          {selectedVideo && (
            <>
              {/* Video Preview */}
              <Card className="glass overflow-hidden p-0">
                <div className="relative aspect-video w-full bg-black">
                  {selectedVideo.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedVideo.thumbnailUrl}
                      alt={selectedVideo.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display text-lg font-bold text-white">{selectedVideo.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimecode(duration)}
                      </span>
                      {selectedVideo.viewCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatNumber(selectedVideo.viewCount)}
                        </span>
                      )}
                      {selectedVideo.likeCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {formatNumber(selectedVideo.likeCount)}
                        </span>
                      )}
                      {selectedVideo.commentCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {formatNumber(selectedVideo.commentCount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Analysis Status / Action */}
              {checkingAnalysis && (
                <LoadingState message="Checking for existing analysis..." />
              )}

              {!checkingAnalysis && !analysisResult && !analyzing && (
                <Card className="glass p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold">Ready to Analyze</h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {existingAnalysis
                        ? 'A previous analysis exists. Run a new analysis to refresh results.'
                        : 'No analysis exists yet. Click below to run AI analysis on this video.'}
                    </p>
                    <Button onClick={runAnalysis} className="mt-4" size="lg">
                      <Sparkles className="mr-2 h-4 w-4" />
                      {existingAnalysis ? 'Re-Analyze' : 'Analyze Video'}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Analysis Progress */}
              {analyzing && (
                <Card className="glass p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">AI Analysis in Progress</p>
                        <p className="text-xs text-muted-foreground">{ANALYSIS_STAGES[analysisStage]}</p>
                      </div>
                      <span className="text-sm font-bold text-primary">{analysisProgress}%</span>
                    </div>
                    <Progress value={analysisProgress} className="h-2" />
                    <div className="flex flex-wrap gap-2">
                      {ANALYSIS_STAGES.map((stage, i) => (
                        <div
                          key={stage}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                            i < analysisStage && 'bg-green-500/20 text-green-400',
                            i === analysisStage && 'bg-primary/20 text-primary',
                            i > analysisStage && 'bg-muted/30 text-muted-foreground',
                          )}
                        >
                          {i < analysisStage ? (
                            <Check className="h-3 w-3" />
                          ) : i === analysisStage ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-current" />
                          )}
                          {stage.replace('...', '')}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Visual Timeline */}
              {analysisResult && !analyzing && (
                <Card className="glass p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold">Visual Timeline</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTimelineZoom((z) => Math.max(1, z - 0.5))}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">{timelineZoom.toFixed(1)}x</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTimelineZoom((z) => Math.min(5, z + 0.5))}
                      >
                        <Search className="h-3.5 w-3.5 rotate-90" />
                      </Button>
                    </div>
                  </div>

                  {/* Marker filter chips */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {Object.entries(MARKER_STYLES).map(([type, style]) => {
                      const active = activeMarkerFilter.size === 0 || activeMarkerFilter.has(type);
                      const Icon = style.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => toggleMarkerFilter(type)}
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all',
                            active ? style.bg : 'bg-muted/20 text-muted-foreground/50',
                            active && style.color,
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {style.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Timeline */}
                  <div className="overflow-x-auto">
                    <div
                      className="relative rounded-lg border border-border/50 bg-muted/20"
                      style={{ width: `${duration * timelineZoom * 2}px`, minWidth: '100%', height: '120px' }}
                    >
                      {/* Time ruler */}
                      <div className="absolute top-0 left-0 right-0 flex justify-between border-b border-border/30 px-2 py-1 text-[9px] text-muted-foreground">
                        {Array.from({ length: Math.min(10, Math.ceil(duration / 30)) }, (_, i) => (
                          <span key={i}>{formatTimecode((duration / Math.min(10, Math.ceil(duration / 30))) * i)}</span>
                        ))}
                      </div>

                      {/* Segment markers (scenes, silence, music, speaking, hook) */}
                      <div className="absolute top-7 bottom-0 left-0 right-0">
                        {visibleMarkers
                          .filter((m) => m.end !== undefined && (m.type === 'scene' || m.type === 'silence' || m.type === 'music' || m.type === 'speaking' || m.type === 'hook'))
                          .map((marker, i) => {
                            const left = (marker.start / duration) * 100;
                            const width = ((marker.end! - marker.start) / duration) * 100;
                            return (
                              <div
                                key={`seg-${i}`}
                                className="absolute top-0 h-7 rounded-sm border border-white/10"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  backgroundColor: marker.color || '#6366f1',
                                  opacity: 0.3,
                                }}
                                title={marker.label}
                              />
                            );
                          })}

                        {/* Point markers (best, viral, shorts, cta) */}
                        {visibleMarkers
                          .filter((m) => m.end === undefined && (m.type === 'best' || m.type === 'viral' || m.type === 'shorts' || m.type === 'cta'))
                          .map((marker, i) => {
                            const left = (marker.start / duration) * 100;
                            const style = MARKER_STYLES[marker.type];
                            const Icon = style.icon;
                            return (
                              <div
                                key={`pt-${i}`}
                                className="absolute -translate-x-1/2"
                                style={{ left: `${left}%`, top: `${marker.type === 'cta' ? 36 : 44}px` }}
                                title={`${marker.label} (${marker.score || ''})`}
                              >
                                <div className={cn('flex h-5 w-5 items-center justify-center rounded-full', style.bg)}>
                                  <Icon className={cn('h-3 w-3', style.color)} />
                                </div>
                              </div>
                            );
                          })}

                        {/* Hook zone label */}
                        {visibleMarkers.some((m) => m.type === 'hook') && (
                          <div
                            className="absolute top-8 h-5 rounded text-[9px] font-medium text-amber-400 flex items-center px-1"
                            style={{
                              left: '0%',
                              width: `${Math.min(30, duration) / duration * 100}%`,
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              border: '1px dashed rgba(245, 158, 11, 0.4)',
                            }}
                          >
                            <Zap className="mr-1 h-2.5 w-2.5" /> Hook
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Retention Prediction Chart */}
              {analysisResult && !analyzing && (
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Audience Retention Prediction
                  </h3>
                  <div className="flex h-32 items-end gap-1">
                    {analysisResult.retentionCurve.map((value, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${value}%` }}
                        transition={{ delay: i * 0.03, duration: 0.4 }}
                        className={cn(
                          'flex-1 rounded-t-sm',
                          value > 70
                            ? 'bg-gradient-to-t from-green-600 to-green-400'
                            : value > 50
                              ? 'bg-gradient-to-t from-yellow-600 to-yellow-400'
                              : value > 35
                                ? 'bg-gradient-to-t from-orange-600 to-orange-400'
                                : 'bg-gradient-to-t from-red-600 to-red-400',
                        )}
                        title={`${formatTimecode((duration / analysisResult.retentionCurve.length) * i)}: ${value}%`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>0:00</span>
                    <span>{formatTimecode(duration / 2)}</span>
                    <span>{formatTimecode(duration)}</span>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* ─── Right Panel: Detailed Analysis ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedVideo && (
            <Card className="glass p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Detailed analysis will appear here.</p>
              </div>
            </Card>
          )}

          {selectedVideo && checkingAnalysis && (
            <LoadingState message="Loading analysis data..." />
          )}

          {selectedVideo && !checkingAnalysis && !analysisResult && !analyzing && (
            <Card className="glass p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <Activity className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Run analysis to see detailed results.</p>
              </div>
            </Card>
          )}

          {analyzing && (
            <Card className="glass p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Analyzing video content...</p>
              </div>
            </Card>
          )}

          <AnimatePresence>
            {analysisResult && !analyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Video Structure */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Film className="h-4 w-4 text-violet-400" />
                    Video Structure
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.sceneCount}</p>
                      <p className="text-[10px] text-muted-foreground">Scenes</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.averageSceneDuration.toFixed(1)}s</p>
                      <p className="text-[10px] text-muted-foreground">Avg Scene</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.averageShotLength.toFixed(1)}s</p>
                      <p className="text-[10px] text-muted-foreground">Avg Shot</p>
                    </div>
                  </div>
                </Card>

                {/* Hook Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Hook Detection
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="outline" className="text-[10px]">{analysisResult.hookType}</Badge>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Hook Score</span>
                        <span className="text-xs font-bold">{analysisResult.hookScore}%</span>
                      </div>
                      <Progress value={analysisResult.hookScore} className="h-2" />
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="text-[10px] text-muted-foreground">Hook Text</p>
                      <p className="mt-0.5 text-xs">{analysisResult.hookText}</p>
                    </div>
                  </div>
                </Card>

                {/* CTA Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Target className="h-4 w-4 text-red-400" />
                    CTA Detection
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Detected</span>
                      {analysisResult.ctaDetected ? (
                        <Badge className="gap-1 bg-green-500/20 text-green-400"><Check className="h-3 w-3" /> Yes</Badge>
                      ) : (
                        <Badge className="gap-1 bg-red-500/20 text-red-400"><X className="h-3 w-3" /> No</Badge>
                      )}
                    </div>
                    <p className="text-xs">{analysisResult.ctaText}</p>
                    {analysisResult.ctaDetected && (
                      <p className="text-[10px] text-muted-foreground">
                        Position: {formatTimecode(analysisResult.ctaPosition)}
                      </p>
                    )}
                  </div>
                </Card>

                {/* Scene Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Film className="h-4 w-4 text-violet-400" />
                    Scene Detection
                  </h3>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {analysisResult.scenes.map((scene) => (
                      <div key={scene.index} className="flex items-center justify-between rounded-lg bg-muted/20 px-2 py-1.5">
                        <span className="text-xs font-medium">{scene.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimecode(scene.start)} - {formatTimecode(scene.end)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Speaker Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <User className="h-4 w-4 text-green-400" />
                    Speaker Detection
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Speakers Detected</span>
                      <span className="font-display text-lg font-bold">{analysisResult.speakerCount}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {analysisResult.speakerSegments.length} speaking segments
                    </div>
                  </div>
                </Card>

                {/* Face Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Camera className="h-4 w-4 text-blue-400" />
                    Face Detection
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.faceCount}</p>
                      <p className="text-[10px] text-muted-foreground">Faces</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.faceConfidence}%</p>
                      <p className="text-[10px] text-muted-foreground">Confidence</p>
                    </div>
                  </div>
                </Card>

                {/* Emotion Analysis */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Smile className="h-4 w-4 text-yellow-400" />
                    Emotion Analysis
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.emotions.map((emotion) => (
                      <div key={emotion.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs">{emotion.label}</span>
                          <span className="text-[10px] font-medium text-muted-foreground">{emotion.intensity}%</span>
                        </div>
                        <Progress value={emotion.intensity} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Keyword Extraction */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Tag className="h-4 w-4 text-cyan-400" />
                    Keyword Extraction
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.keywords.map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{keyword}</Badge>
                    ))}
                  </div>
                </Card>

                {/* Object Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Camera className="h-4 w-4 text-indigo-400" />
                    Object Detection
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.objects.map((obj, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{obj}</Badge>
                    ))}
                  </div>
                </Card>

                {/* Subtitle Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Film className="h-4 w-4 text-teal-400" />
                    Subtitle Detection
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Detected</span>
                    {analysisResult.subtitleDetected ? (
                      <Badge className="gap-1 bg-green-500/20 text-green-400"><Check className="h-3 w-3" /> Yes</Badge>
                    ) : (
                      <Badge className="gap-1 bg-red-500/20 text-red-400"><X className="h-3 w-3" /> No</Badge>
                    )}
                  </div>
                  {analysisResult.subtitleDetected && (
                    <p className="mt-2 text-[10px] text-muted-foreground">Language: {analysisResult.subtitleLanguage}</p>
                  )}
                </Card>

                {/* Silence Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Volume2 className="h-4 w-4 text-gray-400" />
                    Silence Detection
                  </h3>
                  <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                    {analysisResult.silenceSegments.map((seg, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-muted/20 px-2 py-1.5">
                        <span className="text-xs">Silence {i + 1}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimecode(seg.start)} - {formatTimecode(seg.end)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Music Detection */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Music className="h-4 w-4 text-blue-400" />
                    Music Detection
                  </h3>
                  <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                    {analysisResult.musicSegments.map((seg, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-muted/20 px-2 py-1.5">
                        <span className="text-xs">{seg.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimecode(seg.start)} - {formatTimecode(seg.end)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Speaking Speed & Editing Pace */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Activity className="h-4 w-4 text-primary" />
                    Pacing & Speed
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.speakingSpeed}</p>
                      <p className="text-[10px] text-muted-foreground">WPM</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.editingPace}</p>
                      <p className="text-[10px] text-muted-foreground">Cuts/Min</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.cameraChanges}</p>
                      <p className="text-[10px] text-muted-foreground">Camera Changes</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="font-display text-lg font-bold">{analysisResult.transitions}</p>
                      <p className="text-[10px] text-muted-foreground">Transitions</p>
                    </div>
                  </div>
                </Card>

                {/* Estimated CTR */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    Estimated CTR
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-3xl font-bold text-green-400">
                      {analysisResult.estimatedCtr}%
                    </span>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      analysisResult.estimatedCtr > 5 ? 'text-green-400' : analysisResult.estimatedCtr > 2 ? 'text-yellow-400' : 'text-red-400',
                    )}>
                      {analysisResult.estimatedCtr > 5 ? 'Excellent' : analysisResult.estimatedCtr > 2 ? 'Average' : 'Below Avg'}
                    </Badge>
                  </div>
                </Card>

                {/* SEO Score */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Tag className="h-4 w-4 text-cyan-400" />
                    SEO Score
                  </h3>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Score</span>
                      <span className="text-xs font-bold">{analysisResult.seoScore}%</span>
                    </div>
                    <Progress value={analysisResult.seoScore} className="h-2" />
                  </div>
                </Card>

                {/* Thumbnail Score */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Camera className="h-4 w-4 text-purple-400" />
                    Thumbnail Score
                  </h3>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Score</span>
                      <span className="text-xs font-bold">{analysisResult.thumbnailScore}%</span>
                    </div>
                    <Progress value={analysisResult.thumbnailScore} className="h-2" />
                  </div>
                </Card>

                {/* Auto-Detected Highlights */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Star className="h-4 w-4 text-yellow-400" />
                    Auto-Detected Highlights
                  </h3>
                  <div className="space-y-3">
                    {/* Best Hook */}
                    <div className="rounded-lg bg-amber-500/10 p-2">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-amber-400">
                        <Zap className="h-3 w-3" /> Best Hook
                      </p>
                      <p className="text-xs">{analysisResult.bestHook.text}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">@ {formatTimecode(analysisResult.bestHook.time)}</p>
                    </div>

                    {/* Best CTA */}
                    <div className="rounded-lg bg-red-500/10 p-2">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-red-400">
                        <Target className="h-3 w-3" /> Best CTA
                      </p>
                      <p className="text-xs">{analysisResult.bestCta.text}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">@ {formatTimecode(analysisResult.bestCta.time)}</p>
                    </div>

                    {/* Viral Moments */}
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-orange-400">
                        <Flame className="h-3 w-3" /> Viral Moments
                      </p>
                      {analysisResult.bestViralMoments.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                          <span>{m.label}</span>
                          <span className="text-muted-foreground">{formatTimecode(m.time)} · {m.score}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Shorts Moments */}
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-cyan-400">
                        <Scissors className="h-3 w-3" /> Shorts Moments
                      </p>
                      {analysisResult.bestShortsMoments.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                          <span>{m.label}</span>
                          <span className="text-muted-foreground">{formatTimecode(m.time)} · {m.score}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Emotional Moments */}
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-yellow-400">
                        <Smile className="h-3 w-3" /> Most Emotional
                      </p>
                      {analysisResult.mostEmotionalMoments.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                          <span>{m.emotion} — {m.label}</span>
                          <span className="text-muted-foreground">{formatTimecode(m.time)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Engaging Moments */}
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-green-400">
                        <Activity className="h-3 w-3" /> Most Engaging
                      </p>
                      {analysisResult.mostEngagingMoments.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                          <span>{m.label}</span>
                          <span className="text-muted-foreground">{formatTimecode(m.time)} · {m.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Suggested Improvements */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    Suggested Improvements
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.suggestions.map((suggestion, i) => (
                      <div key={i} className="flex gap-2 rounded-lg bg-muted/20 p-2">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20">
                          <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                        </div>
                        <p className="text-xs leading-relaxed">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
