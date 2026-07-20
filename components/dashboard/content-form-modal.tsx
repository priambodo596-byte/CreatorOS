'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  createContent, updateContent, type ContentItem, type ContentInput,
  type ContentCategory, type ContentPlaylist,
} from '@/lib/content';

interface ContentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: ContentItem | null;
  categories: ContentCategory[];
  playlists: ContentPlaylist[];
  onSaved: () => void;
}

export function ContentFormModal({ open, onOpenChange, content, categories, playlists, onSaved }: ContentFormModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContentInput>({});

  useEffect(() => {
    if (open) {
      setForm(
        content
          ? { ...content }
          : { title: '', description: '', content_type: 'video', status: 'draft', visibility: 'private', tags: [] },
      );
    }
  }, [open, content]);

  const set = (patch: Partial<ContentInput>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async () => {
    if (!form.title?.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (content) {
        await updateContent(content.id, form);
        toast({ title: 'Content updated' });
      } else {
        await createContent(form);
        toast({ title: 'Content created' });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to save content', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content ? 'Edit Content' : 'Create Content'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={form.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Content title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="Short description" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.content_type || 'video'} onValueChange={(v) => set({ content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || 'draft'} onValueChange={(v) => set({ status: v as ContentInput['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id || 'none'} onValueChange={(v) => set({ category_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Playlist</Label>
              <Select value={form.playlist_id || 'none'} onValueChange={(v) => set({ playlist_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={form.visibility || 'private'} onValueChange={(v) => set({ visibility: v as ContentInput['visibility'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input
              value={(form.tags || []).join(', ')}
              onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="ai, tutorial, shorts"
            />
          </div>
          <div>
            <Label>Thumbnail URL</Label>
            <Input value={form.thumbnail_url || ''} onChange={(e) => set({ thumbnail_url: e.target.value })} placeholder="https://..." />
          </div>
          {form.status === 'scheduled' && (
            <div>
              <Label>Scheduled At</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
                onChange={(e) => set({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {content ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
