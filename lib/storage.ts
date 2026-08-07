'use client';

import { supabase } from './supabase-client';

export const VIDEO_BUCKET = 'clips';

export interface UploadResult {
  path: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

export async function uploadVideo(
  userId: string,
  file: File | Blob,
  fileName: string,
): Promise<UploadResult> {
  const path = `${userId}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(path, file, { contentType: file.type || 'video/mp4' });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    size: file.size,
    mimeType: file.type || 'video/mp4',
  };
}

export async function deleteVideo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message || 'no data'}`);
  }
  return data.signedUrl;
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
