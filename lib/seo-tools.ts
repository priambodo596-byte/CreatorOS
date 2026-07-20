import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedTitle {
  title: string;
  seoScore: number;
  reasons: string[];
  characterCount: number;
  wordCount: number;
}

export interface TitleGenerationResult {
  titles: GeneratedTitle[];
  keyword: string;
  generatedAt: string;
}

export interface GeneratedTag {
  tag: string;
  relevanceScore: number;
  category: string;
}

export interface TagGenerationResult {
  tags: GeneratedTag[];
  keyword: string;
  generatedAt: string;
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callSeoTools<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = `Bearer ${supabaseAnonKey}`;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/seo-tools`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`seo-tools edge function failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Title Generation ─────────────────────────────────────────────────────────

export async function generateTitles(params: {
  keyword: string;
  videoTopic: string;
  count?: number;
}): Promise<TitleGenerationResult> {
  return callSeoTools<TitleGenerationResult>('generate-titles', {
    keyword: params.keyword,
    videoTopic: params.videoTopic,
    count: params.count ?? 10,
  });
}

// ─── Tag Generation ───────────────────────────────────────────────────────────

export async function generateTags(params: {
  keyword: string;
  videoTitle: string;
  count?: number;
}): Promise<TagGenerationResult> {
  return callSeoTools<TagGenerationResult>('generate-tags', {
    keyword: params.keyword,
    videoTitle: params.videoTitle,
    count: params.count ?? 20,
  });
}

// ─── SEO Score Helper ─────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  if (score >= 40) return 'outline';
  return 'destructive';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Weak';
  return 'Poor';
}
