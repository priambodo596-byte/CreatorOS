import { supabase } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type ContentVisibility = 'public' | 'unlisted' | 'private';

export interface ContentItem {
  id: string;
  user_id: string;
  project_id: string | null;
  category_id: string | null;
  playlist_id: string | null;
  title: string;
  description: string | null;
  content_type: string;
  thumbnail_url: string | null;
  video_url: string | null;
  channel_id: string | null;
  channel_name: string | null;
  status: ContentStatus;
  visibility: ContentVisibility;
  tags: string[];
  seo_score: number | null;
  thumbnail_score: number | null;
  author: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContentPlaylist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ContentActivity {
  id: string;
  content_id: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface ContentListFilters {
  search?: string;
  status?: ContentStatus | 'all';
  categoryId?: string | 'all';
  playlistId?: string | 'all';
  channelId?: string | 'all';
  authorId?: string | 'all';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'published_at' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  trashOnly?: boolean;
}

export interface ContentListResult {
  items: ContentItem[];
  total: number;
}

// ─── Activity Logging ─────────────────────────────────────────────────────────

async function logActivity(contentId: string, action: string, detail?: string) {
  await supabase.from('content_activities').insert({
    content_id: contentId,
    action,
    detail: detail ?? null,
  });
}

// ─── List / Read ──────────────────────────────────────────────────────────────

export async function listContent(filters: ContentListFilters = {}): Promise<ContentListResult> {
  const {
    search, status = 'all', categoryId = 'all', playlistId = 'all',
    channelId = 'all', dateFrom, dateTo,
    sortBy = 'created_at', sortDir = 'desc',
    page = 1, pageSize = 20, trashOnly = false,
  } = filters;

  let query = supabase.from('content_items').select('*', { count: 'exact' });

  query = trashOnly ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

  if (status !== 'all') query = query.eq('status', status);
  if (categoryId !== 'all') query = query.eq('category_id', categoryId);
  if (playlistId !== 'all') query = query.eq('playlist_id', playlistId);
  if (channelId !== 'all') query = query.eq('channel_id', channelId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) query = query.ilike('title', `%${search}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data || []) as ContentItem[], total: count || 0 };
}

export async function getContentById(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase.from('content_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ContentItem | null;
}

export async function getContentActivities(contentId: string): Promise<ContentActivity[]> {
  const { data, error } = await supabase
    .from('content_activities')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ContentActivity[];
}

export async function getContentCounts(): Promise<Record<ContentStatus | 'trash', number>> {
  const statuses: ContentStatus[] = ['draft', 'scheduled', 'published', 'archived'];
  const results = await Promise.all(
    statuses.map((s) =>
      supabase.from('content_items').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', s),
    ),
  );
  const trash = await supabase.from('content_items').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null);

  const out: Record<ContentStatus | 'trash', number> = { draft: 0, scheduled: 0, published: 0, archived: 0, trash: 0 };
  statuses.forEach((s, i) => { out[s] = results[i].count || 0; });
  out.trash = trash.count || 0;
  return out;
}

// ─── Create / Update / Delete ─────────────────────────────────────────────────

export type ContentInput = Partial<Omit<ContentItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export async function createContent(input: ContentInput): Promise<ContentItem> {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('content_items')
    .insert({ ...input, author: input.author ?? userRes.user?.email ?? null })
    .select()
    .single();
  if (error) throw error;
  await logActivity(data.id, 'created', `"${data.title}" was created`);
  return data as ContentItem;
}

export async function updateContent(id: string, input: ContentInput): Promise<ContentItem> {
  const { data, error } = await supabase.from('content_items').update(input).eq('id', id).select().single();
  if (error) throw error;
  await logActivity(id, 'updated', 'Content details were updated');
  return data as ContentItem;
}

export async function deleteContent(id: string): Promise<void> {
  // Soft delete -> trash
  const { error } = await supabase
    .from('content_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await logActivity(id, 'trashed', 'Moved to trash');
}

export async function permanentlyDeleteContent(id: string): Promise<void> {
  const { error } = await supabase.from('content_items').delete().eq('id', id);
  if (error) throw error;
}

export async function restoreContent(id: string): Promise<void> {
  const { error } = await supabase.from('content_items').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
  await logActivity(id, 'restored', 'Restored from trash');
}

export async function duplicateContent(id: string): Promise<ContentItem> {
  const original = await getContentById(id);
  if (!original) throw new Error('Content not found');
  const { id: _id, created_at, updated_at, ...rest } = original;
  const { data, error } = await supabase
    .from('content_items')
    .insert({ ...rest, title: `${original.title} (Copy)`, status: 'draft', published_at: null, deleted_at: null })
    .select()
    .single();
  if (error) throw error;
  await logActivity(data.id, 'duplicated', `Duplicated from "${original.title}"`);
  return data as ContentItem;
}

export async function archiveContent(id: string): Promise<void> {
  const { error } = await supabase.from('content_items').update({ status: 'archived' }).eq('id', id);
  if (error) throw error;
  await logActivity(id, 'archived', 'Content was archived');
}

// ─── Bulk Actions ──────────────────────────────────────────────────────────────

export async function bulkDelete(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('content_items')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkRestore(ids: string[]): Promise<void> {
  const { error } = await supabase.from('content_items').update({ deleted_at: null }).in('id', ids);
  if (error) throw error;
}

export async function bulkPermanentDelete(ids: string[]): Promise<void> {
  const { error } = await supabase.from('content_items').delete().in('id', ids);
  if (error) throw error;
}

export async function bulkPublish(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('content_items')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkSchedule(ids: string[], scheduledAt: string): Promise<void> {
  const { error } = await supabase
    .from('content_items')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkArchive(ids: string[]): Promise<void> {
  const { error } = await supabase.from('content_items').update({ status: 'archived' }).in('id', ids);
  if (error) throw error;
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(): Promise<ContentCategory[]> {
  const { data, error } = await supabase.from('content_categories').select('*').order('name');
  if (error) throw error;
  return (data || []) as ContentCategory[];
}

export async function createCategory(name: string, color = '#8b5cf6'): Promise<ContentCategory> {
  const { data, error } = await supabase.from('content_categories').insert({ name, color }).select().single();
  if (error) throw error;
  return data as ContentCategory;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('content_categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export async function listPlaylists(): Promise<ContentPlaylist[]> {
  const { data, error } = await supabase.from('content_playlists').select('*').order('name');
  if (error) throw error;
  return (data || []) as ContentPlaylist[];
}

export async function createPlaylist(name: string, description?: string): Promise<ContentPlaylist> {
  const { data, error } = await supabase.from('content_playlists').insert({ name, description }).select().single();
  if (error) throw error;
  return data as ContentPlaylist;
}

export async function deletePlaylist(id: string): Promise<void> {
  const { error } = await supabase.from('content_playlists').delete().eq('id', id);
  if (error) throw error;
}

// ─── Tags ─────────────────────────────────────────────────

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const { data, error } = await supabase.from('content_items').select('tags').is('deleted_at', null);
  if (error) throw error;

  const counts = new Map<string, number>();
  (data || []).forEach((row: { tags: string[] }) => {
    (row.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
