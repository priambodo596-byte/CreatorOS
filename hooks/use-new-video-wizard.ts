'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/lib/supabase-client';
import {
  createContent, updateContent,
  type ContentStatus, type ContentVisibility,
} from '@/lib/content';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WizardStep =
  | 'project'
  | 'research'
  | 'script'
  | 'storyboard'
  | 'video'
  | 'thumbnail'
  | 'seo'
  | 'review'
  | 'publish';

export const WIZARD_STEPS: WizardStep[] = [
  'project',
  'research',
  'script',
  'storyboard',
  'video',
  'thumbnail',
  'seo',
  'review',
  'publish',
];

export const STEP_LABELS: Record<WizardStep, string> = {
  project: 'Project',
  research: 'Research',
  script: 'Script',
  storyboard: 'Storyboard',
  video: 'Video',
  thumbnail: 'Thumbnail',
  seo: 'SEO',
  review: 'Review',
  publish: 'Publish',
};

// ─── Wizard State ────────────────────────────────────────────────────────────

export interface ProjectData {
  name: string;
  channel_name: string;
  content_type: string;
  language: string;
  category_id: string;
  target_audience: string;
  status: ContentStatus;
}

export interface ResearchData {
  selected_topics: string[];
  selected_keywords: string[];
  competitor_insights: string;
  viral_score_notes: string;
}

export interface ScriptData {
  script_content: string;
  hook: string;
  cta: string;
  rewrite_history: string[];
}

export interface StoryboardScene {
  sceneNumber: number;
  description: string;
  visualSuggestion: string;
  dialogue: string;
  duration: string;
}

export interface StoryboardData {
  scenes: StoryboardScene[];
}

export interface VideoData {
  video_url: string | null;
  video_storage_path: string | null;
  video_duration: string;
  has_subtitles: boolean;
  subtitle_url: string | null;
  has_voiceover: boolean;
  voiceover_url: string | null;
  music_url: string | null;
  broll_urls: string[];
  render_status: 'pending' | 'rendering' | 'completed' | 'failed';
}

export interface ThumbnailData {
  thumbnail_url: string | null;
  thumbnail_storage_path: string | null;
  alt_thumbnails: Array<{ url: string; score: number }>;
  thumbnail_score: number;
}

export interface SeoData {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: string;
  seo_score: number;
  keyword_optimizations: string;
}

export interface ReviewData {
  video_preview_url: string | null;
  thumbnail_preview_url: string | null;
  checklist: {
    video: boolean;
    thumbnail: boolean;
    seo: boolean;
    subtitle: boolean;
    voiceover: boolean;
  };
}

export interface PublishData {
  upload_video_url: string | null;
  upload_thumbnail_url: string | null;
  scheduled_at: string;
  visibility: ContentVisibility;
  playlist_id: string;
  category_id: string;
  language: string;
  audience: string;
  license: string;
  published: boolean;
  youtube_video_id: string | null;
}

export interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  contentId: string | null;
  saving: boolean;
  lastSaved: string | null;
  project: ProjectData;
  research: ResearchData;
  script: ScriptData;
  storyboard: StoryboardData;
  video: VideoData;
  thumbnail: ThumbnailData;
  seo: SeoData;
  review: ReviewData;
  publish: PublishData;
}

const DEFAULT_PROJECT: ProjectData = {
  name: '',
  channel_name: '',
  content_type: 'video',
  language: 'en',
  category_id: '',
  target_audience: '',
  status: 'draft',
};

const DEFAULT_RESEARCH: ResearchData = {
  selected_topics: [],
  selected_keywords: [],
  competitor_insights: '',
  viral_score_notes: '',
};

const DEFAULT_SCRIPT: ScriptData = {
  script_content: '',
  hook: '',
  cta: '',
  rewrite_history: [],
};

const DEFAULT_STORYBOARD: StoryboardData = { scenes: [] };

const DEFAULT_VIDEO: VideoData = {
  video_url: null,
  video_storage_path: null,
  video_duration: '',
  has_subtitles: false,
  subtitle_url: null,
  has_voiceover: false,
  voiceover_url: null,
  music_url: null,
  broll_urls: [],
  render_status: 'pending',
};

const DEFAULT_THUMBNAIL: ThumbnailData = {
  thumbnail_url: null,
  thumbnail_storage_path: null,
  alt_thumbnails: [],
  thumbnail_score: 0,
};

const DEFAULT_SEO: SeoData = {
  title: '', description: '', tags: [], hashtags: [],
  chapters: '', seo_score: 0, keyword_optimizations: '',
};

const DEFAULT_REVIEW: ReviewData = {
  video_preview_url: null,
  thumbnail_preview_url: null,
  checklist: { video: false, thumbnail: false, seo: false, subtitle: false, voiceover: false },
};

const DEFAULT_PUBLISH: PublishData = {
  upload_video_url: null, upload_thumbnail_url: null, scheduled_at: '',
  visibility: 'private', playlist_id: '', category_id: '',
  language: 'en', audience: '', license: 'youtube',
  published: false, youtube_video_id: null,
};

const INITIAL_STATE: WizardState = {
  currentStep: 0,
  completedSteps: new Set(),
  contentId: null,
  saving: false,
  lastSaved: null,
  project: { ...DEFAULT_PROJECT },
  research: { ...DEFAULT_RESEARCH },
  script: { ...DEFAULT_SCRIPT },
  storyboard: { ...DEFAULT_STORYBOARD },
  video: { ...DEFAULT_VIDEO },
  thumbnail: { ...DEFAULT_THUMBNAIL },
  seo: { ...DEFAULT_SEO },
  review: { ...DEFAULT_REVIEW },
  publish: { ...DEFAULT_PUBLISH },
};

const STORAGE_KEY = 'new-video-wizard-draft';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNewVideoWizard(initialOpen = true, onClose?: () => void) {
  const { toast } = useToast();
  const [state, setState] = useState<WizardState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_STATE,
          ...parsed,
          completedSteps: new Set(parsed.completedSteps || []),
        };
      }
    } catch { /* ignore */ }
    return INITIAL_STATE;
  });
  const [open, setOpen] = useState(initialOpen);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback((updater: (prev: WizardState) => WizardState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...next,
          completedSteps: Array.from(next.completedSteps),
        }));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const getCurrentStep = useCallback((): WizardStep => {
    return WIZARD_STEPS[stateRef.current.currentStep] || 'project';
  }, []);

  // ─── DB Save ──────────────────────────────────────────────────────────────

  const saveToDatabase = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.project.name.trim()) return false;

    setState((prev) => ({ ...prev, saving: true }));

    try {
      const payload: Record<string, unknown> = {
        title: s.project.name.trim(),
        content_type: s.project.content_type,
        status: s.project.status,
        channel_name: s.project.channel_name || null,
        category_id: s.project.category_id || null,
        description: s.seo.description || null,
        tags: s.seo.tags.length > 0 ? s.seo.tags : undefined,
        thumbnail_url: s.thumbnail.thumbnail_url || null,
        video_url: s.video.video_url || null,
        seo_score: s.seo.seo_score || null,
        thumbnail_score: s.thumbnail.thumbnail_score || null,
        scheduled_at: s.publish.scheduled_at || null,
        visibility: s.publish.visibility,
        metadata: {
          wizard_step: s.currentStep,
          wizard_completed_steps: Array.from(s.completedSteps),
          language: s.project.language,
          target_audience: s.project.target_audience,
          research: s.research,
          script: s.script,
          storyboard: s.storyboard,
          video_render_status: s.video.render_status,
          video_duration: s.video.video_duration,
          has_subtitles: s.video.has_subtitles,
          has_voiceover: s.video.has_voiceover,
          publish_license: s.publish.license,
          review_checklist: s.review.checklist,
        },
      };

      if (s.contentId) {
        await updateContent(s.contentId, payload);
      } else {
        const created = await createContent(payload);
        setState((prev) => ({ ...prev, contentId: created.id }));
      }

      const now = new Date().toISOString();
      setState((prev) => ({ ...prev, saving: false, lastSaved: now }));
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, saving: false }));
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save progress',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // ─── Step Navigation ──────────────────────────────────────────────────────

  const goToStep = useCallback((stepIndex: number) => {
    setState((prev) => {
      if (stepIndex > prev.currentStep && !prev.completedSteps.has(stepIndex)) {
        return prev;
      }
      return { ...prev, currentStep: Math.max(0, Math.min(stepIndex, WIZARD_STEPS.length - 1)) };
    });
  }, []);

  const nextStep = useCallback(async () => {
    setState((prev) => {
      const newCompleted = new Set(prev.completedSteps);
      newCompleted.add(prev.currentStep);
      return {
        ...prev,
        completedSteps: newCompleted,
        currentStep: Math.min(prev.currentStep + 1, WIZARD_STEPS.length - 1),
      };
    });
    await saveToDatabase();
  }, [saveToDatabase]);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  // ─── Open / Close ─────────────────────────────────────────────────────────

  const openWizard = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState({
          ...INITIAL_STATE,
          ...parsed,
          completedSteps: new Set(parsed.completedSteps || []),
        });
      } else {
        setState(INITIAL_STATE);
      }
    } catch {
      setState(INITIAL_STATE);
    }
    setOpen(true);
  }, []);

  const closeWizard = useCallback(async () => {
    await saveToDatabase();
    setOpen(false);
    onClose?.();
  }, [saveToDatabase, onClose]);

  const discardWizard = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setState(INITIAL_STATE);
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // ─── Auto-Save ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    autoSaveTimerRef.current = setInterval(() => { saveToDatabase(); }, 30_000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [open, saveToDatabase]);

  // ─── Sub-state setters ────────────────────────────────────────────────────

  const setProject = useCallback((data: Partial<ProjectData>) => {
    updateState((prev) => ({ ...prev, project: { ...prev.project, ...data } }));
  }, [updateState]);

  const setResearch = useCallback((data: Partial<ResearchData>) => {
    updateState((prev) => ({ ...prev, research: { ...prev.research, ...data } }));
  }, [updateState]);

  const setScript = useCallback((data: Partial<ScriptData>) => {
    updateState((prev) => ({ ...prev, script: { ...prev.script, ...data } }));
  }, [updateState]);

  const setStoryboard = useCallback((data: Partial<StoryboardData>) => {
    updateState((prev) => ({ ...prev, storyboard: { ...prev.storyboard, ...data } }));
  }, [updateState]);

  const setVideo = useCallback((data: Partial<VideoData>) => {
    updateState((prev) => ({ ...prev, video: { ...prev.video, ...data } }));
  }, [updateState]);

  const setThumbnail = useCallback((data: Partial<ThumbnailData>) => {
    updateState((prev) => ({ ...prev, thumbnail: { ...prev.thumbnail, ...data } }));
  }, [updateState]);

  const setSeo = useCallback((data: Partial<SeoData>) => {
    updateState((prev) => ({ ...prev, seo: { ...prev.seo, ...data } }));
  }, [updateState]);

  const setReview = useCallback((data: Partial<ReviewData>) => {
    updateState((prev) => ({ ...prev, review: { ...prev.review, ...data } }));
  }, [updateState]);

  const setPublish = useCallback((data: Partial<PublishData>) => {
    updateState((prev) => ({ ...prev, publish: { ...prev.publish, ...data } }));
  }, [updateState]);

  // ─── Upload helper ────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, subdir: string): Promise<{ url: string; path: string } | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${userId}/wizard/${subdir}/${Date.now()}-${file.name}`;
      const bucket = 'creatoros-assets';

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: urlData.publicUrl, path };
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Could not upload file',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  return {
    state, open,
    currentStepLabel: STEP_LABELS[getCurrentStep()],
    currentStepIndex: state.currentStep,
    openWizard, closeWizard, discardWizard,
    goToStep, nextStep, prevStep,
    setProject, setResearch, setScript, setStoryboard,
    setVideo, setThumbnail, setSeo, setReview, setPublish,
    saveToDatabase, uploadFile,
    isStepComplete: (index: number) => state.completedSteps.has(index),
    isStepCurrent: (index: number) => state.currentStep === index,
    totalSteps: WIZARD_STEPS.length,
  };
}
