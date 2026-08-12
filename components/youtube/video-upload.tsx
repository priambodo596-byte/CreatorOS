'use client';

import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Video,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  FileVideo,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVideoUpload, UploadedVideo } from '@/hooks/use-video-upload';

interface VideoUploadProps {
  onUploaded: (video: UploadedVideo) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function VideoUpload({ onUploaded, disabled }: VideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { status, progress, currentFile, upload, cancel, retry } = useVideoUpload({
    onSuccess: onUploaded,
  });

  const handleFileSelect = useCallback((file: File) => {
    if (disabled) return;
    upload(file);
  }, [upload, disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  }, [handleFileSelect]);

  const isUploading = status === 'uploading';
  const isReady = status === 'ready';
  const isFailed = status === 'failed';

  return (
    <Card className="glass p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4"
        className="hidden"
        onChange={handleInputChange}
      />

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-display text-lg font-semibold">
                Drag and drop your video
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Or click to browse · MP4 only · up to 2 GB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.preventDefault();
                  handleBrowse();
                }}
                disabled={disabled}
              >
                <FileVideo className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
            </label>
          </motion.div>
        )}

        {isUploading && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{currentFile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentFile ? formatBytes(currentFile.size) : ''} · Uploading to Storage
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancel}
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Upload progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex items-center gap-2 rounded-lg glass p-3">
              <Video className="h-8 w-8 flex-shrink-0 text-muted-foreground/40" />
              <div className="flex-1 text-xs text-muted-foreground">
                <p>Thumbnail placeholder</p>
                <p className="mt-0.5 text-[10px]">Generating preview after upload completes…</p>
              </div>
            </div>
          </motion.div>
        )}

        {isReady && (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{currentFile?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentFile ? formatBytes(currentFile.size) : ''} · Uploaded successfully
                </p>
              </div>
              <Badge variant="secondary" className="bg-success/15 text-success">
                Ready
              </Badge>
            </div>

            <div className="flex items-center gap-2 rounded-lg glass p-3">
              <Video className="h-10 w-10 flex-shrink-0 text-muted-foreground/40" />
              <div className="flex-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Video stored in Supabase Storage</p>
                <p className="mt-0.5">Ready to be used in the publishing flow.</p>
              </div>
            </div>
          </motion.div>
        )}

        {isFailed && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{currentFile?.name || 'Upload failed'}</p>
                <p className="text-xs text-destructive">Upload failed. You can retry.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retry()}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Retry
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={handleBrowse}
            >
              Choose a different file
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
