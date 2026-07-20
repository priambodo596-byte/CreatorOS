'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  RefreshCw,
  Eye,
  Copy,
  Heart,
  Download,
  Send,
  Loader2,
  Image as ImageIcon,
  TrendingUp,
  Smartphone,
  Monitor,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  generateThumbnails,
  insertThumbnail,
  fetchThumbnails,
  uploadThumbnailFile,
  type ThumbnailVariation,
  type ThumbnailRow,
} from '@/lib/thumbnail-studio';
import { supabase } from '@/lib/supabase-client';

const CATEGORIES = [
  'General', 'Gaming', 'Education', 'Tech', 'Vlog', 'Finance', 'Podcast', 'Review', 'Music', 'Sports',
];
const EMOTIONS = ['exciting', 'shocking', 'curious', 'happy', 'serious', 'dramatic', 'inspiring'];
const BRAND_STYLES = ['Bold', 'Minimal', 'Cinematic', 'Neon', 'Clean', 'Vibrant', 'Dark'];

export default function ThumbnailStudioPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [audience, setAudience] = useState('');
  const [category, setCategory] = useState('General');
  const [emotion, setEmotion] = useState('exciting');
  const [brandStyle, setBrandStyle] = useState('Bold');

  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<ThumbnailVariation[]>([]);
  const [savedThumbnails, setSavedThumbnails] = useState<ThumbnailRow[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    setSavedError(null);
    try {
      const rows = await fetchThumbnails();
      setSavedThumbnails(rows);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({ title: 'Video title is required', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setVariations([]);
    try {
      const { variations: vars } = await generateThumbnails({
        title,
        script,
        description,
        keywords,
        audience,
        category,
        emotion,
        brandStyle,
      });
      setVariations(vars);
      toast({ title: 'Generated 4 thumbnail concepts', description: 'Review scores and save your favorites.' });
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

  const handleSave = async (variation: ThumbnailVariation) => {
    setSavingId(variation.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Download the image and re-upload to Supabase Storage
      const resp = await fetch(variation.imageUrl);
      const blob = await resp.blob();
      const { url, path } = await uploadThumbnailFile(blob, userId, 'generated');

      await insertThumbnail({
        project_id: null,
        title,
        status: 'generated',
        image_url: url,
        storage_path: path,
        ctr_prediction: variation.ctrPrediction,
        visual_score: variation.visualScore,
        seo_score: variation.seoScore,
        readability_score: variation.readabilityScore,
        emotion_score: variation.emotionScore,
        mobile_visibility: variation.mobileVisibility,
        desktop_visibility: variation.desktopVisibility,
        is_favorite: false,
        metadata: { concept: variation.concept, category, emotion, brandStyle, audience, keywords },
      });

      toast({ title: 'Thumbnail saved', description: 'Find it in your saved thumbnails below.' });
      await loadSaved();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Thumbnail Generator"
        description="Generate AI-powered thumbnail concepts with CTR predictions and visual scoring."
      />

      {/* Generation Form */}
      <Card className="glass p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Video Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. I Built an AI App in 24 Hours"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Script (optional)</Label>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your video script for context..."
                rows={3}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Video description..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Keywords</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="AI, coding, build, tech..."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Target Audience</Label>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Tech enthusiasts, developers..."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1.5 block">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Emotion</Label>
                <Select value={emotion} onValueChange={setEmotion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Brand Style</Label>
                <Select value={brandStyle} onValueChange={setBrandStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRAND_STYLES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={generating || !title.trim()}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" /> Generate 4 Variations</>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Variations */}
      <AnimatePresence mode="wait">
        {generating ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="glass overflow-hidden">
                  <div className="aspect-video w-full animate-pulse bg-muted/40" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted/30" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted/30" />
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : variations.length > 0 ? (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="mb-4 font-display text-lg font-semibold">Generated Concepts</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {variations.map((variation, i) => (
                <motion.div
                  key={variation.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="glass glass-hover overflow-hidden">
                    <div className="relative aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={variation.imageUrl} alt={variation.concept} className="h-full w-full object-cover" />
                      <div className="absolute right-2 top-2 rounded-lg glass-strong px-2.5 py-1">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-bold text-primary">{variation.ctrPrediction}%</span>
                          <span className="text-xs text-muted-foreground">CTR</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="mb-3 text-sm text-muted-foreground">{variation.concept}</p>

                      {/* Score Grid */}
                      <div className="mb-4 grid grid-cols-2 gap-3">
                        <ScoreBar label="Visual" value={variation.visualScore} icon={<Eye className="h-3 w-3" />} />
                        <ScoreBar label="SEO" value={variation.seoScore} icon={<TrendingUp className="h-3 w-3" />} />
                        <ScoreBar label="Readability" value={variation.readabilityScore} icon={<CheckCircle2 className="h-3 w-3" />} />
                        <ScoreBar label="Emotion" value={variation.emotionScore} icon={<Heart className="h-3 w-3" />} />
                        <ScoreBar label="Mobile" value={variation.mobileVisibility} icon={<Smartphone className="h-3 w-3" />} />
                        <ScoreBar label="Desktop" value={variation.desktopVisibility} icon={<Monitor className="h-3 w-3" />} />
                      </div>

                      {/* Suggestions */}
                      {variation.suggestions.length > 0 && (
                        <div className="mb-4 rounded-lg bg-muted/30 p-3">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                            <Lightbulb className="h-3.5 w-3.5 text-warning" />
                            AI Suggestions
                          </div>
                          <ul className="space-y-1">
                            {variation.suggestions.map((s, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(variation)}
                          disabled={savingId === variation.id}
                          className="flex-1"
                        >
                          {savingId === variation.id ? (
                            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</>
                          ) : (
                            <><Heart className="mr-1.5 h-3.5 w-3.5" /> Save</>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={variation.imageUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={variation.imageUrl} download={`thumbnail-${i + 1}.png`}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(variation.concept);
                            toast({ title: 'Concept copied' });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Saved Thumbnails */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Saved Thumbnails</h2>
        {loadingSaved ? (
          <LoadingState message="Loading saved thumbnails..." />
        ) : savedError ? (
          <ErrorState message={savedError} onRetry={loadSaved} />
        ) : savedThumbnails.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No saved thumbnails yet"
            description="Generate concepts above and save your favorites to see them here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedThumbnails.map((thumb) => (
              <Card key={thumb.id} className="glass glass-hover overflow-hidden">
                <div className="relative aspect-video">
                  {thumb.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={thumb.image_url} alt={thumb.title} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute right-2 top-2 rounded-lg glass-strong px-2 py-1">
                    <span className="text-xs font-bold text-primary">{Number(thumb.ctr_prediction).toFixed(1)}% CTR</span>
                  </div>
                  {thumb.is_favorite && (
                    <div className="absolute left-2 top-2">
                      <Heart className="h-4 w-4 fill-destructive text-destructive" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{thumb.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{thumb.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(thumb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const color = value >= 75 ? 'text-success' : value >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">{icon} {label}</span>
        <span className={`font-semibold ${color}`}>{Math.round(value)}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
