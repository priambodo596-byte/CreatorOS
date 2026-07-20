'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge,
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  Check,
  X,
  Lightbulb,
  Clock,
  TrendingUp,
  Target,
  Smile,
  Zap,
  Activity,
  Eye,
  ThumbsUp,
  Search,
  Youtube,
  Flame,
  BarChart3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface HookVideo {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration: number;
  source: string;
  viewCount?: number;
  likeCount?: number;
  tags?: string[];
  description?: string;
}

type HookType =
  | 'Curiosity'
  | 'Question'
  | 'Bold Statement'
  | 'Story'
  | 'Shock'
  | 'Problem'
  | 'Statistic'
  | 'Contrarian'
  | 'Educational';

interface EmotionPoint {
  second: number;
  intensity: number;
  label: string;
}

interface EmotionMarker {
  second: number;
  label: string;
  color: string;
}

interface AlternativeHook {
  text: string;
  type: HookType;
  score: number;
}

interface SecondBreakdown {
  range: string;
  label: string;
  description: string;
  score: number;
}

interface HookAnalysisResult {
  hookText: string;
  hookType: HookType;
  hookScore: number;
  hookDuration: number;
  retentionPrediction: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  alternativeHooks: AlternativeHook[];
  emotionTimeline: EmotionPoint[];
  emotionMarkers: EmotionMarker[];
  secondBreakdown: SecondBreakdown[];
  detectedEmotions: string[];
  powerWords: string[];
  curiosityGap: boolean;
  hasNumber: boolean;
}

interface HookAnalysisRow {
  id: string;
  user_id: string;
  video_id: string;
  video_url?: string;
  video_title?: string;
  source?: string;
  status?: string;
  hook_score?: number;
  hook_type?: string;
  hook_duration?: number;
  retention_prediction?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  alternative_hooks?: Array<{ text: string; type: string; score: number }>;
  emotion_timeline?: Array<{ second: number; intensity: number; label: string }>;
  emotion_markers?: Array<{ second: number; label: string; color: string }>;
  second_breakdown?: Array<{ range: string; label: string; description: string; score: number }>;
  detected_emotions?: string[];
  power_words?: string[];
  curiosity_gap?: boolean;
  has_number?: boolean;
  analysis_data?: Record<string, unknown>;
  created_at?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const HOOK_TYPES: HookType[] = [
  'Curiosity',
  'Question',
  'Bold Statement',
  'Story',
  'Shock',
  'Problem',
  'Statistic',
  'Contrarian',
  'Educational',
];

const POWER_WORDS = [
  'secret',
  'never',
  'always',
  'best',
  'worst',
  'ultimate',
  'proven',
  'shocking',
  'insane',
  'crazy',
  'amazing',
  'incredible',
  'impossible',
  'nobody',
  'everyone',
  'instantly',
  'guaranteed',
  'exposed',
  'truth',
  'lies',
  'mistake',
  'warning',
  'banned',
  'hidden',
  'forbidden',
];

const EMOTIONAL_WORDS = [
  'love',
  'hate',
  'fear',
  'angry',
  'happy',
  'sad',
  'excited',
  'shocked',
  'amazing',
  'terrible',
  'incredible',
  'devastating',
  'heartbreaking',
  'inspiring',
  'outrageous',
  'brilliant',
  'stunning',
  'unbelievable',
  'mind-blowing',
  'heartwarming',
];

const CURIOSITY_WORDS = [
  'secret',
  'hidden',
  'nobody',
  'everyone',
  'truth',
  'real',
  'actually',
  'really',
  'why',
  'what',
  'how',
  'mystery',
  'revealed',
  'exposed',
  'nobody tells',
  "don't want you to know",
];

const CONTRARIAN_WORDS = [
  'stop',
  'wrong',
  'myth',
  'lie',
  'fake',
  'nobody',
  'unpopular',
  'against',
  'contrary',
  'actually',
  'truth is',
  'reality is',
];

const PROBLEM_WORDS = [
  'problem',
  'struggle',
  'fail',
  'mistake',
  'issue',
  'frustrated',
  'stuck',
  'can\'t',
  'cannot',
  'difficult',
  'overwhelmed',
  'exhausted',
];

const SHOCK_WORDS = [
  'shocking',
  'insane',
  'crazy',
  'unbelievable',
  'mind-blowing',
  'unexpected',
  'never',
  'wait',
  'stop',
  'wow',
  'omg',
  'no way',
];

const STORY_WORDS = [
  'story',
  'journey',
  'day',
  'life',
  'happened',
  'when i',
  'i tried',
  'i was',
  'experience',
  'adventure',
  'memoir',
  'remember',
];

const BOLD_WORDS = [
  'best',
  'worst',
  'greatest',
  'most',
  'number one',
  'ultimate',
  'perfect',
  'only',
  'must',
  'need',
  'guaranteed',
  'definitely',
  'absolutely',
];

const ANALYSIS_STAGES = [
  'Extracting hook text...',
  'Detecting hook type...',
  'Analyzing emotional triggers...',
  'Computing hook score...',
  'Generating alternative hooks...',
  'Building emotion timeline...',
  'Predicting retention...',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimecode(seconds: number): string {
  if (!seconds || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getSourceBadge(source: string): { label: string; color: string } {
  const s = (source || '').toLowerCase();
  if (s.includes('youtube')) return { label: 'YouTube', color: 'bg-red-500/20 text-red-400' };
  if (s.includes('upload') || s.includes('local')) return { label: 'Upload', color: 'bg-blue-500/20 text-blue-400' };
  if (s.includes('drive')) return { label: 'Drive', color: 'bg-green-500/20 text-green-400' };
  if (s.includes('dropbox')) return { label: 'Dropbox', color: 'bg-indigo-500/20 text-indigo-400' };
  return { label: source || 'Video', color: 'bg-muted/30 text-muted-foreground' };
}

function getScoreColor(score: number): { text: string; bg: string; border: string; hex: string } {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50', hex: '#22c55e' };
  if (score >= 50) return { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', hex: '#eab308' };
  return { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', hex: '#ef4444' };
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 35) return 'Weak';
  return 'Poor';
}

function getHookTypeColor(type: HookType): string {
  const colors: Record<HookType, string> = {
    Curiosity: 'text-purple-400 bg-purple-500/20',
    Question: 'text-blue-400 bg-blue-500/20',
    'Bold Statement': 'text-orange-400 bg-orange-500/20',
    Story: 'text-pink-400 bg-pink-500/20',
    Shock: 'text-red-400 bg-red-500/20',
    Problem: 'text-amber-400 bg-amber-500/20',
    Statistic: 'text-cyan-400 bg-cyan-500/20',
    Contrarian: 'text-violet-400 bg-violet-500/20',
    Educational: 'text-teal-400 bg-teal-500/20',
  };
  return colors[type] || 'text-muted-foreground bg-muted/20';
}

// ─── Hook Analysis Engine ───────────────────────────────────────────────────

function detectHookType(title: string): HookType {
  const lower = title.toLowerCase().trim();

  // Question — ends with ? or starts with question word
  if (lower.includes('?') || /^(why|what|how|when|where|who|which|are|is|do|does|can|could|would|should|will)\b/.test(lower)) {
    return 'Question';
  }

  // Contrarian — goes against common belief
  if (CONTRARIAN_WORDS.some((w) => lower.includes(w))) {
    return 'Contrarian';
  }

  // Shock — extreme surprise
  if (SHOCK_WORDS.some((w) => lower.includes(w))) {
    return 'Shock';
  }

  // Statistic — contains a number (not just "how to 5 things")
  if (/\b\d+\b/.test(lower) && !lower.startsWith('how to')) {
    return 'Statistic';
  }

  // Problem — pain point language
  if (PROBLEM_WORDS.some((w) => lower.includes(w))) {
    return 'Problem';
  }

  // Story — narrative framing
  if (STORY_WORDS.some((w) => lower.includes(w))) {
    return 'Story';
  }

  // Bold Statement — superlatives / absolutes
  if (BOLD_WORDS.some((w) => lower.includes(w))) {
    return 'Bold Statement';
  }

  // Educational — how-to / tutorial
  if (lower.startsWith('how to') || lower.includes('tutorial') || lower.includes('guide') || lower.includes('learn')) {
    return 'Educational';
  }

  // Curiosity — curiosity gap words
  if (CURIOSITY_WORDS.some((w) => lower.includes(w))) {
    return 'Curiosity';
  }

  return 'Curiosity';
}

function computeHookScore(
  title: string,
  hookType: HookType,
  hasNumber: boolean,
  hasPowerWord: boolean,
  hasEmotionalWord: boolean,
  hasCuriosityGap: boolean,
): number {
  let score = 40; // baseline

  // Title length sweet spot: 40-70 chars
  const len = title.length;
  if (len >= 40 && len <= 70) score += 15;
  else if (len >= 25 && len < 40) score += 10;
  else if (len > 70 && len <= 90) score += 5;
  else if (len < 25) score -= 5;
  else if (len > 90) score -= 10;

  // Presence of numbers
  if (hasNumber) score += 12;

  // Power words
  if (hasPowerWord) score += 15;

  // Emotional words
  if (hasEmotionalWord) score += 12;

  // Curiosity gap
  if (hasCuriosityGap) score += 16;

  // Hook type weighting — some types perform better on average
  const typeBonus: Record<HookType, number> = {
    Curiosity: 10,
    Question: 8,
    'Bold Statement': 7,
    Story: 6,
    Shock: 9,
    Problem: 5,
    Statistic: 6,
    Contrarian: 8,
    Educational: 4,
  };
  score += typeBonus[hookType] || 0;

  // Penalty: all caps (screaming)
  if (title === title.toUpperCase() && title.length > 10) score -= 8;

  // Penalty: too many clicks-style words
  const clickbaitCount = (title.match(/!/g) || []).length;
  if (clickbaitCount > 2) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateStrengths(
  score: number,
  hookType: HookType,
  hasNumber: boolean,
  hasPowerWord: boolean,
  hasEmotionalWord: boolean,
  hasCuriosityGap: boolean,
  title: string,
): string[] {
  const strengths: string[] = [];

  if (score >= 80) strengths.push('Exceptional hook strength — viewers will be pulled in immediately');
  if (hasCuriosityGap) strengths.push('Creates a curiosity gap that compels viewers to keep watching');
  if (hasNumber) strengths.push('Uses a specific number, which increases credibility and click-through');
  if (hasPowerWord) strengths.push('Contains power words that trigger an emotional response');
  if (hasEmotionalWord) strengths.push('Evokes emotion, increasing engagement and shareability');
  if (title.length >= 40 && title.length <= 70) strengths.push('Title length is in the optimal range (40-70 characters)');
  if (hookType === 'Question') strengths.push('Question format directly engages the viewer\'s mind');
  if (hookType === 'Story') strengths.push('Story-driven hook builds personal connection');
  if (hookType === 'Shock') strengths.push('Shock value captures attention in the critical first 3 seconds');
  if (hookType === 'Contrarian') strengths.push('Contrarian angle stands out from conventional content');
  if (hookType === 'Bold Statement') strengths.push('Bold claim creates immediate intrigue');
  if (hookType === 'Problem') strengths.push('Addresses a pain point the audience can identify with');
  if (hookType === 'Statistic') strengths.push('Data-backed hook lends authority and specificity');

  if (strengths.length === 0) {
    strengths.push('Hook is present and identifiable within the first 5 seconds');
  }

  return strengths.slice(0, 6);
}

function generateWeaknesses(
  score: number,
  hookType: HookType,
  hasNumber: boolean,
  hasPowerWord: boolean,
  hasEmotionalWord: boolean,
  hasCuriosityGap: boolean,
  title: string,
): string[] {
  const weaknesses: string[] = [];

  if (score < 50) weaknesses.push('Hook score is below average — risks losing viewers in the first 5 seconds');
  if (!hasCuriosityGap) weaknesses.push('No clear curiosity gap — viewers may not feel compelled to keep watching');
  if (!hasNumber) weaknesses.push('Lacks a specific number — adding one can boost credibility and CTR');
  if (!hasPowerWord) weaknesses.push('Few power words — emotional trigger could be stronger');
  if (!hasEmotionalWord) weaknesses.push('Limited emotional language — emotional hooks drive higher retention');
  if (title.length < 25) weaknesses.push('Title is too short to fully convey the hook\'s value');
  if (title.length > 90) weaknesses.push('Title is too long — may get truncated and lose impact');
  if (title === title.toUpperCase() && title.length > 10) weaknesses.push('All-caps title can feel like shouting and reduces trust');
  if (hookType === 'Educational') weaknesses.push('Educational hooks can feel dry — add curiosity or stakes');
  if ((title.match(/!/g) || []).length > 2) weaknesses.push('Too many exclamation marks can feel clickbait-y');

  if (weaknesses.length === 0) {
    weaknesses.push('Minor: consider A/B testing alternative hooks for marginal gains');
  }

  return weaknesses.slice(0, 6);
}

function generateRecommendations(
  hookType: HookType,
  score: number,
  hasNumber: boolean,
  hasCuriosityGap: boolean,
  title: string,
): string[] {
  const recs: string[] = [];

  if (score < 80) recs.push('Front-load the hook — deliver the most compelling idea in the first 3 seconds');
  if (!hasCuriosityGap) recs.push('Add a curiosity gap (e.g., "the one thing nobody tells you about...") to boost retention');
  if (!hasNumber) recs.push('Include a specific number or statistic to increase credibility (e.g., "7 ways..." instead of "ways to...")');
  if (title.length > 70) recs.push('Shorten the title to under 70 characters so it doesn\'t get truncated in feeds');
  if (title.length < 25) recs.push('Expand the title to at least 40 characters to fully communicate the hook\'s value');

  recs.push('Pair the verbal hook with a strong visual in the first frame — face + text overlay works best');
  recs.push('Add a pattern interrupt (sudden cut, sound effect, or movement) within the first 2 seconds');

  if (hookType === 'Educational') recs.push('Transform the educational hook into a curiosity hook by teasing the outcome first');
  if (hookType === 'Problem') recs.push('Immediately follow the problem statement with a promise of the solution');
  if (hookType === 'Story') recs.push('Start in the middle of the action — "in media res" — to maximize early engagement');
  if (hookType === 'Statistic') recs.push('Pair the statistic with a surprising comparison to amplify its impact');

  recs.push('Test 3+ thumbnail variants — the hook works best when thumbnail and title reinforce each other');

  return recs.slice(0, 8);
}

function generateAlternativeHooks(title: string, hookType: HookType, baseScore: number): AlternativeHook[] {
  const alts: AlternativeHook[] = [];
  const cleanTitle = title.replace(/[?!]+$/g, '').trim();
  const lower = cleanTitle.toLowerCase();

  // Extract a number if present
  const numberMatch = cleanTitle.match(/\b(\d+)\b/);
  const num = numberMatch ? numberMatch[1] : null;

  // Extract the core topic (remove leading "how to", "the", etc.)
  let topic = cleanTitle
    .replace(/^(how to|the|a|an|why|what|how)\s+/i, '')
    .replace(/^(is|are|do|does|can|could|would|should|will)\s+/i, '')
    .trim();
  if (!topic) topic = cleanTitle;

  // 1. Curiosity variant
  alts.push({
    text: `The truth about ${topic} nobody tells you`,
    type: 'Curiosity',
    score: Math.min(100, baseScore + 8 + Math.round(Math.random() * 5)),
  });

  // 2. Question variant
  alts.push({
    text: `What if everything you knew about ${topic} was wrong?`,
    type: 'Question',
    score: Math.min(100, baseScore + 6 + Math.round(Math.random() * 5)),
  });

  // 3. Statistic variant
  if (num) {
    alts.push({
      text: `${num} things about ${topic} that will change how you think`,
      type: 'Statistic',
      score: Math.min(100, baseScore + 5 + Math.round(Math.random() * 5)),
    });
  } else {
    alts.push({
      text: `7 things about ${topic} you didn't know`,
      type: 'Statistic',
      score: Math.min(100, baseScore + 4 + Math.round(Math.random() * 5)),
    });
  }

  // 4. Bold Statement variant
  alts.push({
    text: `This is the only ${topic} guide you'll ever need`,
    type: 'Bold Statement',
    score: Math.min(100, baseScore + 3 + Math.round(Math.random() * 5)),
  });

  // 5. Contrarian variant
  alts.push({
    text: `Stop doing ${topic} — here's what actually works`,
    type: 'Contrarian',
    score: Math.min(100, baseScore + 7 + Math.round(Math.random() * 5)),
  });

  // 6. Problem variant (if not already problem)
  if (hookType !== 'Problem') {
    alts.push({
      text: `The biggest ${topic} mistake (and how to fix it)`,
      type: 'Problem',
      score: Math.min(100, baseScore + 4 + Math.round(Math.random() * 5)),
    });
  }

  // Sort by score descending and take top 5
  alts.sort((a, b) => b.score - a.score);
  return alts.slice(0, 5);
}

function generateEmotionTimeline(hookType: HookType, score: number): EmotionPoint[] {
  const points: EmotionPoint[] = [];
  const baseIntensity = Math.min(90, 40 + score * 0.4);

  // Emotion profile per hook type — how intensity flows over 30 seconds
  const profiles: Record<HookType, (t: number) => { intensity: number; label: string }> = {
    Curiosity: (t) => {
      const intensity = t < 3 ? baseIntensity + 20 : t < 10 ? baseIntensity + 10 : baseIntensity - t * 0.8;
      return { intensity: Math.max(20, Math.round(intensity)), label: t < 5 ? 'Intrigue' : t < 15 ? 'Curiosity' : 'Anticipation' };
    },
    Question: (t) => {
      const intensity = t < 2 ? baseIntensity + 25 : t < 8 ? baseIntensity + 15 : baseIntensity - t * 0.6;
      return { intensity: Math.max(20, Math.round(intensity)), label: t < 5 ? 'Wonder' : t < 15 ? 'Engagement' : 'Reflection' };
    },
    'Bold Statement': (t) => {
      const intensity = t < 2 ? baseIntensity + 30 : t < 6 ? baseIntensity + 20 : baseIntensity - t * 0.5;
      return { intensity: Math.max(25, Math.round(intensity)), label: t < 5 ? 'Shock' : t < 15 ? 'Interest' : 'Agreement' };
    },
    Story: (t) => {
      const intensity = t < 3 ? baseIntensity + 10 : t < 12 ? baseIntensity + 15 : t < 20 ? baseIntensity + 5 : baseIntensity - t * 0.4;
      return { intensity: Math.max(25, Math.round(intensity)), label: t < 5 ? 'Empathy' : t < 15 ? 'Immersion' : 'Connection' };
    },
    Shock: (t) => {
      const intensity = t < 2 ? baseIntensity + 35 : t < 5 ? baseIntensity + 25 : baseIntensity - t * 0.7;
      return { intensity: Math.max(20, Math.round(intensity)), label: t < 3 ? 'Shock' : t < 12 ? 'Surprise' : 'Curiosity' };
    },
    Problem: (t) => {
      const intensity = t < 3 ? baseIntensity + 15 : t < 10 ? baseIntensity + 20 : baseIntensity - t * 0.5;
      return { intensity: Math.max(25, Math.round(intensity)), label: t < 5 ? 'Frustration' : t < 15 ? 'Recognition' : 'Hope' };
    },
    Statistic: (t) => {
      const intensity = t < 2 ? baseIntensity + 20 : t < 8 ? baseIntensity + 12 : baseIntensity - t * 0.6;
      return { intensity: Math.max(20, Math.round(intensity)), label: t < 5 ? 'Surprise' : t < 15 ? 'Interest' : 'Understanding' };
    },
    Contrarian: (t) => {
      const intensity = t < 2 ? baseIntensity + 28 : t < 7 ? baseIntensity + 22 : baseIntensity - t * 0.5;
      return { intensity: Math.max(25, Math.round(intensity)), label: t < 5 ? 'Surprise' : t < 15 ? 'Debate' : 'Reconsider' };
    },
    Educational: (t) => {
      const intensity = t < 3 ? baseIntensity + 8 : t < 15 ? baseIntensity + 10 : baseIntensity - t * 0.4;
      return { intensity: Math.max(25, Math.round(intensity)), label: t < 5 ? 'Interest' : t < 15 ? 'Learning' : 'Satisfaction' };
    },
  };

  const profile = profiles[hookType] || profiles.Curiosity;

  for (let s = 0; s <= 30; s++) {
    const { intensity, label } = profile(s);
    points.push({ second: s, intensity, label });
  }

  return points;
}

function generateEmotionMarkers(timeline: EmotionPoint[]): EmotionMarker[] {
  const markers: EmotionMarker[] = [];
  const labelColors: Record<string, string> = {
    Intrigue: '#a855f7',
    Curiosity: '#8b5cf6',
    Anticipation: '#6366f1',
    Wonder: '#3b82f6',
    Engagement: '#06b6d4',
    Reflection: '#0ea5e9',
    Shock: '#ef4444',
    Surprise: '#f97316',
    Interest: '#f59e0b',
    Agreement: '#eab308',
    Empathy: '#ec4899',
    Immersion: '#f472b6',
    Connection: '#d946ef',
    Frustration: '#dc2626',
    Recognition: '#f59e0b',
    Hope: '#22c55e',
    Debate: '#f97316',
    Reconsider: '#fb923c',
    Learning: '#14b8a6',
    Satisfaction: '#10b981',
    Understanding: '#0d9488',
  };

  // Place a marker at each emotion transition
  let lastLabel = '';
  for (const point of timeline) {
    if (point.label !== lastLabel) {
      markers.push({
        second: point.second,
        label: point.label,
        color: labelColors[point.label] || '#6366f1',
      });
      lastLabel = point.label;
    }
  }

  return markers;
}

function generateSecondBreakdown(hookType: HookType, score: number): SecondBreakdown[] {
  const openingScore = Math.min(100, Math.max(30, score + 5));
  const developmentScore = Math.min(100, Math.max(25, score - 5));
  const transitionScore = Math.min(100, Math.max(20, score - 10));

  const openingDesc: Record<HookType, string> = {
    Curiosity: 'Teases a mystery or unknown — viewer wants the answer',
    Question: 'Poses a direct question — viewer\'s mind is activated',
    'Bold Statement': 'Makes a bold claim — viewer is intrigued or skeptical',
    Story: 'Sets the scene — viewer is drawn into the narrative world',
    Shock: 'Delivers a shocking fact or visual — viewer is startled into attention',
    Problem: 'Names a pain point — viewer feels seen and understood',
    Statistic: 'Presents a striking number — viewer\'s attention is captured',
    Contrarian: 'Challenges a belief — viewer is surprised or curious',
    Educational: 'States the learning outcome — viewer knows what they\'ll gain',
  };

  const devDesc: Record<HookType, string> = {
    Curiosity: 'Builds the mystery — adds context without revealing the answer',
    Question: 'Explores implications — deepens the question\'s stakes',
    'Bold Statement': 'Provides evidence or context — supports the bold claim',
    Story: 'Develops the narrative — introduces conflict or tension',
    Shock: 'Explains the shocking fact — adds context and implications',
    Problem: 'Expands the pain — viewer feels the full weight of the issue',
    Statistic: 'Breaks down the number — explains why it matters',
    Contrarian: 'Presents the argument — builds the case against convention',
    Educational: 'Begins the lesson — first key steps or concepts',
  };

  const transDesc: Record<HookType, string> = {
    Curiosity: 'Hints at the payoff — promises the answer is coming',
    Question: 'Promises the answer — signals the solution is ahead',
    'Bold Statement': 'Transitions to proof — sets up the demonstration',
    Story: 'Reaches a turning point — viewer is invested in the outcome',
    Shock: 'Pivots to the explanation — viewer is ready to learn more',
    Problem: 'Pivots to the solution — viewer is ready for the fix',
    Statistic: 'Connects to the takeaway — viewer sees the bigger picture',
    Contrarian: 'Transitions to the solution — viewer is ready for the alternative',
    Educational: 'Transitions to the main content — viewer is ready to learn',
  };

  return [
    {
      range: '0-5s',
      label: 'Opening',
      description: openingDesc[hookType] || 'Delivers the initial hook',
      score: openingScore,
    },
    {
      range: '5-15s',
      label: 'Development',
      description: devDesc[hookType] || 'Develops the hook',
      score: developmentScore,
    },
    {
      range: '15-30s',
      label: 'Transition to main content',
      description: transDesc[hookType] || 'Transitions to main content',
      score: transitionScore,
    },
  ];
}

function computeRetentionPrediction(score: number, hookType: HookType): number {
  // Base retention from hook score
  let retention = 30 + score * 0.5;

  // Hook type adjustment
  const typeBonus: Record<HookType, number> = {
    Curiosity: 8,
    Question: 6,
    'Bold Statement': 4,
    Story: 7,
    Shock: 9,
    Problem: 3,
    Statistic: 5,
    Contrarian: 6,
    Educational: 2,
  };
  retention += typeBonus[hookType] || 0;

  return Math.min(95, Math.max(20, Math.round(retention)));
}

function analyzeHook(video: HookVideo): HookAnalysisResult {
  const title = video.title || '';
  const lower = title.toLowerCase();

  // Detect features
  const hasNumber = /\b\d+\b/.test(title);
  const foundPowerWords = POWER_WORDS.filter((w) => lower.includes(w));
  const foundEmotionalWords = EMOTIONAL_WORDS.filter((w) => lower.includes(w));
  const hasPowerWord = foundPowerWords.length > 0;
  const hasEmotionalWord = foundEmotionalWords.length > 0;
  const hasCuriosityGap = CURIOSITY_WORDS.some((w) => lower.includes(w));

  // Detect hook type
  const hookType = detectHookType(title);

  // Compute hook score
  const hookScore = computeHookScore(title, hookType, hasNumber, hasPowerWord, hasEmotionalWord, hasCuriosityGap);

  // Hook duration — how long the hook remains effective
  const hookDuration = Math.min(30, Math.max(5, Math.round(hookScore / 100 * 30)));

  // Retention prediction for first 30s
  const retentionPrediction = computeRetentionPrediction(hookScore, hookType);

  // Strengths / weaknesses / recommendations
  const strengths = generateStrengths(hookScore, hookType, hasNumber, hasPowerWord, hasEmotionalWord, hasCuriosityGap, title);
  const weaknesses = generateWeaknesses(hookScore, hookType, hasNumber, hasPowerWord, hasEmotionalWord, hasCuriosityGap, title);
  const recommendations = generateRecommendations(hookType, hookScore, hasNumber, hasCuriosityGap, title);

  // Alternative hooks
  const alternativeHooks = generateAlternativeHooks(title, hookType, hookScore);

  // Emotion timeline
  const emotionTimeline = generateEmotionTimeline(hookType, hookScore);
  const emotionMarkers = generateEmotionMarkers(emotionTimeline);

  // Second-by-second breakdown
  const secondBreakdown = generateSecondBreakdown(hookType, hookScore);

  // Detected emotions (unique labels from timeline)
  const detectedEmotions = Array.from(new Set(emotionTimeline.map((p) => p.label)));

  return {
    hookText: title.slice(0, 120),
    hookType,
    hookScore,
    hookDuration,
    retentionPrediction,
    strengths,
    weaknesses,
    recommendations,
    alternativeHooks,
    emotionTimeline,
    emotionMarkers,
    secondBreakdown,
    detectedEmotions,
    powerWords: foundPowerWords,
    curiosityGap: hasCuriosityGap,
    hasNumber,
  };
}

// ─── Circular Gauge Component ───────────────────────────────────────────────

function HookScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.hex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className={cn('font-display text-4xl font-bold', colors.text)}
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Hook Score
        </span>
        <span className={cn('mt-0.5 text-xs font-semibold', colors.text)}>
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function HookAnalyzerPage() {
  const { toast } = useToast();

  // Data state
  const [videoImports, setVideoImports] = useState<VideoImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedVideo, setSelectedVideo] = useState<HookVideo | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<HookAnalysisRow | null>(null);
  const [analysisResult, setAnalysisResult] = useState<HookAnalysisResult | null>(null);
  const [checkingAnalysis, setCheckingAnalysis] = useState(false);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // UI state
  const [search, setSearch] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'duration' | 'name'>('newest');

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

  // ─── Convert VideoImportRow to HookVideo ─────────────────────────────────────
  const toHookVideo = useCallback((row: VideoImportRow): HookVideo => {
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
      tags: meta.tags as string[] | undefined,
      description: meta.description as string | undefined,
    };
  }, []);

  // ─── Select a video and check for existing analysis ──────────────────────────
  const selectVideo = useCallback(
    async (row: VideoImportRow) => {
      const video = toHookVideo(row);
      setSelectedVideo(video);
      setSelectedImportId(row.id);
      setAnalysisResult(null);
      setExistingAnalysis(null);
      setCheckingAnalysis(true);

      try {
        const { data, error: queryError } = await supabase
          .from('hook_analyses')
          .select('*')
          .eq('video_id', row.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw queryError;

        if (data) {
          const analysisRow = data as HookAnalysisRow;
          setExistingAnalysis(analysisRow);

          if (analysisRow.status === 'completed' && analysisRow.analysis_data) {
            setAnalysisResult(analysisRow.analysis_data as unknown as HookAnalysisResult);
          }
        }
      } catch {
        // Silently fail — user can still run analysis
      } finally {
        setCheckingAnalysis(false);
      }
    },
    [toHookVideo],
  );

  // ─── Run hook analysis ───────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!selectedVideo) return;
    setAnalyzing(true);
    setAnalysisStage(0);
    setAnalysisProgress(0);

    // Run through stages with progress
    for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
      setAnalysisStage(i);
      const stageDuration = 500 + Math.random() * 300;
      const stageStart = (i / ANALYSIS_STAGES.length) * 100;
      const stageEnd = ((i + 1) / ANALYSIS_STAGES.length) * 100;
      const steps = 10;
      for (let j = 0; j < steps; j++) {
        await new Promise((resolve) => setTimeout(resolve, stageDuration / steps));
        setAnalysisProgress(Math.round(stageStart + ((stageEnd - stageStart) * (j + 1)) / steps));
      }
    }

    // Compute analysis
    const result = analyzeHook(selectedVideo);
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
        hook_type: result.hookType,
        hook_duration: result.hookDuration,
        retention_prediction: result.retentionPrediction,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        recommendations: result.recommendations,
        alternative_hooks: result.alternativeHooks,
        emotion_timeline: result.emotionTimeline,
        emotion_markers: result.emotionMarkers,
        second_breakdown: result.secondBreakdown,
        detected_emotions: result.detectedEmotions,
        power_words: result.powerWords,
        curiosity_gap: result.curiosityGap,
        has_number: result.hasNumber,
        analysis_data: result as unknown as Record<string, unknown>,
      };

      const { error: insertError } = await supabase.from('hook_analyses').insert(insertPayload);

      if (insertError) {
        toast({
          title: 'Analysis saved with warnings',
          description: insertError.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Hook analysis complete',
          description: `Score: ${result.hookScore} · ${result.hookType} hook detected.`,
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

  // ─── Analyze by URL ──────────────────────────────────────────────────────────
  const analyzeByUrl = useCallback(async () => {
    if (!urlInput.trim()) return;

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
    const video: HookVideo = {
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
      description: 'Click Analyze to run the hook analysis.',
    });
  }, [urlInput, toast]);

  // ─── Filtered & sorted video list ─────────────────────────────────────────────
  const filteredVideos = (() => {
    let list = videoImports.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      case 'duration':
        return list.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  })();

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Hook Analyzer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evaluate the first 30 seconds of your video — get a hook score, type detection, and AI-generated alternatives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-primary" />
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

      {/* ─── Main 3-Panel Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_340px] xl:grid-cols-[300px_1fr_380px]">
        {/* ─── Left Panel: Video Selection ──────────────────────────────────────── */}
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

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'newest' | 'duration' | 'name')}>
              <SelectTrigger className="mb-3 h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="duration">Longest first</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* Analyze by URL */}
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Youtube className="h-3.5 w-3.5 text-red-500" />
                Analyze by YouTube URL
              </label>
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
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <ErrorState message={error} onRetry={loadImports} />
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
                            <Play className="h-5 w-5 text-muted-foreground" />
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

        {/* ─── Center Panel: Hook Analysis ────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selectedVideo && !loading && (
            <EmptyState
              icon={Gauge}
              title="Select a video to analyze"
              description="Choose a video from your library or paste a YouTube URL to evaluate its hook."
            />
          )}

          {selectedVideo && (
            <>
              {/* Video Preview (first 30 seconds focus) */}
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
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  {/* 30-second focus indicator */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-amber-500/30 px-2.5 py-1 text-[10px] font-semibold text-amber-300 backdrop-blur-sm">
                    <Clock className="h-3 w-3" />
                    First 30s Focus
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display text-lg font-bold text-white">{selectedVideo.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimecode(selectedVideo.duration)}
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
                        : 'No analysis exists yet. Click below to evaluate the hook in the first 30 seconds.'}
                    </p>
                    <Button onClick={runAnalysis} className="mt-4" size="lg">
                      <Sparkles className="mr-2 h-4 w-4" />
                      {existingAnalysis ? 'Re-Analyze Hook' : 'Analyze Hook'}
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
                        <p className="text-sm font-medium">Hook Analysis in Progress</p>
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

              {/* Hook Score + Type + Duration + Retention */}
              {analysisResult && !analyzing && (
                <>
                  <Card className="glass p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] md:items-center">
                      {/* Circular Gauge */}
                      <div className="flex justify-center">
                        <HookScoreGauge score={analysisResult.hookScore} />
                      </div>

                      {/* Metrics */}
                      <div className="space-y-4">
                        {/* Hook Type */}
                        <div>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Hook Type Detected
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', getHookTypeColor(analysisResult.hookType))}>
                              {analysisResult.hookType}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {getScoreLabel(analysisResult.hookScore)}
                            </Badge>
                          </div>
                        </div>

                        {/* Hook Duration */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Hook Duration
                            </p>
                            <span className="text-xs font-bold">{analysisResult.hookDuration}s</span>
                          </div>
                          <Progress value={(analysisResult.hookDuration / 30) * 100} className="h-2" />
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            The hook remains effective for {analysisResult.hookDuration} of the first 30 seconds
                          </p>
                        </div>

                        {/* Retention Prediction */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              Retention Prediction (first 30s)
                            </p>
                            <span className="text-xs font-bold">{analysisResult.retentionPrediction}%</span>
                          </div>
                          <Progress
                            value={analysisResult.retentionPrediction}
                            className="h-2"
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Estimated {analysisResult.retentionPrediction}% of viewers will still be watching at 30 seconds
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 30-Second Timeline with Emotion Markers */}
                  <Card className="glass p-4">
                    <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                      <Activity className="h-4 w-4 text-primary" />
                      30-Second Timeline
                    </h3>

                    {/* Timeline bar */}
                    <div className="relative h-16 rounded-lg border border-border/50 bg-muted/20">
                      {/* Hook zone highlight */}
                      <div className="absolute top-0 bottom-0 left-0 rounded-l-lg bg-amber-500/15" style={{ width: '100%' }}>
                        <div className="absolute top-1 left-2 flex items-center gap-1 text-[9px] font-medium text-amber-400">
                          <Zap className="h-2.5 w-2.5" /> Hook Zone (0-30s)
                        </div>
                      </div>

                      {/* Emotion markers */}
                      {analysisResult.emotionMarkers.map((marker, i) => {
                        const left = (marker.second / 30) * 100;
                        return (
                          <div
                            key={i}
                            className="absolute -translate-x-1/2"
                            style={{ left: `${left}%`, bottom: '4px' }}
                            title={`${marker.label} @ ${marker.second}s`}
                          >
                            <div
                              className="flex h-5 items-center gap-1 rounded-full px-1.5 text-[9px] font-medium"
                              style={{ backgroundColor: `${marker.color}30`, color: marker.color }}
                            >
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: marker.color }} />
                              {marker.label}
                            </div>
                          </div>
                        );
                      })}

                      {/* Time ruler */}
                      <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] text-muted-foreground">
                        {[0, 5, 10, 15, 20, 25, 30].map((s) => (
                          <span key={s}>{s}s</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6" />
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        {/* ─── Right Panel: Detailed Analysis ─────────────────────────────────────── */}
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
                <p className="mt-3 text-sm text-muted-foreground">Analyzing hook...</p>
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
                {/* Strengths */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Check className="h-4 w-4 text-green-400" />
                    Strengths
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.strengths.map((strength, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                          <Check className="h-3 w-3 text-green-400" />
                        </div>
                        <p className="text-xs leading-relaxed">{strength}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Weaknesses */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <X className="h-4 w-4 text-red-400" />
                    Weaknesses
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.weaknesses.map((weakness, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                          <X className="h-3 w-3 text-red-400" />
                        </div>
                        <p className="text-xs leading-relaxed">{weakness}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Recommendations */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
                          <Lightbulb className="h-3 w-3 text-yellow-400" />
                        </div>
                        <p className="text-xs leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Alternative Hooks */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Alternative Hooks
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.alternativeHooks.map((alt, i) => {
                      const colors = getScoreColor(alt.score);
                      return (
                        <div key={i} className="rounded-lg bg-muted/20 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex-1 text-xs leading-relaxed">{alt.text}</p>
                            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold', colors.bg, colors.text)}>
                              {alt.score}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', getHookTypeColor(alt.type))}>
                              {alt.type}
                            </span>
                            {alt.score > analysisResult.hookScore && (
                              <Badge variant="outline" className="gap-1 text-[9px] text-green-400">
                                <TrendingUp className="h-2.5 w-2.5" />
                                +{alt.score - analysisResult.hookScore}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Emotion Timeline Chart */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Smile className="h-4 w-4 text-yellow-400" />
                    Emotion Timeline
                  </h3>
                  {/* Chart */}
                  <div className="relative h-32">
                    {/* Y-axis labels */}
                    <div className="absolute -left-1 top-0 bottom-0 flex flex-col justify-between text-[8px] text-muted-foreground">
                      <span>100</span>
                      <span>50</span>
                      <span>0</span>
                    </div>
                    {/* Chart area */}
                    <div className="ml-6 h-full">
                      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {/* Grid lines */}
                        <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeWidth="0.2" className="text-muted/20" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.2" className="text-muted/20" />
                        <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeWidth="0.2" className="text-muted/20" />
                        {/* Area fill */}
                        <motion.path
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                          d={`M 0 ${100 - analysisResult.emotionTimeline[0]?.intensity || 50} ${analysisResult.emotionTimeline
                            .map((p) => `L ${(p.second / 30) * 100} ${100 - p.intensity}`)
                            .join(' ')} L 100 100 L 0 100 Z`}
                          fill="url(#emotionGradient)"
                        />
                        {/* Line */}
                        <motion.path
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                          d={`M 0 ${100 - analysisResult.emotionTimeline[0]?.intensity || 50} ${analysisResult.emotionTimeline
                            .map((p) => `L ${(p.second / 30) * 100} ${100 - p.intensity}`)
                            .join(' ')}`}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                        <defs>
                          <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                  {/* X-axis */}
                  <div className="ml-6 mt-1 flex justify-between text-[8px] text-muted-foreground">
                    {[0, 5, 10, 15, 20, 25, 30].map((s) => (
                      <span key={s}>{s}s</span>
                    ))}
                  </div>
                  {/* Emotion legend */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {analysisResult.detectedEmotions.map((emotion, i) => {
                      const marker = analysisResult.emotionMarkers.find((m) => m.label === emotion);
                      return (
                        <span
                          key={i}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                          style={{
                            backgroundColor: `${marker?.color || '#6366f1'}20`,
                            color: marker?.color || '#6366f1',
                          }}
                        >
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: marker?.color || '#6366f1' }} />
                          {emotion}
                        </span>
                      );
                    })}
                  </div>
                </Card>

                {/* First 30 Seconds Breakdown */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Target className="h-4 w-4 text-primary" />
                    First 30 Seconds Breakdown
                  </h3>
                  <div className="space-y-3">
                    {analysisResult.secondBreakdown.map((phase, i) => {
                      const colors = getScoreColor(phase.score);
                      return (
                        <div key={i} className="rounded-lg bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-bold">
                                {phase.range}
                              </Badge>
                              <span className="text-xs font-semibold">{phase.label}</span>
                            </div>
                            <span className={cn('text-xs font-bold', colors.text)}>{phase.score}</span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            {phase.description}
                          </p>
                          <Progress value={phase.score} className="mt-2 h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Hook Text */}
                <Card className="glass p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Hook Text
                  </h3>
                  <div className="rounded-lg bg-amber-500/10 p-3">
                    <p className="text-xs italic leading-relaxed">&ldquo;{analysisResult.hookText}&rdquo;</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {analysisResult.hasNumber && (
                      <Badge variant="outline" className="gap-1 text-[10px] text-cyan-400">
                        <BarChart3 className="h-3 w-3" /> Has Number
                      </Badge>
                    )}
                    {analysisResult.curiosityGap && (
                      <Badge variant="outline" className="gap-1 text-[10px] text-purple-400">
                        <Sparkles className="h-3 w-3" /> Curiosity Gap
                      </Badge>
                    )}
                    {analysisResult.powerWords.length > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px] text-orange-400">
                        <Flame className="h-3 w-3" /> {analysisResult.powerWords.length} Power Word{analysisResult.powerWords.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
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
