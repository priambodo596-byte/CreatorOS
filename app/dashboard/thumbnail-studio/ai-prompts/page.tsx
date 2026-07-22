'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  Heart,
  Trash2,
  Loader2,
  MessageSquare,
  Copy,
  RefreshCw,
  Download,
} from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState, SearchInput } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAIPrompts,
  insertAIPrompt,
  updateAIPrompt,
  deleteAIPrompt,
  uploadThumbnailFile,
  type AIPromptRow,
} from '@/lib/thumbnail-studio';
import { supabase } from '@/lib/supabase-client';

const MODELS = [
  { id: 'gpt-image', name: 'GPT Image' },
  { id: 'gemini-image', name: 'Gemini Image' },
  { id: 'stable-diffusion', name: 'Stable Diffusion' },
  { id: 'flux', name: 'Flux' },
  { id: 'midjourney', name: 'Midjourney' },
];

const STYLES = ['Photorealistic', 'Anime', '3D Render', 'Digital Art', 'Oil Painting', 'Comic', 'Cinematic', 'Minimalist'];
const PEXELS_PLACEHOLDER = 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800';

export default function AIPromptStudioPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-image');
  const [style, setStyle] = useState('Photorealistic');
  const [generating, setGenerating] = useState(false);
  const [prompts, setPrompts] = useState<AIPromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAIPrompts();
      setPrompts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Prompt is required', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Simulate generation: fetch a placeholder image and store it
      const resp = await fetch(PEXELS_PLACEHOLDER);
      const blob = await resp.blob();
      const { url, path } = await uploadThumbnailFile(blob, userId, 'generated');

      await insertAIPrompt({
        prompt,
        model,
        style,
        result_url: url,
        storage_path: path,
        is_favorite: false,
        metadata: { generatedAt: new Date().toISOString() },
      });

      toast({ title: 'Image generated and saved', description: `Model: ${model}, Style: ${style}` });
      setPrompt('');
      await load();
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async (row: AIPromptRow) => {
    try {
      await updateAIPrompt(row.id, { is_favorite: !row.is_favorite });
      await load();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (row: AIPromptRow) => {
    try {
      await deleteAIPrompt(row.id, row.storage_path ?? undefined);
      toast({ title: 'Prompt deleted' });
      await load();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const filtered = prompts.filter(
    (p) =>
      p.prompt.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="AI Prompt Studio"
        description="Store and manage prompts for AI thumbnail generation across multiple models."
      />

      {/* Prompt Composer */}
      <Card className="glass p-5 md:p-6">
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A bold YouTube thumbnail with a shocked face, neon background, large yellow text saying 'INSANE', high contrast..."
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full bg-gradient-to-r from-primary to-accent text-white"
              >
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="mr-2 h-4 w-4" /> Generate</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Prompt History</h2>
          <div className="w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Search prompts..." />
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading prompts..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No prompts yet"
            description="Write a prompt above and generate your first AI thumbnail."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row, i) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass glass-hover overflow-hidden">
                  {row.result_url && (
                    <div className="relative aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.result_url} alt={row.prompt} className="h-full w-full object-cover" />
                      {row.is_favorite && (
                        <div className="absolute right-2 top-2">
                          <Heart className="h-4 w-4 fill-destructive text-destructive" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4">
                    <p className="mb-2 line-clamp-3 text-sm text-muted-foreground">{row.prompt}</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">{row.model}</Badge>
                      {row.style && <Badge variant="outline" className="text-xs">{row.style}</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleFavorite(row)}
                        className="flex-1"
                      >
                        <Heart className={`h-3.5 w-3.5 ${row.is_favorite ? 'fill-destructive text-destructive' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(row.prompt);
                          toast({ title: 'Prompt copied' });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPrompt(row.prompt);
                          setModel(row.model);
                          if (row.style) setStyle(row.style);
                          toast({ title: 'Loaded for regeneration' });
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      {row.result_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={row.result_url} download={`prompt-${row.id}.png`}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
