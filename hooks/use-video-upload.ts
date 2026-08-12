'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase-client';
import { useToast } from '@/hooks/use-toast';

export type UploadStatus = 'idle' | 'uploading' | 'ready' | 'failed';

export interface UploadedVideo {
  id: string;
  storagePath: string;
  publicUrl: string;
  filename: string;
  filesize: number;
  mimeType: string;
  status: UploadStatus;
  errorMessage?: string;
}

interface UseVideoUploadOptions {
  onSuccess?: (video: UploadedVideo) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED_MIME = ['video/mp4'];

export function useVideoUpload(options?: UseVideoUploadOptions) {
  const { toast } = useToast();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);

  const upload = useCallback(async (file: File): Promise<UploadedVideo | null> => {
    if (isUploadingRef.current) {
      console.warn('[VIDEO UPLOAD] Upload already in progress, ignoring duplicate call');
      return null;
    }

    // Validate mime type
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Only MP4 video files are allowed.',
        variant: 'destructive',
      });
      return null;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 2 GB.',
        variant: 'destructive',
      });
      return null;
    }

    isUploadingRef.current = true;
    abortControllerRef.current = new AbortController();
    setCurrentFile(file);
    setStatus('uploading');
    setProgress(0);
    console.log('[VIDEO UPLOAD] Upload started:', file.name, file.size);

    try {
      // Get authenticated user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        throw new Error('Authentication required. Please sign in.');
      }
      const userId = userData.user.id;

      // Generate storage path: <user-id>/<uuid>.mp4
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileId = crypto.randomUUID();
      const storagePath = `${userId}/${fileId}.${fileExt}`;

      // Upload to Supabase Storage with progress tracking via XHR
      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${storagePath}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
            console.log('[VIDEO UPLOAD] Upload progress:', pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let errMsg = `Upload failed (${xhr.status})`;
            try {
              const errBody = JSON.parse(xhr.responseText);
              errMsg = errBody.message || errBody.error || errMsg;
            } catch { /* ignore parse error */ }
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        abortControllerRef.current!.signal.addEventListener('abort', () => xhr.abort());
        xhr.send(file);
      });

      console.log('[VIDEO UPLOAD] Storage upload complete, notifying edge function');

      // Notify edge function to validate and insert metadata
      const response = await fetch(`${supabaseUrl}/functions/v1/video-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          filename: file.name,
          filesize: file.size,
          mimeType: file.type,
          storagePath,
        }),
        signal: abortControllerRef.current!.signal,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Upload failed (${response.status})`);
      }

      const video: UploadedVideo = {
        id: result.videoId,
        storagePath: result.storagePath,
        publicUrl: result.publicUrl,
        filename: file.name,
        filesize: file.size,
        mimeType: file.type,
        status: 'ready',
      };

      setUploadedVideo(video);
      setStatus('ready');
      setProgress(100);
      console.log('[VIDEO UPLOAD] Upload success:', video);
      options?.onSuccess?.(video);
      toast({ title: 'Upload complete', description: `${file.name} is ready to publish.` });

      return video;
    } catch (err) {
      if (err instanceof Error && err.message === 'Upload cancelled') {
        setStatus('idle');
        setProgress(0);
        console.log('[VIDEO UPLOAD] Upload cancelled by user');
        toast({ title: 'Upload cancelled' });
        return null;
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[VIDEO UPLOAD] Upload failed:', message);
      setStatus('failed');
      setUploadedVideo(null);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
      return null;
    } finally {
      isUploadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [toast, options]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const retry = useCallback(async (file?: File): Promise<UploadedVideo | null> => {
    const fileToRetry = file || currentFile;
    if (!fileToRetry) {
      toast({ title: 'No file to retry', variant: 'destructive' });
      return null;
    }
    return upload(fileToRetry);
  }, [upload, currentFile, toast]);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setUploadedVideo(null);
    setCurrentFile(null);
  }, []);

  return {
    status,
    progress,
    uploadedVideo,
    currentFile,
    upload,
    cancel,
    retry,
    reset,
  };
}
