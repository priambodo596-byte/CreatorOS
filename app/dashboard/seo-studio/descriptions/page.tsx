'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  Save,
  Loader2,
  Hash,
  Link as LinkIcon,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase-client';

const YOUTUBE_CHAR_LIMIT = 5000;

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual & Friendly' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'educational', label: 'Educational' },
  { value: 'entertaining', label: 'Entertaining' },
  { value: 'informative', label: 'Informative' },
  { value: 'inspirational', label: 'Inspirational' },
];

interface DescriptionResult {
  description: string;
  seoScore: number;
  hasTimestamps: boolean;
  hasLinks: boolean;
  hasHashtags: boolean;
  characterCount: number;
  wordCount: number;
  suggestions: string[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-yellow-500';
  return 'text-destructive';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}

export default function DescriptionGeneratorPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DescriptionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const charCount = editedDescription.length;
  const charPercentage = Math.min((charCount / YOUTUBE_CHAR_LIMIT) * 100, 100);
  const isOverLimit = charCount > YOUTUBE_CHAR_LIMIT;

  useEffect(() => {
    if (result) {
      setEditedDescription(result.description);
    }
  }, [result]);

  const handleGenerate = useCallback(async () => {
    if (!title.trim() || !topic.trim()) {
      toast({ title: 'Please enter a video title and topic', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(`${supabaseUrl}/functions/v1/seo-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token || supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'description',
          title: title.trim(),
          topic: topic.trim(),
          keywords: keywords.trim(),
          tone,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const description: string = data.description || '';
      const seoScore: number = data.seoScore ?? 0;

      const newResult: DescriptionResult = {
        description,
        seoScore,
        hasTimestamps: data.hasTimestamps ?? /\d{1,2}:\d{2}/.test(description),
        hasLinks: data.hasLinks ?? /https?:\/\//.test(description),
        hasHashtags: data.hasHashtags ?? /#\w+/.test(description),
        characterCount: description.length,
        wordCount: description.trim().split(/\s+/).filter(Boolean).length,
        suggestions: data.suggestions || [],
      };

      setResult(newResult);
      toast({
        title: 'Description generated',
        description: `SEO Score: ${seoScore}/100 · ${newResult.characterCount} chars`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast({ title: 'Generation failed', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [title, topic, keywords, tone, toast]);

  const handleCopy = useCallback(async () => {
    if (!editedDescription) return;
    await navigator.clipboard.writeText(editedDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Description copied to clipboard' });
  }, [editedDescription, toast]);

  const handleDownload = useCallback(() => {
    if (!editedDescription) return;
    const blob = new Blob([editedDescription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `description-${title.trim().toLowerCase().replace(/\s+/g, '-') || 'untitled'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Description downloaded' });
  }, [editedDescription, title, toast]);

  const handleSave = useCallback(async () => {
    if (!editedDescription) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { error: saveError } = await supabase
        .from('seo_saved_content')
        .insert({
          user_id: userId,
          content_type: 'description',
          title: title.trim(),
          content: editedDescription,
          seo_score: result?.seoScore ?? null,
          metadata: {
            topic: topic.trim(),
            keywords: keywords.trim(),
            tone,
            characterCount: editedDescription.length,
            wordCount: editedDescription.trim().split(/\s+/).filter(Boolean).length,
          },
        });

      if (saveError) throw saveError;
      toast({ title: 'Description saved to Supabase', description: 'Find it in your saved content library' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [editedDescription, title, topic, keywords, tone, result, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Description Generator"
        description="Generate SEO-optimized YouTube descriptions with timestamps, links, and hashtags"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          <div>
            <Label htmlFor="desc-title" className="mb-2 block">Video Title</Label>
            <Input
              id="desc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to Build a React App from Scratch (2024 Guide)"
            />
          </div>
          <div>
            <Label htmlFor="desc-topic" className="mb-2 block">Video Topic / Summary</Label>
            <Textarea
              id="desc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what your video is about. The more detail you provide, the better the description."
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="desc-keywords" className="mb-2 block">Target Keywords (comma-separated)</Label>
              <Input
                id="desc-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. react tutorial, web development, javascript"
              />
            </div>
            <div>
              <Label className="mb-2 block">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !title.trim() || !topic.trim()}
            className="w-full sm:w-auto"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Description
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {generating ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">Generating SEO-optimized description...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crafting timestamps, links, and hashtags for maximum discoverability
                </p>
              </div>
            </Card>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState message={error} onRetry={handleGenerate} />
          </motion.div>
        ) : result ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* SEO Score + Stats Bar */}
              <Card className="glass p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <span className={cn('font-display text-xl font-bold', getScoreColor(result.seoScore))}>
                        {result.seoScore}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">SEO Score</p>
                      <p className="text-xs text-muted-foreground">{getScoreLabel(result.seoScore)}</p>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <Badge variant={result.hasTimestamps ? 'default' : 'outline'} className="gap-1">
                      <Clock className="h-3 w-3" />
                      {result.hasTimestamps ? 'Timestamps' : 'No Timestamps'}
                    </Badge>
                    <Badge variant={result.hasLinks ? 'default' : 'outline'} className="gap-1">
                      <LinkIcon className="h-3 w-3" />
                      {result.hasLinks ? 'Links' : 'No Links'}
                    </Badge>
                    <Badge variant={result.hasHashtags ? 'default' : 'outline'} className="gap-1">
                      <Hash className="h-3 w-3" />
                      {result.hasHashtags ? 'Hashtags' : 'No Hashtags'}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Editable description */}
              <Card className="glass p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Generated Description</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy} disabled={!editedDescription}>
                      {copied ? (
                        <>
                          <Check className="mr-2 h-3.5 w-3.5 text-success" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload} disabled={!editedDescription}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !editedDescription}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-3.5 w-3.5" />
                          Save to Supabase
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={16}
                  className="glass font-mono text-sm"
                  placeholder="Your generated description will appear here. You can edit it before copying or saving."
                />

                {/* Character count bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {charCount.toLocaleString()} / {YOUTUBE_CHAR_LIMIT.toLocaleString()} characters
                      {isOverLimit && (
                        <span className="ml-2 font-medium text-destructive">
                          (Exceeds limit by {(charCount - YOUTUBE_CHAR_LIMIT).toLocaleString()})
                        </span>
                      )}
                    </span>
                    <span className={cn('font-medium', isOverLimit ? 'text-destructive' : charCount > 4000 ? 'text-yellow-500' : 'text-success')}>
                      {Math.round(charPercentage)}%
                    </span>
                  </div>
                  <Progress
                    value={charPercentage}
                    className={cn('h-2', isOverLimit && '[&>div]:bg-destructive')}
                  />
                </div>
              </Card>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <Card className="glass p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-sm font-semibold">SEO Suggestions</h3>
                  </div>
                  <ul className="space-y-2">
                    {result.suggestions.map((suggestion, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{suggestion}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={FileText}
              title="No description generated yet"
              description="Enter your video title, topic, and target keywords above, then click Generate to create an SEO-optimized description."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
