'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutTemplate,
  Plus,
  Trash2,
  Copy,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  Download,
} from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState, SearchInput } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { fetchTemplates, insertTemplate, deleteTemplate, type TemplateRow } from '@/lib/thumbnail-studio';
import { insertActivityLog } from '@/lib/automation';
import { supabase } from '@/lib/supabase-client';

const NICHES = ['Gaming', 'Education', 'Podcast', 'Review', 'Vlog', 'Finance', 'Music', 'Tech', 'Sports', 'News'];
const STYLES = ['Bold', 'Minimal', 'Cinematic', 'Neon', 'Clean', 'Vibrant', 'Dark'];
const TEMPLATE_PREVIEWS = [
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/4974915/pexels-photo-4974915.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/5717417/pexels-photo-5717417.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184464/pexels-photo-3184464.jpeg?auto=compress&cs=tinysrgb&w=800',
];

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<TemplateRow | null>(null);

  const [newName, setNewName] = useState('');
  const [newNiche, setNewNiche] = useState('Gaming');
  const [newStyle, setNewStyle] = useState('Bold');
  const [newLayers, setNewLayers] = useState('{}');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchTemplates(nicheFilter === 'All' ? undefined : nicheFilter);
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [nicheFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      let layersObj = {};
      try { layersObj = JSON.parse(newLayers); } catch { /* default */ }

      await insertTemplate({
        user_id: userId,
        name: newName,
        niche: newNiche,
        preview_url: TEMPLATE_PREVIEWS[Math.floor(Math.random() * TEMPLATE_PREVIEWS.length)],
        layers: layersObj,
        brand_style: newStyle,
        is_public: false,
      });
      await insertActivityLog({
        module: 'assets',
        action: 'template_created',
        entity_type: 'template',
        details: { name: newName, niche: newNiche },
        level: 'success',
      });
      toast({ title: 'Template created' });
      setNewName('');
      setNewLayers('{}');
      setShowCreate(false);
      await load();
    } catch (err) {
      toast({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      await insertActivityLog({
        module: 'assets',
        action: 'template_deleted',
        entity_type: 'template',
        entity_id: id,
        level: 'warning',
      });
      toast({ title: 'Template deleted' });
      await load();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.niche.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Templates"
        description="Reusable workflow, prompt, thumbnail, and script templates."
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-primary to-accent text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Template
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={nicheFilter} onValueChange={setNicheFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Niches</SelectItem>
            {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search templates..." />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading templates..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates found"
          description="Create a template to reuse across workflows, prompts, and thumbnails."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass glass-hover overflow-hidden">
                <div className="relative aspect-video">
                  {template.preview_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={template.preview_url} alt={template.name} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="truncate text-sm font-semibold text-white">{template.name}</p>
                  </div>
                </div>
                <div className="p-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">{template.niche}</Badge>
                    {template.brand_style && <Badge variant="outline" className="text-xs">{template.brand_style}</Badge>}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setPreview(template)} className="flex-1">
                      <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Workflow Template" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">Niche</Label>
                <Select value={newNiche} onValueChange={setNewNiche}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Style</Label>
                <Select value={newStyle} onValueChange={setNewStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Layer JSON (optional)</Label>
              <Textarea value={newLayers} onChange={(e) => setNewLayers(e.target.value)} rows={3} placeholder="{}" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.preview_url && (
            <div className="aspect-video overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.preview_url} alt={preview.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex gap-2">
            <Badge variant="secondary">{preview?.niche}</Badge>
            {preview?.brand_style && <Badge variant="outline">{preview.brand_style}</Badge>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
