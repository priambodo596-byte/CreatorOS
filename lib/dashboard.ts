import { supabase } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceSummary {
  totalProjects: number;
  activeProjects: number;
  totalContent: number;
  draftContent: number;
  scheduledContent: number;
  publishedContent: number;
  openTasks: number;
}

export interface AiUsageSummary {
  scriptGenerations: number;
  thumbnailGenerations: number;
  seoOptimizations: number;
  totalApiCalls: number;
}

export interface StorageBreakdown {
  totalBytes: number;
  video: number;
  image: number;
  audio: number;
  other: number;
}

export interface RecentActivityRow {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  content_title?: string;
}

export interface UpcomingItem {
  id: string;
  title: string;
  type: string;
  scheduled_date: string | null;
}

// ─── Workspace Summary ─────────────────────────────────────────────────────────

export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const [projects, activeProjects, content, draft, scheduled, published, tasks] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'draft'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'scheduled'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'published'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
  ]);

  return {
    totalProjects: projects.count || 0,
    activeProjects: activeProjects.count || 0,
    totalContent: content.count || 0,
    draftContent: draft.count || 0,
    scheduledContent: scheduled.count || 0,
    publishedContent: published.count || 0,
    openTasks: tasks.count || 0,
  };
}

// ─── AI Usage ──────────────────────────────────────────────────────────────────

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const [scripts, thumbnails, seo, messages] = await Promise.all([
    supabase.from('ai_documents').select('id', { count: 'exact', head: true }).eq('type', 'script'),
    supabase.from('ai_documents').select('id', { count: 'exact', head: true }).eq('type', 'thumbnail'),
    supabase.from('ai_documents').select('id', { count: 'exact', head: true }).eq('type', 'seo'),
    supabase.from('ai_messages').select('id', { count: 'exact', head: true }),
  ]);

  return {
    scriptGenerations: scripts.count || 0,
    thumbnailGenerations: thumbnails.count || 0,
    seoOptimizations: seo.count || 0,
    totalApiCalls: messages.count || 0,
  };
}

// ─── Storage ────────────────────────────────────────────────────────────────

export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const { data, error } = await supabase.from('assets').select('type, size_bytes');
  if (error) throw error;

  const out: StorageBreakdown = { totalBytes: 0, video: 0, image: 0, audio: 0, other: 0 };
  (data || []).forEach((row: { type: string; size_bytes: number }) => {
    const size = row.size_bytes || 0;
    out.totalBytes += size;
    if (row.type?.startsWith('video')) out.video += size;
    else if (row.type?.startsWith('image')) out.image += size;
    else if (row.type?.startsWith('audio')) out.audio += size;
    else out.other += size;
  });
  return out;
}

// ─── Recent Activity ────────────────────────────────────────────────────────

export async function getRecentActivities(limit = 6): Promise<RecentActivityRow[]> {
  const { data, error } = await supabase
    .from('content_activities')
    .select('id, action, detail, created_at, content_items(title)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    action: row.action,
    detail: row.detail,
    created_at: row.created_at,
    content_title: row.content_items?.title,
  }));
}

// ─── Upcoming (from calendar_events) ─────────────────────────────────────────

export async function getUpcomingItems(limit = 5): Promise<UpcomingItem[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, type, scheduled_date')
    .gte('scheduled_date', new Date().toISOString())
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as UpcomingItem[];
}
