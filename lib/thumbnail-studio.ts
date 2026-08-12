import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThumbnailVariation {
  id: string;
  imageUrl: string;
  ctrPrediction: number;
  visualScore: number;
  seoScore: number;
  readabilityScore: number;
  emotionScore: number;
  mobileVisibility: number;
  desktopVisibility: number;
  concept: string;
  suggestions: string[];
}

export interface ThumbnailAnalysis {
  predictedCtr: number;
  clickProbability: number;
  visualAttentionScore: number;
  emotionScore: number;
  faceDetection: boolean;
  eyeContact: boolean;
  textReadability: number;
  colorContrast: number;
  focusPoint: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ABTestMultiResult {
  variants: ThumbnailAnalysis[];
  winnerIndex: number;
  confidenceScore: number;
  recommendation: string;
  improvementTips: string[];
}

export interface ThumbnailRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  status: 'draft' | 'generated' | 'published';
  image_url: string | null;
  storage_path: string | null;
  ctr_prediction: number;
  visual_score: number;
  seo_score: number;
  readability_score: number;
  emotion_score: number;
  mobile_visibility: number;
  desktop_visibility: number;
  is_favorite: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ThumbnailVersionRow {
  id: string;
  thumbnail_id: string;
  version_number: number;
  label: string | null;
  image_url: string | null;
  storage_path: string | null;
  layers: Record<string, unknown>;
  created_at: string;
}

export interface ABTestRow {
  id: string;
  user_id: string;
  video_title: string;
  target_audience: string | null;
  variants: Array<{ thumbnail_id: string; image_url: string; scores: Record<string, number> }>;
  winner_index: number | null;
  confidence_score: number;
  ai_recommendation: string | null;
  published: boolean;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  user_id: string | null;
  name: string;
  niche: string;
  preview_url: string | null;
  layers: Record<string, unknown>;
  brand_style: string | null;
  is_public: boolean;
  created_at: string;
}

export interface AIPromptRow {
  id: string;
  user_id: string;
  prompt: string;
  model: string;
  style: string | null;
  result_url: string | null;
  storage_path: string | null;
  is_favorite: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callThumbnailTools<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
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

  const res = await fetch(`${supabaseUrl}/functions/v1/thumbnail-tools`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`thumbnail-tools edge function failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Generation ──────────────────────────────────────────────────────────────

export async function generateThumbnails(params: {
  title: string;
  script?: string;
  description?: string;
  keywords?: string;
  audience?: string;
  category?: string;
  emotion?: string;
  brandStyle?: string;
}): Promise<{ variations: ThumbnailVariation[] }> {
  return callThumbnailTools<{ variations: ThumbnailVariation[] }>('generate', {
    title: params.title,
    script: params.script ?? '',
    description: params.description ?? '',
    keywords: params.keywords ?? '',
    audience: params.audience ?? '',
    category: params.category ?? 'General',
    emotion: params.emotion ?? 'exciting',
    brandStyle: params.brandStyle ?? '',
  });
}

export async function analyzeThumbnail(params: {
  imageUrl: string;
  title?: string;
  audience?: string;
}): Promise<{ analysis: ThumbnailAnalysis }> {
  return callThumbnailTools<{ analysis: ThumbnailAnalysis }>('analyze', {
    imageUrl: params.imageUrl,
    title: params.title ?? '',
    audience: params.audience ?? '',
  });
}

export async function abTestThumbnails(params: {
  thumbnails: string[];
  videoTitle: string;
  targetAudience?: string;
}): Promise<ABTestMultiResult> {
  return callThumbnailTools<ABTestMultiResult>('ab-test', {
    thumbnails: params.thumbnails,
    videoTitle: params.videoTitle,
    targetAudience: params.targetAudience ?? '',
  });
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const BUCKET = 'creatoros-assets';

export async function uploadThumbnailFile(
  file: File | Blob,
  userId: string,
  subdir: 'generated' | 'draft' | 'published' | 'versions' | 'exports' = 'generated',
): Promise<{ url: string; path: string }> {
  const ext = file instanceof File ? (file.name.split('.').pop() ?? 'png') : 'png';
  const path = `${userId}/thumbnails/${subdir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'image/png',
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function uploadAssetFile(
  file: File,
  userId: string,
  subdir: string = 'assets',
): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${subdir}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteStorageFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── Thumbnails CRUD ─────────────────────────────────────────────────────────

export async function fetchThumbnails(status?: string): Promise<ThumbnailRow[]> {
  let query = supabase
    .from('thumbnails')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch thumbnails: ${error.message}`);
  return (data ?? []) as ThumbnailRow[];
}

export async function insertThumbnail(
  row: Omit<ThumbnailRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<ThumbnailRow> {
  const { data, error } = await supabase
    .from('thumbnails')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return data as ThumbnailRow;
}

export async function updateThumbnail(
  id: string,
  updates: Partial<ThumbnailRow>,
): Promise<ThumbnailRow> {
  const { data, error } = await supabase
    .from('thumbnails')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Update failed: ${error.message}`);
  return data as ThumbnailRow;
}

export async function deleteThumbnail(id: string, storagePath?: string): Promise<void> {
  if (storagePath) await deleteStorageFile(storagePath);
  const { error } = await supabase.from('thumbnails').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── Versions ────────────────────────────────────────────────────────────────

export async function fetchVersions(thumbnailId: string): Promise<ThumbnailVersionRow[]> {
  const { data, error } = await supabase
    .from('thumbnail_versions')
    .select('*')
    .eq('thumbnail_id', thumbnailId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(`Failed to fetch versions: ${error.message}`);
  return (data ?? []) as ThumbnailVersionRow[];
}

export async function insertVersion(
  row: Omit<ThumbnailVersionRow, 'id' | 'user_id' | 'created_at'>,
): Promise<ThumbnailVersionRow> {
  const { data, error } = await supabase
    .from('thumbnail_versions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Version insert failed: ${error.message}`);
  return data as ThumbnailVersionRow;
}

export async function deleteVersion(id: string, storagePath?: string): Promise<void> {
  if (storagePath) await deleteStorageFile(storagePath);
  const { error } = await supabase.from('thumbnail_versions').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── A/B Tests ───────────────────────────────────────────────────────────────

export async function fetchABTests(): Promise<ABTestRow[]> {
  const { data, error } = await supabase
    .from('thumbnail_ab_tests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch A/B tests: ${error.message}`);
  return (data ?? []) as ABTestRow[];
}

export async function insertABTest(
  row: Omit<ABTestRow, 'id' | 'user_id' | 'created_at'>,
): Promise<ABTestRow> {
  const { data, error } = await supabase
    .from('thumbnail_ab_tests')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return data as ABTestRow;
}

export async function deleteABTest(id: string): Promise<void> {
  const { error } = await supabase.from('thumbnail_ab_tests').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function fetchTemplates(niche?: string): Promise<TemplateRow[]> {
  let query = supabase
    .from('thumbnail_templates')
    .select('*')
    .or('is_public.eq.true,user_id.is.null')
    .order('created_at', { ascending: false });

  if (niche && niche !== 'All') query = query.eq('niche', niche);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
  return (data ?? []) as TemplateRow[];
}

export async function fetchMyTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('thumbnail_templates')
    .select('*')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
  return (data ?? []) as TemplateRow[];
}

export async function insertTemplate(
  row: Omit<TemplateRow, 'id' | 'created_at'>,
): Promise<TemplateRow> {
  const { data, error } = await supabase
    .from('thumbnail_templates')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return data as TemplateRow;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('thumbnail_templates').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── AI Prompts ───────────────────────────────────────────────────────────────

export async function fetchAIPrompts(): Promise<AIPromptRow[]> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch prompts: ${error.message}`);
  return (data ?? []) as AIPromptRow[];
}

export async function insertAIPrompt(
  row: Omit<AIPromptRow, 'id' | 'user_id' | 'created_at'>,
): Promise<AIPromptRow> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return data as AIPromptRow;
}

export async function updateAIPrompt(
  id: string,
  updates: Partial<AIPromptRow>,
): Promise<AIPromptRow> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Update failed: ${error.message}`);
  return data as AIPromptRow;
}

export async function deleteAIPrompt(id: string, storagePath?: string): Promise<void> {
  if (storagePath) await deleteStorageFile(storagePath);
  const { error } = await supabase.from('ai_prompts').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
