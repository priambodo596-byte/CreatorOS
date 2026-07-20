import { supabase, supabaseUrl, supabaseAnonKey } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubtitleResult {
  srt: string;
  vtt: string;
  language: string;
  segmentCount: number;
  durationSeconds: number;
}

export interface VoiceoverResult {
  audioUrl: string;
  audioBase64?: string;
  durationSeconds: number;
  voiceModel: string;
  sampleRate: number;
}

export interface ABTestResult {
  thumbnailA: {
    predictedCtr: number;
    clickProbability: number;
    strengths: string[];
    weaknesses: string[];
  };
  thumbnailB: {
    predictedCtr: number;
    clickProbability: number;
    strengths: string[];
    weaknesses: string[];
  };
  winner: 'A' | 'B';
  confidenceScore: number;
  recommendation: string;
  improvementTips: string[];
}

export interface AssetItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  size: number;
  duration?: number;
  thumbnail_url?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ─── Edge Function Helper ────────────────────────────────────────────────────

async function callVideoTools<T>(action: string, payload: Record<string, unknown>): Promise<T> {
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

  const res = await fetch(`${supabaseUrl}/functions/v1/video-tools`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`video-tools edge function failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Subtitles ────────────────────────────────────────────────────────────────

export async function generateSubtitles(params: {
  videoId: string;
  language?: string;
  videoUrl?: string;
}): Promise<SubtitleResult> {
  return callVideoTools<SubtitleResult>('subtitles', {
    videoId: params.videoId,
    language: params.language ?? 'en',
    videoUrl: params.videoUrl,
  });
}

// ─── Voice Over ───────────────────────────────────────────────────────────────

export async function generateVoiceover(params: {
  text: string;
  voiceModel: string;
  speed: number;
  pitch: number;
}): Promise<VoiceoverResult> {
  return callVideoTools<VoiceoverResult>('voiceover', {
    text: params.text,
    voiceModel: params.voiceModel,
    speed: params.speed,
    pitch: params.pitch,
  });
}

// ─── A/B Thumbnail Testing ────────────────────────────────────────────────────

export async function analyzeThumbnails(params: {
  thumbnailAUrl: string;
  thumbnailBUrl: string;
  videoTitle: string;
  targetAudience?: string;
}): Promise<ABTestResult> {
  return callVideoTools<ABTestResult>('ab-testing', {
    thumbnailAUrl: params.thumbnailAUrl,
    thumbnailBUrl: params.thumbnailBUrl,
    videoTitle: params.videoTitle,
    targetAudience: params.targetAudience ?? '',
  });
}

// ─── Upload thumbnail to Supabase Storage ─────────────────────────────────────

export async function uploadThumbnail(file: File, slot: 'a' | 'b'): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const fileExt = file.name.split('.').pop() ?? 'png';
  const fileName = `ab-test/${userId}/${slot}-${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from('thumbnails')
    .upload(fileName, file, { upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: publicUrlData } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// ─── Asset Library (B-Roll & Music) ───────────────────────────────────────────

export async function fetchAssets(type: 'video' | 'audio'): Promise<AssetItem[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch ${type} assets: ${error.message}`);
  return (data || []) as AssetItem[];
}

export async function uploadAsset(file: File, type: 'video' | 'audio'): Promise<AssetItem> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const fileExt = file.name.split('.').pop() ?? 'bin';
  const fileName = `${type}s/${userId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(fileName, file, { upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: publicUrlData } = supabase.storage
    .from('assets')
    .getPublicUrl(fileName);

  const { data, error: insertError } = await supabase
    .from('assets')
    .insert({
      name: file.name,
      type,
      url: publicUrlData.publicUrl,
      size: file.size,
      storage_path: fileName,
      metadata: { mime_type: file.type },
    })
    .select('*')
    .single();

  if (insertError) throw new Error(`Database insert failed: ${insertError.message}`);
  return data as AssetItem;
}

export async function deleteAsset(id: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    await supabase.storage.from('assets').remove([storagePath]);
  }
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
