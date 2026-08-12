import { supabase } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrandKit {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  font_size: string;
  logo_position: string;
  watermark_url: string | null;
  watermark_opacity: number;
  style_preset: string;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type BrandKitInput = Omit<BrandKit, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

// ─── Storage ──────────────────────────────────────────────────────────────────

const BUCKET = 'creatoros-assets';

export async function uploadBrandAsset(
  file: File,
  userId: string,
  subdir: 'logos' | 'watermarks',
): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop() ?? 'png';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/brand/${subdir}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'image/png',
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteBrandAsset(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchBrandKits(): Promise<BrandKit[]> {
  const { data, error } = await supabase
    .from('brand_kits')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch brand kits: ${error.message}`);
  return (data ?? []) as BrandKit[];
}

export async function fetchDefaultBrandKit(): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch default brand kit: ${error.message}`);
  return data as BrandKit | null;
}

export async function insertBrandKit(row: BrandKitInput): Promise<BrandKit> {
  const { data, error } = await supabase
    .from('brand_kits')
    .insert(row)
    .select('*')
    .single();

  if (error) throw new Error(`Insert failed: ${error.message}`);
  return data as BrandKit;
}

export async function updateBrandKit(id: string, updates: Partial<BrandKitInput>): Promise<BrandKit> {
  const { data, error } = await supabase
    .from('brand_kits')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Update failed: ${error.message}`);
  return data as BrandKit;
}

export async function deleteBrandKit(id: string): Promise<void> {
  const { error } = await supabase.from('brand_kits').delete().eq('id', id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export async function setDefaultBrandKit(id: string): Promise<void> {
  // Unset all defaults for this user, then set the chosen one
  const { error: unsetErr } = await supabase
    .from('brand_kits')
    .update({ is_default: false })
    .neq('id', id);

  if (unsetErr) throw new Error(`Failed to unset defaults: ${unsetErr.message}`);

  const { error: setErr } = await supabase
    .from('brand_kits')
    .update({ is_default: true })
    .eq('id', id);

  if (setErr) throw new Error(`Failed to set default: ${setErr.message}`);
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_BRAND_KIT: BrandKitInput = {
  name: 'My Brand Kit',
  logo_url: null,
  primary_color: '#6366f1',
  secondary_color: '#8b5cf6',
  accent_color: '#f59e0b',
  background_color: '#0a0a0a',
  text_color: '#ffffff',
  font_family: 'Inter',
  font_size: 'medium',
  logo_position: 'bottom-right',
  watermark_url: null,
  watermark_opacity: 50,
  style_preset: 'modern',
  is_default: false,
  metadata: {},
};

export const FONT_OPTIONS = [
  'Inter',
  'Poppins',
  'Roboto',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Playfair Display',
  'Oswald',
  'Raleway',
  'Source Sans Pro',
];

export const FONT_SIZE_OPTIONS = ['small', 'medium', 'large'];

export const LOGO_POSITION_OPTIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
];

export const STYLE_PRESET_OPTIONS = [
  'modern',
  'minimal',
  'bold',
  'cinematic',
  'neon',
  'clean',
  'vibrant',
  'dark',
];
