import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScriptGenerationRequest {
  keyword: string;
  audience: string;
  durationMinutes: number;
  language: string;
}

export interface ScriptGeneration {
  title: string;
  content: string;
  hook: string;
  sections: { heading: string; body: string }[];
  cta: string;
  estimatedWordCount: number;
  estimatedReadTime: string;
  metadata: {
    keyword: string;
    audience: string;
    durationMinutes: number;
    language: string;
    model: string;
    generatedAt: string;
  };
}

export interface StoryboardScene {
  sceneNumber: number;
  description: string;
  visualSuggestion: string;
  dialogue: string;
  duration: string;
  cameraAngle?: string;
  notes?: string;
}

export interface StoryboardResult {
  scenes: StoryboardScene[];
  totalDuration: string;
  metadata: {
    scriptLength: number;
    sceneCount: number;
    model: string;
    generatedAt: string;
  };
}

export interface HookVariation {
  id: string;
  text: string;
  type: string;
  engagementScore: number;
  reasoning: string;
}

export interface HookResult {
  hooks: HookVariation[];
  metadata: {
    topic: string;
    count: number;
    model: string;
    generatedAt: string;
  };
}

export type CTAType = 'subscribe' | 'like' | 'comment' | 'link' | 'custom';

export interface CTAVariation {
  id: string;
  text: string;
  type: CTAType;
  placement: string;
  engagementScore: number;
  reasoning: string;
}

export interface CTAResult {
  ctas: CTAVariation[];
  metadata: {
    topic: string;
    ctaType: CTAType;
    count: number;
    model: string;
    generatedAt: string;
  };
}

export interface RewriteResult {
  content: string;
  changes: string[];
  metadata: {
    tone: string;
    style: string;
    originalLength: number;
    rewrittenLength: number;
    model: string;
    generatedAt: string;
  };
}

export interface TranslationResult {
  content: string;
  targetLanguage: string;
  sourceLanguage: string;
  notes: string[];
  metadata: {
    originalLength: number;
    translatedLength: number;
    model: string;
    generatedAt: string;
  };
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callAIStudio<T>(action: string, params: Record<string, unknown>): Promise<T> {
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

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-studio`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Studio edge function failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function generateScript(req: ScriptGenerationRequest): Promise<ScriptGeneration> {
  return callAIStudio<ScriptGeneration>('generate-script', {
    keyword: req.keyword,
    audience: req.audience,
    durationMinutes: req.durationMinutes,
    language: req.language,
  });
}

export async function generateStoryboard(script: string): Promise<StoryboardResult> {
  return callAIStudio<StoryboardResult>('generate-storyboard', { script });
}

export async function generateHooks(topic: string, count: number): Promise<HookResult> {
  return callAIStudio<HookResult>('generate-hooks', { topic, count });
}

export async function generateCTAs(topic: string, ctaType: CTAType, customText?: string): Promise<CTAResult> {
  return callAIStudio<CTAResult>('generate-cta', { topic, ctaType, customText });
}

export async function rewriteScript(
  originalScript: string,
  tone: string,
  style: string,
): Promise<RewriteResult> {
  return callAIStudio<RewriteResult>('rewrite-script', {
    originalScript,
    tone,
    style,
  });
}

export async function translateScript(
  script: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  return callAIStudio<TranslationResult>('translate-script', {
    script,
    targetLanguage,
  });
}

// ─── Utility: Copy to Clipboard ──────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
