'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Store,
  Heart,
  Copy,
  Trash2,
  Loader2,
  Sparkles,
  Eye,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchTemplates,
  fetchMyTemplates,
  insertTemplate,
  deleteTemplate,
  type TemplateRow,
} from '@/lib/thumbnail-studio';
import { supabase } from '@/lib/supabase-client';

const NICHES = ['All', 'Gaming', 'Education', 'Podcast', 'Review', 'Vlog', 'Finance', 'Music', 'Tech', 'Sports', 'News'];
const TEMPLATE_PREVIEWS = [
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/4974915/pexels-photo-4974915.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/5717417/pexels-photo-5717417.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184464/pexels-photo-3184464.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg?auto=compress&cs=tinysrgb&w=800',
];

export default function TemplateMarketplacePage() {
  const { toast } = useToast();
  const [niche, setNiche] = useState('All');
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [myTemplates, setMyTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'marketplace' | 'mine'>('marketplace');
  const [creating, setCreating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRow | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newNiche, setNewNiche] = useState('Gaming');
  const [newStyle, setNewStyle] = useState('Bold');
  const [newLayers, setNewLayers] = useState('{}');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [market, mine] = await Promise.all([fetchTemplates(niche), fetchMyTemplates()]);
      setTemplates(market);
      setMyTemplates(mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [niche]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveToAccount = async (template: TemplateRow) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      await insertTemplate({
        user_id: userId,
        name: `${template.name} (Copy)`,
        niche: template.niche,
        preview_url: template.preview_url,
        layers: template.layers,
        brand_style: template.brand_style,
        is_public: false,
      });
      toast({ title: 'Template saved to your account', description: 'Modify it in the editor anytime.' });
      await load();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

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
      try {
        layersObj = JSON.parse(newLayers);
      } catch {
        // default empty
      }

      await insertTemplate({
        user_id: userId,
        name: newName,
        niche: newNiche,
        preview_url: TEMPLATE_PREVIEWS[Math.floor(Math.random() * TEMPLATE_PREVIEWS.length)],
        layers: layersObj,
        brand_style: newStyle,
        is_public: false,
      });

      toast({ title: 'Template created', description: 'Find it under "My Templates".' });
      setNewName('');
      setNewLayers('{}');
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

  const displayList = tab === 'marketplace' ? templates : myTemplates;
  const filtered = displayList.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.niche.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Template Marketplace"
        description="Browse templates by niche. Save to your account, modify, and make them your own brand."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent text-white">
                <Sparkles className="mr-2 h-4 w-4" /> Create Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a Brand Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Gaming Template" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Niche</Label>
                    <Select value={newNiche} onValueChange={setNewNiche}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NICHES.filter((n) => n !== 'All').map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Brand Style</Label>
                    <Select value={newStyle} onValueChange={setNewStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Bold', 'Minimal', 'Cinematic', 'Neon', 'Clean', 'Vibrant'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block">Layer JSON (optional)</Label>
                  <Textarea value={newLayers} onChange={(e) => setNewLayers(e.target.value)} rows={4} placeholder="{}" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Template'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Tabs + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={tab === 'marketplace' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('marketplace')}
          >
            Marketplace
          </Button>
          <Button
            variant={tab === 'mine' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('mine')}
          >
            My Templates
          </Button>
        </div>
        <div className="flex flex-1 gap-2 sm:max-w-md">
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search templates..." />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingState message="Loading templates..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={tab === 'marketplace' ? 'No templates found' : 'No saved templates'}
          description={tab === 'marketplace' ? 'Try a different niche or search term.' : 'Save a marketplace template or create your own.'}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTemplate(template)}
                      className="flex-1"
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                    </Button>
                    {tab === 'marketplace' ? (
                      <Button size="sm" onClick={() => handleSaveToAccount(template)} className="flex-1">
                        <Heart className="mr-1 h-3.5 w-3.5" /> Save
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveToAccount(template)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate?.preview_url && (
            <div className="aspect-video overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewTemplate.preview_url} alt={previewTemplate.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex gap-2">
            <Badge variant="secondary">{previewTemplate?.niche}</Badge>
            {previewTemplate?.brand_style && <Badge variant="outline">{previewTemplate.brand_style}</Badge>}
          </div>
          <Button
            onClick={() => {
              if (previewTemplate) handleSaveToAccount(previewTemplate);
              setPreviewTemplate(null);
            }}
            className="w-full"
          >
            <Heart className="mr-2 h-4 w-4" /> Save to My Templates
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
