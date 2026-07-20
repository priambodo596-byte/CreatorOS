'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors,
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  Flame,
  Zap,
  Star,
  Eye,
  Clock,
  Download,
  Edit,
  Calendar,
  Save,
  Heart,
  Youtube,
  Music2,
  Camera,
  Facebook,
  Linkedin,
  Check,
  X,
  Volume2,
  Captions,
  Crop,
  User,
  Music,
  Wand2,
  TrendingUp,
  Target,
  Hash,
  ZoomIn,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { EmptyState, ErrorState, formatNumber } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceType = 'uploaded' | 'trending' | 'youtube' | 'project' | 'asset';

interface VideoImportRow {
  id: string;
  source: string;
  name: string;
  url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  video_id: string | null;
  channel_id: string | null;
  metadata: Record<string, unknown> | null;
  analysis_status: string | null;
  analysis_data: Record<string, unknown> | null;
  favorite: boolean;
  storage_path: string | null;
  created_at: string;
}

interface VideoClipRow {
  id: string;
  user_id: string;
  source_video_id: string | null;
  source_video_url: string | null;
  source_video_title: string | null;
  title: string;
  platform: string | null;
  version: string | null;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  viral_score: number;
  ctr_prediction: number;
  retention_prediction: number;
  watch_time_prediction: number;
  seo_score: number;
  status: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  has_captions: boolean;
  has_auto_crop: boolean;
  has_face_tracking: boolean;
  has_noise_reduction: boolean;
  has_silence_removal: boolean;
  has_jump_cuts: boolean;
  has_transitions: boolean;
  has_brand_watermark: boolean;
  seo_title: string | null;
  seo_description: string | null;
  hashtags: string[] | Record<string, unknown>;
  ai_recommendation: string | null;
  metadata: Record<string, unknown> | null;
  favorite: boolean;
  created_at: string;
}

interface GeneratedClip {
  id: string;
  title: string;
  version: ClipVersion;
  startTime: number;
  endTime: number;
  duration: number;
  platform: PlatformId;
  viralScore: number;
  ctrPrediction: number;
  retentionPrediction: number;
  watchTimePrediction: number;
  seoScore: number;
  seoTitle: string;
  seoDescription: string;
  hashtags: string[];
  aiRecommendation: string;
  thumbnailUrl: string | null;
  sourceVideoUrl: string | null;
  features: ClipFeatures;
  momentCategory: MomentCategory;
  saved: boolean;
  saving: boolean;
  exporting: boolean;
  exportProgress: number;
  favorite: boolean;
}

interface ClipFeatures {
  autoCrop: boolean;
  smartReframing: boolean;
  faceTracking: boolean;
  autoZoom: boolean;
  dynamicCaptions: boolean;
  animatedSubtitles: boolean;
  backgroundMusic: boolean;
  aiVoiceEnhancement: boolean;
  noiseReduction: boolean;
  silenceRemoval: boolean;
  jumpCuts: boolean;
  aiTransitions: boolean;
  brandWatermark: boolean;
  endScreen: boolean;
  ctaOverlay: boolean;
}

type ClipVersion =
  | 'Funny'
  | 'Educational'
  | 'Storytelling'
  | 'Motivational'
  | 'Fast-paced';

type PlatformId =
  | 'youtube-shorts'
  | 'tiktok'
  | 'instagram-reels'
  | 'facebook-reels'
  | 'linkedin-clips';

type MomentCategory =
  | 'Highest Engagement'
  | 'Funny Moments'
  | 'Educational Moments'
  | 'Tutorial Highlights'
  | 'Reaction Moments'
  | 'Emotional Moments'
  | 'Q&A Segments'
  | 'Most Shared Moments'
  | 'Highest Retention Segments';

// ─── Constants ──────────────────────────────────────────────────────────────

const SOURCE_OPTIONS: { id: SourceType; label: string; icon: typeof Youtube }[] = [
  { id: 'uploaded', label: 'Uploaded Video', icon: Youtube },
  { id: 'trending', label: 'Trending Video', icon: TrendingUp },
  { id: 'youtube', label: 'YouTube URL', icon: Youtube },
  { id: 'project', label: 'Project Video', icon: Edit },
  { id: 'asset', label: 'Asset Library', icon: Crop },
];

const CLIP_VERSIONS: ClipVersion[] = [
  'Funny',
  'Educational',
  'Storytelling',
  'Motivational',
  'Fast-paced',
];

const PLATFORMS: { id: PlatformId; label: string; icon: typeof Youtube; color: string }[] = [
  { id: 'youtube-shorts', label: 'YouTube Shorts', icon: Youtube, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { id: 'instagram-reels', label: 'Instagram Reels', icon: Camera, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'facebook-reels', label: 'Facebook Reels', icon: Facebook, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'linkedin-clips', label: 'LinkedIn Clips', icon: Linkedin, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
];

const GENERATION_STAGES = [
  'Scanning video for engaging moments...',
  'Detecting funny moments...',
  'Detecting educational moments...',
  'Generating clip versions...',
  'Applying auto-crop...',
  'Adding captions...',
  'Optimizing for platform...',
];

const MOMENT_CATEGORIES: MomentCategory[] = [
  'Highest Engagement',
  'Funny Moments',
  'Educational Moments',
  'Tutorial Highlights',
  'Reaction Moments',
  'Emotional Moments',
  'Q&A Segments',
  'Most Shared Moments',
  'Highest Retention Segments',
];

const CLIP_POSITIONS = [0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.85];

const FEATURE_ICONS: { key: keyof ClipFeatures; label: string; icon: typeof Crop }[] = [
  { key: 'autoCrop', label: 'Auto Crop 9:16', icon: Crop },
  { key: 'smartReframing', label: 'Smart Reframing', icon: Crop },
  { key: 'faceTracking', label: 'Face Tracking', icon: User },
  { key: 'autoZoom', label: 'Auto Zoom', icon: ZoomIn },
  { key: 'dynamicCaptions', label: 'Dynamic Captions', icon: Captions },
  { key: 'animatedSubtitles', label: 'Animated Subtitles', icon: Captions },
  { key: 'backgroundMusic', label: 'Background Music', icon: Music },
  { key: 'aiVoiceEnhancement', label: 'AI Voice Enhance', icon: Volume2 },
  { key: 'noiseReduction', label: 'Noise Reduction', icon: Volume2 },
  { key: 'silenceRemoval', label: 'Silence Removal', icon: Scissors },
  { key: 'jumpCuts', label: 'Jump Cuts', icon: Scissors },
  { key: 'aiTransitions', label: 'AI Transitions', icon: Wand2 },
  { key: 'brandWatermark', label: 'Brand Watermark', icon: Star },
  { key: 'endScreen', label: 'End Screen', icon: Target },
  { key: 'ctaOverlay', label: 'CTA Overlay', icon: Target },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimecode(seconds: number): string {
  if (!seconds || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getPlatformMeta(id: PlatformId) {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

function getVersionColor(version: ClipVersion): string {
  const map: Record<ClipVersion, string> = {
    Funny: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Educational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Storytelling: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Motivational: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Fast-paced': 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return map[version] ?? 'bg-muted/30 text-muted-foreground border-border';
}

function getViralScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (score >= 70) return 'text-lime-400 bg-lime-500/15 border-lime-500/30';
  if (score >= 55) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
}

function getMomentColor(category: MomentCategory): string {
  const map: Record<MomentCategory, string> = {
    'Highest Engagement': 'from-rose-500/20 to-pink-500/10',
    'Funny Moments': 'from-amber-500/20 to-yellow-500/10',
    'Educational Moments': 'from-blue-500/20 to-cyan-500/10',
    'Tutorial Highlights': 'from-indigo-500/20 to-violet-500/10',
    'Reaction Moments': 'from-orange-500/20 to-red-500/10',
    'Emotional Moments': 'from-purple-500/20 to-fuchsia-500/10',
    'Q&A Segments': 'from-teal-500/20 to-emerald-500/10',
    'Most Shared Moments': 'from-green-500/20 to-lime-500/10',
    'Highest Retention Segments': 'from-sky-500/20 to-blue-500/10',
  };
  return map[category] ?? 'from-muted/20 to-muted/10';
}

function getTagsFromMetadata(metadata: Record<string, unknown> | null): string[] {
  if (!metadata) return [];
  const tags = metadata.tags;
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string');
  }
  return [];
}

function getTitleFromMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  const title = metadata.title;
  return typeof title === 'string' ? title : '';
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Clip Generation Engine ─────────────────────────────────────────────────

function generateClips(video: VideoImportRow): GeneratedClip[] {
  const duration = video.duration_seconds || 300;
  const title = video.name || 'Untitled Video';
  const tags = getTagsFromMetadata(video.metadata);
  const metaTitle = getTitleFromMetadata(video.metadata);
  const baseTitle = metaTitle || title;

  // Determine number of clips: 5-8 based on duration
  const numClips = Math.min(8, Math.max(5, Math.round(duration / 60)));

  // Select positions proportionally
  const positions = CLIP_POSITIONS.slice(0, numClips);

  // Get view count and engagement from metadata if available
  const metadata = video.metadata || {};
  const viewCount =
    typeof metadata.viewCount === 'number'
      ? metadata.viewCount
      : typeof metadata.view_count === 'number'
        ? metadata.view_count
        : 0;
  const likeCount =
    typeof metadata.likeCount === 'number'
      ? metadata.likeCount
      : typeof metadata.like_count === 'number'
        ? metadata.like_count
        : 0;

  const engagementRate = viewCount > 0 ? likeCount / viewCount : 0.05;

  const clips: GeneratedClip[] = positions.map((pos, i) => {
    const startTime = Math.round(duration * pos);
    const clipDuration = 30 + Math.floor(Math.random() * 31); // 30-60 seconds
    const endTime = Math.min(startTime + clipDuration, duration);

    // Assign version
    const version = CLIP_VERSIONS[i % CLIP_VERSIONS.length];

    // Assign platform
    const platform = PLATFORMS[i % PLATFORMS.length].id;

    // Assign moment category
    const momentCategory = MOMENT_CATEGORIES[i % MOMENT_CATEGORIES.length];

    // Compute viral score based on position and engagement
    const positionBonus = pos > 0.2 && pos < 0.8 ? 10 : 0;
    const engagementBonus = Math.min(20, Math.round(engagementRate * 200));
    const viralScore = Math.min(99, Math.max(45, Math.round(55 + positionBonus + engagementBonus + Math.random() * 15)));

    // CTR prediction: 3% - 12%
    const ctrPrediction = Math.round((3 + (viralScore / 100) * 8 + Math.random() * 1.5) * 10) / 10;

    // Retention prediction: 40% - 85%
    const retentionPrediction = Math.min(85, Math.max(40, Math.round(45 + (viralScore / 100) * 30 + Math.random() * 10)));

    // Watch time prediction: based on clip duration and retention
    const watchTimePrediction = Math.round((clipDuration * (retentionPrediction / 100)) * 10) / 10;

    // SEO score: 55 - 95
    const seoScore = Math.min(95, Math.max(55, Math.round(60 + (tags.length > 3 ? 15 : 5) + Math.random() * 15)));

    // Generate SEO title
    const seoTitle = generateSeoTitle(baseTitle, version, momentCategory);

    // Generate SEO description
    const seoDescription = generateSeoDescription(baseTitle, version, momentCategory, clipDuration);

    // Generate hashtags
    const hashtags = generateHashtags(baseTitle, tags, version, momentCategory);

    // Generate AI recommendation
    const aiRecommendation = generateAiRecommendation(version, momentCategory, viralScore, platform);

    // Generate features (randomly toggle some)
    const features = generateFeatures();

    return {
      id: `clip-${Date.now()}-${i}`,
      title: `${baseTitle} — ${version} Clip ${i + 1}`,
      version,
      startTime,
      endTime,
      duration: endTime - startTime,
      platform,
      viralScore,
      ctrPrediction,
      retentionPrediction,
      watchTimePrediction,
      seoScore,
      seoTitle,
      seoDescription,
      hashtags,
      aiRecommendation,
      thumbnailUrl: video.thumbnail_url,
      sourceVideoUrl: video.url,
      features,
      momentCategory,
      saved: false,
      saving: false,
      exporting: false,
      exportProgress: 0,
      favorite: false,
    };
  });

  return clips;
}

function generateSeoTitle(title: string, version: ClipVersion, _moment: MomentCategory): string {
  const cleanTitle = title.replace(/\s*[-|]\s*.*$/, '').trim() || 'This Video';
  const templates: Record<ClipVersion, string[]> = {
    Funny: [`${cleanTitle} 😂 You Won't Believe This Moment!`, `The Funniest Part of "${cleanTitle}" 🤣`, `This ${cleanTitle} Clip Will Make You LOL 😂`],
    Educational: [`${cleanTitle} — The Key Lesson in 60 Seconds 📚`, `Learn This From "${cleanTitle}" Fast 🎓`, `${cleanTitle}: The Most Important Takeaway 💡`],
    Storytelling: [`${cleanTitle} — The Story That Hooks You 📖`, `This Moment from "${cleanTitle}" Is Powerful 🎬`, `The Story Behind "${cleanTitle}" ✨`],
    Motivational: [`${cleanTitle} 🔥 This Will Motivate You!`, `The Most Inspiring Moment in "${cleanTitle}" 💪`, `Watch This ${cleanTitle} Clip If You Need Motivation 🔥`],
    'Fast-paced': [`${cleanTitle} ⚡ 60 Seconds of Pure Value!`, `Quick Highlights: "${cleanTitle}" ⚡`, `${cleanTitle} — Fast-Paced & Action-Packed 🏃`],
  };
  const options = templates[version];
  return options[Math.floor(Math.random() * options.length)];
}

function generateSeoDescription(title: string, version: ClipVersion, _moment: MomentCategory, duration: number): string {
  const cleanTitle = title.replace(/\s*[-|]\s*.*$/, '').trim() || 'this video';
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return `🔥 ${cleanTitle} — ${version} clip (${timeStr}).

This short was auto-generated from the full video using AI moment detection. The clip was cropped to 9:16 vertical format with dynamic captions, face tracking, and smart reframing for maximum engagement on short-form platforms.

👉 Subscribe for more clips like this!

#shorts #${version.toLowerCase().replace(/\s+/g, '')} #viral`;
}

function generateHashtags(title: string, tags: string[], version: ClipVersion, _moment: MomentCategory): string[] {
  const baseTags = new Set<string>();
  baseTags.add('shorts');
  baseTags.add('viral');
  baseTags.add('fyp');
  baseTags.add('foryou');
  baseTags.add(version.toLowerCase().replace(/\s+/g, ''));

  // Add tags from video metadata
  for (const tag of tags.slice(0, 5)) {
    const cleaned = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleaned) baseTags.add(cleaned);
  }

  // Add tags from title words
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3);
  for (const word of words.slice(0, 3)) {
    baseTags.add(word);
  }

  return Array.from(baseTags).slice(0, 10);
}

function generateAiRecommendation(version: ClipVersion, moment: MomentCategory, viralScore: number, platform: PlatformId): string {
  const platformName = getPlatformMeta(platform).label;
  const scoreTier = viralScore >= 80 ? 'excellent' : viralScore >= 65 ? 'strong' : 'moderate';

  const recommendations: Record<ClipVersion, string> = {
    Funny: `This ${version.toLowerCase()} clip has ${scoreTier} viral potential (score: ${viralScore}). The comedic timing aligns well with ${platformName}'s algorithm. Post during peak hours (7-9 PM) for maximum reach.`,
    Educational: `This ${version.toLowerCase()} clip has ${scoreTier} engagement potential (score: ${viralScore}). Educational content performs well on ${platformName}. Add a hook in the first 3 seconds to boost retention.`,
    Storytelling: `This ${version.toLowerCase()} clip has ${scoreTier} retention potential (score: ${viralScore}). The narrative arc is well-suited for ${platformName}. Consider adding a cliffhanger ending to drive shares.`,
    Motivational: `This ${version.toLowerCase()} clip has ${scoreTier} shareability (score: ${viralScore}). Motivational clips resonate on ${platformName}. Pair with trending audio for a 2x reach boost.`,
    'Fast-paced': `This ${version.toLowerCase()} clip has ${scoreTier} watch-time potential (score: ${viralScore}). Fast-paced editing is ideal for ${platformName}. The jump cuts maintain momentum throughout.`,
  };

  return recommendations[version];
}

function generateFeatures(): ClipFeatures {
  return {
    autoCrop: true,
    smartReframing: true,
    faceTracking: Math.random() > 0.3,
    autoZoom: Math.random() > 0.4,
    dynamicCaptions: true,
    animatedSubtitles: Math.random() > 0.3,
    backgroundMusic: Math.random() > 0.4,
    aiVoiceEnhancement: Math.random() > 0.3,
    noiseReduction: true,
    silenceRemoval: true,
    jumpCuts: Math.random() > 0.4,
    aiTransitions: Math.random() > 0.3,
    brandWatermark: Math.random() > 0.5,
    endScreen: Math.random() > 0.5,
    ctaOverlay: Math.random() > 0.4,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIClipperPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [imports, setImports] = useState<VideoImportRow[]>([]);
  const [existingClips, setExistingClips] = useState<VideoClipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sourceType, setSourceType] = useState<SourceType>('uploaded');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedClips, setGeneratedClips] = useState<GeneratedClip[]>([]);
  const [detectedMoments, setDetectedMoments] = useState<MomentCategory[]>([]);

  const [previewClip, setPreviewClip] = useState<GeneratedClip | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedVideo = imports.find((v) => v.id === selectedVideoId) || null;

  // ─── Load data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setError('You must be signed in to use the AI Clipper.');
        setLoading(false);
        return;
      }

      const [importsRes, clipsRes] = await Promise.all([
        supabase.from('video_imports').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('video_clips').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      if (importsRes.error) throw new Error(importsRes.error.message);
      if (clipsRes.error) throw new Error(clipsRes.error.message);

      setImports((importsRes.data as VideoImportRow[]) || []);
      setExistingClips((clipsRes.data as VideoClipRow[]) || []);

      // Restore favorites from existing clips
      const favIds = new Set<string>(
        ((clipsRes.data as VideoClipRow[]) || []).filter((c) => c.favorite).map((c) => c.id),
      );
      setFavorites(favIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Auto-select from URL params ─────────────────────────────────────────
  useEffect(() => {
    const videoId = searchParams.get('video');
    if (videoId && imports.length > 0 && !selectedVideoId) {
      const found = imports.find((v) => v.id === videoId || v.video_id === videoId);
      if (found) {
        setSelectedVideoId(found.id);
        setSourceType('uploaded');
      }
    }
  }, [searchParams, imports, selectedVideoId]);

  // ─── Cleanup timer ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
  }, []);

  // ─── Generate clips ─────────────────────────────────────────────────────
  const handleGenerateClips = useCallback(async () => {
    if (!selectedVideo) {
      toast({
        title: 'No video selected',
        description: 'Please select a video to generate clips from.',
        variant: 'destructive',
      });
      return;
    }

    // For YouTube URL source, validate URL
    if (sourceType === 'youtube' && !youtubeUrl.trim()) {
      toast({
        title: 'YouTube URL required',
        description: 'Please enter a YouTube video URL.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    setGeneratedClips([]);
    setDetectedMoments([]);
    setGenerationStage(0);
    setGenerationProgress(0);

    // Simulate generation stages
    let stage = 0;
    let progress = 0;

    stageTimerRef.current = setInterval(() => {
      progress += Math.random() * 8 + 4;

      if (progress >= 100) {
        progress = 0;
        stage += 1;

        if (stage >= GENERATION_STAGES.length) {
          // Generation complete
          if (stageTimerRef.current) {
            clearInterval(stageTimerRef.current);
            stageTimerRef.current = null;
          }

          const clips = generateClips(selectedVideo);
          setGeneratedClips(clips);
          setDetectedMoments(MOMENT_CATEGORIES);
          setGenerating(false);
          setGenerationStage(0);
          setGenerationProgress(0);

          toast({
            title: 'Clips generated!',
            description: `${clips.length} clips created from "${selectedVideo.name}".`,
          });
          return;
        }

        setGenerationStage(stage);
      }

      setGenerationProgress(Math.min(progress, 100));
    }, 250);
  }, [selectedVideo, sourceType, youtubeUrl, toast]);

  // ─── Save clip to database ──────────────────────────────────────────────
  const handleSaveClip = useCallback(
    async (clip: GeneratedClip) => {
      setGeneratedClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, saving: true } : c)),
      );

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) throw new Error('Not authenticated');

        const insertData = {
          user_id: userId,
          source_video_id: selectedVideo?.video_id || selectedVideo?.id || null,
          source_video_url: selectedVideo?.url || null,
          source_video_title: selectedVideo?.name || null,
          title: clip.title,
          platform: clip.platform,
          version: clip.version,
          start_time: clip.startTime,
          end_time: clip.endTime,
          duration_seconds: clip.duration,
          viral_score: clip.viralScore,
          ctr_prediction: clip.ctrPrediction,
          retention_prediction: clip.retentionPrediction,
          watch_time_prediction: clip.watchTimePrediction,
          seo_score: clip.seoScore,
          status: 'generated',
          output_url: null,
          thumbnail_url: clip.thumbnailUrl,
          has_captions: clip.features.dynamicCaptions,
          has_auto_crop: clip.features.autoCrop,
          has_face_tracking: clip.features.faceTracking,
          has_noise_reduction: clip.features.noiseReduction,
          has_silence_removal: clip.features.silenceRemoval,
          has_jump_cuts: clip.features.jumpCuts,
          has_transitions: clip.features.aiTransitions,
          has_brand_watermark: clip.features.brandWatermark,
          seo_title: clip.seoTitle,
          seo_description: clip.seoDescription,
          hashtags: clip.hashtags,
          ai_recommendation: clip.aiRecommendation,
          metadata: {
            features: clip.features,
            moment_category: clip.momentCategory,
            smart_reframing: clip.features.smartReframing,
            auto_zoom: clip.features.autoZoom,
            animated_subtitles: clip.features.animatedSubtitles,
            background_music: clip.features.backgroundMusic,
            ai_voice_enhancement: clip.features.aiVoiceEnhancement,
            end_screen: clip.features.endScreen,
            cta_overlay: clip.features.ctaOverlay,
          },
          favorite: clip.favorite,
        };

        const { data, error: insertError } = await supabase
          .from('video_clips')
          .insert(insertData)
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);

        // Update local state
        setExistingClips((prev) => [data as VideoClipRow, ...prev]);
        setGeneratedClips((prev) =>
          prev.map((c) =>
            c.id === clip.id ? { ...c, saving: false, saved: true } : c,
          ),
        );

        toast({
          title: 'Clip saved',
          description: `"${clip.title}" saved to your clips library.`,
        });
      } catch (err) {
        setGeneratedClips((prev) =>
          prev.map((c) => (c.id === clip.id ? { ...c, saving: false } : c)),
        );
        toast({
          title: 'Save failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [selectedVideo, toast],
  );

  // ─── Export clip ─────────────────────────────────────────────────────────
  const handleExportClip = useCallback(
    (clip: GeneratedClip) => {
      setGeneratedClips((prev) =>
        prev.map((c) =>
          c.id === clip.id ? { ...c, exporting: true, exportProgress: 0 } : c,
        ),
      );

      const interval = setInterval(() => {
        setGeneratedClips((prev) =>
          prev.map((c) => {
            if (c.id !== clip.id) return c;
            const next = c.exportProgress + Math.random() * 12 + 5;
            if (next >= 100) {
              clearInterval(interval);
              toast({
                title: 'Export complete',
                description: `"${clip.title}" is ready to download.`,
              });
              return { ...c, exporting: false, exportProgress: 100 };
            }
            return { ...c, exportProgress: next };
          }),
        );
      }, 300);
    },
    [toast],
  );

  // ─── Toggle favorite ────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (clip: GeneratedClip) => {
      const newFav = !clip.favorite;
      setGeneratedClips((prev) =>
        prev.map((c) =>
          c.id === clip.id ? { ...c, favorite: newFav } : c,
        ),
      );

      // If clip is saved, update in database
      if (clip.saved) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (!userId) return;

          // Find the saved clip row
          const savedRow = existingClips.find(
            (c) => c.source_video_id === (selectedVideo?.video_id || selectedVideo?.id) && c.title === clip.title,
          );
          if (savedRow) {
            await supabase
              .from('video_clips')
              .update({ favorite: newFav })
              .eq('id', savedRow.id)
              .eq('user_id', userId);
          }
        } catch {
          // Non-critical, ignore
        }
      }

      setFavorites((prev) => {
        const next = new Set(prev);
        if (newFav) next.add(clip.id);
        else next.delete(clip.id);
        return next;
      });
    },
    [existingClips, selectedVideo],
  );

  // ─── Navigation handlers ────────────────────────────────────────────────
  const navigateToEditor = (clip: GeneratedClip) => {
    const params = new URLSearchParams({
      video: selectedVideo?.id || '',
      clip: clip.id,
      start: String(clip.startTime),
      end: String(clip.endTime),
    });
    window.location.href = `/dashboard/video-studio?${params.toString()}`;
  };

  const navigateToPublishing = (clip: GeneratedClip) => {
    const params = new URLSearchParams({
      title: clip.seoTitle,
      description: clip.seoDescription,
      hashtags: clip.hashtags.join(','),
      platform: clip.platform,
    });
    window.location.href = `/dashboard/publishing?${params.toString()}`;
  };

  const navigateToCalendar = (clip: GeneratedClip) => {
    const params = new URLSearchParams({
      title: clip.seoTitle,
      platform: clip.platform,
    });
    window.location.href = `/dashboard/calendar?${params.toString()}`;
  };

  // ─── Filter videos by source type ───────────────────────────────────────
  const filteredImports = imports.filter((v) => {
    if (sourceType === 'uploaded') return v.source === 'local' || v.source === 'upload';
    if (sourceType === 'trending') return v.source === 'youtube' || v.source === 'trending';
    if (sourceType === 'youtube') return v.source === 'youtube';
    if (sourceType === 'project') return v.source === 'project';
    if (sourceType === 'asset') return v.source === 'asset';
    return true;
  });

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
              <Scissors className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                AI Clipper
              </h1>
              <p className="text-sm text-muted-foreground">
                Transform long-form videos into high-performing short-form content
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </Badge>
          {existingClips.length > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <Scissors className="h-3 w-3" />
              {existingClips.length} saved clip{existingClips.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ─── Source Selection ─────────────────────────────────────────────── */}
      <Card className="glass overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          <Wand2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Select Video Source
          </h2>
        </div>
        <div className="space-y-5 p-5">
          {/* Source type tabs */}
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSourceType(opt.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  sourceType === opt.id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-muted/20 text-muted-foreground hover:border-border/60 hover:bg-muted/30',
                )}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>

          {/* YouTube URL input */}
          {sourceType === 'youtube' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                YouTube Video URL
              </label>
              <div className="flex gap-2">
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    const id = extractYouTubeId(youtubeUrl);
                    if (id) {
                      toast({ title: 'Video found', description: `YouTube ID: ${id}` });
                    } else {
                      toast({
                        title: 'Invalid URL',
                        description: 'Please enter a valid YouTube URL.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <Youtube className="mr-2 h-4 w-4" />
                  Fetch
                </Button>
              </div>
            </div>
          )}

          {/* Video selection dropdown/grid */}
          {sourceType !== 'youtube' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">
                {sourceType === 'uploaded' && 'Select an uploaded video'}
                {sourceType === 'trending' && 'Select a trending video'}
                {sourceType === 'project' && 'Select a project video'}
                {sourceType === 'asset' && 'Select from asset library'}
              </label>

              {loading ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading videos...</span>
                </div>
              ) : filteredImports.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/10 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No {sourceType} videos found. Import a video first.
                  </p>
                </div>
              ) : (
                <>
                  {/* Dropdown for narrow screens */}
                  <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a video..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredImports.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.duration_seconds ? `(${formatDuration(v.duration_seconds)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Grid for wider screens */}
                  <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-3 xl:grid-cols-4">
                    {filteredImports.slice(0, 8).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVideoId(v.id)}
                        className={cn(
                          'group relative overflow-hidden rounded-lg border text-left transition-all',
                          selectedVideoId === v.id
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border hover:border-border/60',
                        )}
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-muted">
                          {v.thumbnail_url ? (
                            <img
                              src={v.thumbnail_url}
                              alt={v.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted/40">
                              <Youtube className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          {v.duration_seconds ? (
                            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              {formatDuration(v.duration_seconds)}
                            </span>
                          ) : null}
                          {selectedVideoId === v.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                              <Check className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs font-medium">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(v.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Selected video info */}
          {selectedVideo && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                {selectedVideo.thumbnail_url ? (
                  <img
                    src={selectedVideo.thumbnail_url}
                    alt={selectedVideo.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Youtube className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedVideo.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {selectedVideo.duration_seconds ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(selectedVideo.duration_seconds)}
                    </span>
                  ) : null}
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedVideo.source}
                  </Badge>
                  {selectedVideo.analysis_status && (
                    <Badge variant="outline" className="text-[10px]">
                      {selectedVideo.analysis_status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Error / Empty states ────────────────────────────────────────── */}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* ─── Clip Generation ─────────────────────────────────────────────── */}
      <Card className="glass overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            AI Clip Generation
          </h2>
        </div>
        <div className="p-5">
          {!generating && generatedClips.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
                <Scissors className="h-8 w-8 text-violet-400" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Generate AI Clips
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {selectedVideo
                    ? `AI will analyze "${selectedVideo.name}" and generate 5-8 short-form clips optimized for engagement.`
                    : 'Select a video source above to begin generating clips.'}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleGenerateClips}
                disabled={!selectedVideo}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Generate Clips
              </Button>
            </div>
          )}

          {/* Generating state */}
          {generating && (
            <div className="space-y-5 py-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {GENERATION_STAGES[generationStage] || 'Processing...'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Stage {generationStage + 1} of {GENERATION_STAGES.length}
                  </p>
                </div>
              </div>
              <Progress value={generationProgress} className="h-2" />
              <div className="flex flex-wrap gap-2">
                {GENERATION_STAGES.map((stage, i) => (
                  <div
                    key={stage}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all',
                      i < generationStage
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : i === generationStage
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-muted/20 text-muted-foreground',
                    )}
                  >
                    {i < generationStage ? (
                      <Check className="h-3 w-3" />
                    ) : i === generationStage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <div className="h-3 w-3" />
                    )}
                    {stage.replace('...', '')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detected moments */}
          {!generating && detectedMoments.length > 0 && (
            <div className="mb-6 space-y-3">
              <h3 className="font-display text-sm font-semibold">Detected Moments</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {detectedMoments.map((category, i) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div
                      className={cn(
                        'relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br p-3',
                        getMomentColor(category),
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-semibold">
                          {category}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {Math.floor(Math.random() * 5) + 2} clips
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Flame className="h-3 w-3 text-amber-400" />
                        <span className="text-[11px] text-muted-foreground">
                          High engagement detected
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Regenerate button */}
          {!generating && generatedClips.length > 0 && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleGenerateClips} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Regenerate Clips
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Generated Clips Grid ─────────────────────────────────────────── */}
      {!generating && generatedClips.length === 0 && !loading && imports.length > 0 && !error && (
        <EmptyState
          icon={Scissors}
          title="No clips generated yet"
          description="Select a video above and click Generate Clips to create AI-powered short-form content."
        />
      )}

      {generatedClips.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Generated Clips
              <Badge variant="secondary" className="ml-2">
                {generatedClips.length}
              </Badge>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {generatedClips.map((clip, i) => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.5) }}
              >
                <Card className="glass glass-hover overflow-hidden p-0">
                  {/* Thumbnail / Preview */}
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {clip.thumbnailUrl ? (
                      <img
                        src={clip.thumbnailUrl}
                        alt={clip.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5">
                        <Scissors className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="h-12 w-12 rounded-full"
                        onClick={() => setPreviewClip(clip)}
                      >
                        <Play className="h-6 w-6" />
                      </Button>
                    </div>

                    {/* Top badges */}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                      <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', getVersionColor(clip.version))}>
                        {clip.version}
                      </span>
                      <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold', getPlatformMeta(clip.platform).color)}>
                        {(() => {
                          const PlatIcon = getPlatformMeta(clip.platform).icon;
                          return <PlatIcon className="h-3 w-3" />;
                        })()}
                        {getPlatformMeta(clip.platform).label}
                      </span>
                    </div>

                    {/* Viral score badge */}
                    <div className="absolute right-2 top-2">
                      <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold', getViralScoreColor(clip.viralScore))}>
                        <Flame className="h-3 w-3" />
                        {clip.viralScore}
                      </span>
                    </div>

                    {/* Duration */}
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(clip.duration)}
                    </span>

                    {/* Time range */}
                    <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatTimecode(clip.startTime)} - {formatTimecode(clip.endTime)}
                    </span>

                    {/* Export progress overlay */}
                    {clip.exporting && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs font-medium text-white">
                          Exporting... {Math.round(clip.exportProgress)}%
                        </span>
                        <Progress value={clip.exportProgress} className="h-1.5 w-3/4" />
                      </div>
                    )}

                    {/* Saved indicator */}
                    {clip.saved && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Check className="h-3 w-3" />
                        Saved
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-3 p-4">
                    {/* Title */}
                    <div>
                      <p className="truncate text-sm font-semibold" title={clip.title}>
                        {clip.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {clip.momentCategory}
                      </p>
                    </div>

                    {/* Predictions */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-amber-400">
                          <Flame className="h-3 w-3" />
                        </div>
                        <p className="mt-0.5 text-sm font-bold">{clip.viralScore}</p>
                        <p className="text-[9px] text-muted-foreground">Viral</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-400">
                          <Target className="h-3 w-3" />
                        </div>
                        <p className="mt-0.5 text-sm font-bold">{clip.ctrPrediction}%</p>
                        <p className="text-[9px] text-muted-foreground">CTR</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-emerald-400">
                          <TrendingUp className="h-3 w-3" />
                        </div>
                        <p className="mt-0.5 text-sm font-bold">{clip.retentionPrediction}%</p>
                        <p className="text-[9px] text-muted-foreground">Retention</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-violet-400">
                          <Clock className="h-3 w-3" />
                        </div>
                        <p className="mt-0.5 text-sm font-bold">{clip.watchTimePrediction}s</p>
                        <p className="text-[9px] text-muted-foreground">Watch</p>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1.5">
                      {FEATURE_ICONS.filter((f) => clip.features[f.key]).map((f) => (
                        <span
                          key={f.key}
                          className="flex items-center gap-1 rounded-md border border-border bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          title={f.label}
                        >
                          <f.icon className="h-2.5 w-2.5" />
                          {f.label}
                        </span>
                      ))}
                    </div>

                    {/* SEO Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground">SEO Score:</span>
                      <div className="flex items-center gap-1.5">
                        <Progress value={clip.seoScore} className="h-1.5 w-20" />
                        <span className="text-[10px] font-bold">{clip.seoScore}</span>
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {clip.aiRecommendation}
                        </p>
                      </div>
                    </div>

                    {/* SEO Title & Description */}
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground">SEO Title:</span>
                        <p className="text-xs font-medium">{clip.seoTitle}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground">SEO Description:</span>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {clip.seoDescription}
                        </p>
                      </div>
                    </div>

                    {/* Hashtags */}
                    <div className="flex flex-wrap items-center gap-1">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {clip.hashtags.map((tag) => (
                        <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewClip(clip)}
                        className="gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToEditor(clip)}
                        className="gap-1.5"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportClip(clip)}
                        disabled={clip.exporting}
                        className="gap-1.5"
                      >
                        {clip.exporting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Export
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToPublishing(clip)}
                        className="gap-1.5"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        Publish
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToCalendar(clip)}
                        className="gap-1.5"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant={clip.saved ? 'secondary' : 'default'}
                        onClick={() => handleSaveClip(clip)}
                        disabled={clip.saving || clip.saved}
                        className="gap-1.5"
                      >
                        {clip.saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : clip.saved ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {clip.saved ? 'Saved' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleFavorite(clip)}
                        className={cn('gap-1.5', clip.favorite && 'text-amber-400')}
                      >
                        <Heart className={cn('h-3.5 w-3.5', clip.favorite && 'fill-amber-400')} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Existing saved clips ─────────────────────────────────────────── */}
      {!generating && generatedClips.length === 0 && existingClips.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Saved Clips
              <Badge variant="secondary" className="ml-2">
                {existingClips.length}
              </Badge>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {existingClips.slice(0, 6).map((clip, i) => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
              >
                <Card className="glass glass-hover overflow-hidden p-0">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {clip.thumbnail_url ? (
                      <img
                        src={clip.thumbnail_url}
                        alt={clip.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5">
                        <Scissors className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 flex gap-1.5">
                      {clip.version && (
                        <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', getVersionColor(clip.version as ClipVersion))}>
                          {clip.version}
                        </span>
                      )}
                      {clip.platform && (
                        <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold', getPlatformMeta(clip.platform as PlatformId).color)}>
                          {getPlatformMeta(clip.platform as PlatformId).label}
                        </span>
                      )}
                    </div>
                    {clip.viral_score ? (
                      <div className="absolute right-2 top-2">
                        <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold', getViralScoreColor(clip.viral_score))}>
                          <Flame className="h-3 w-3" />
                          {clip.viral_score}
                        </span>
                      </div>
                    ) : null}
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(Number(clip.duration_seconds) || 0)}
                    </span>
                    {clip.favorite && (
                      <div className="absolute bottom-2 right-2">
                        <Heart className="h-4 w-4 fill-amber-400 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{clip.title}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(clip.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {clip.status || 'generated'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Preview Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewClip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewClip(null)}
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
                  <h3 className="truncate font-display text-sm font-semibold" title={previewClip.title}>
                    {previewClip.title}
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setPreviewClip(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Video player */}
                <div className="relative aspect-video w-full bg-black">
                  {previewClip.sourceVideoUrl ? (
                    <video
                      src={previewClip.sourceVideoUrl}
                      className="h-full w-full"
                      controls
                      autoPlay
                      // Seek to clip start
                      onLoadedMetadata={(e) => {
                        e.currentTarget.currentTime = previewClip.startTime;
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                      <Play className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Video preview not available
                      </p>
                      {previewClip.thumbnailUrl && (
                        <img
                          src={previewClip.thumbnailUrl}
                          alt={previewClip.title}
                          className="absolute inset-0 h-full w-full object-cover opacity-30"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Clip info */}
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-semibold', getVersionColor(previewClip.version))}>
                      {previewClip.version}
                    </span>
                    <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold', getPlatformMeta(previewClip.platform).color)}>
                      {(() => {
                        const PlatIcon = getPlatformMeta(previewClip.platform).icon;
                        return <PlatIcon className="h-3 w-3" />;
                      })()}
                      {getPlatformMeta(previewClip.platform).label}
                    </span>
                    <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold', getViralScoreColor(previewClip.viralScore))}>
                      <Flame className="h-3 w-3" />
                      Viral Score: {previewClip.viralScore}
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      {formatDuration(previewClip.duration)}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {formatTimecode(previewClip.startTime)} - {formatTimecode(previewClip.endTime)}
                    </Badge>
                  </div>

                  {/* Predictions */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                      <p className="text-sm font-bold text-amber-400">{previewClip.viralScore}</p>
                      <p className="text-[10px] text-muted-foreground">Viral Score</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                      <p className="text-sm font-bold text-blue-400">{previewClip.ctrPrediction}%</p>
                      <p className="text-[10px] text-muted-foreground">CTR Prediction</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                      <p className="text-sm font-bold text-emerald-400">{previewClip.retentionPrediction}%</p>
                      <p className="text-[10px] text-muted-foreground">Retention</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-2 text-center">
                      <p className="text-sm font-bold text-violet-400">{previewClip.seoScore}</p>
                      <p className="text-[10px] text-muted-foreground">SEO Score</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5">
                    {FEATURE_ICONS.filter((f) => previewClip.features[f.key]).map((f) => (
                      <span
                        key={f.key}
                        className="flex items-center gap-1 rounded-md border border-border bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <f.icon className="h-2.5 w-2.5" />
                        {f.label}
                      </span>
                    ))}
                  </div>

                  {/* SEO */}
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground">SEO Title:</span>
                      <p className="text-xs font-medium">{previewClip.seoTitle}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground">SEO Description:</span>
                      <p className="text-xs text-muted-foreground">{previewClip.seoDescription}</p>
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div className="flex flex-wrap items-center gap-1">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    {previewClip.hashtags.map((tag) => (
                      <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>

                  {/* AI Recommendation */}
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
                    <div className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {previewClip.aiRecommendation}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    <Button size="sm" onClick={() => handleSaveClip(previewClip)} disabled={previewClip.saved || previewClip.saving} className="gap-1.5">
                      {previewClip.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : previewClip.saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                      {previewClip.saved ? 'Saved' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPreviewClip(null); navigateToEditor(previewClip); }} className="gap-1.5">
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPreviewClip(null); navigateToPublishing(previewClip); }} className="gap-1.5">
                      <Youtube className="h-3.5 w-3.5" />
                      Publish
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPreviewClip(null); navigateToCalendar(previewClip); }} className="gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
