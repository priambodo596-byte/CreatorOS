'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tags,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Hash,
  Layers,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  generateTags,
  type TagGenerationResult,
} from '@/lib/seo-tools';

const CATEGORY_COLORS: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground',
  'title-derived': 'bg-blue-500 text-white',
  broad: 'bg-purple-500 text-white',
  'long-tail': 'bg-green-500 text-white',
};

export default function TagsPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [count, setCount] = useState('20');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TagGenerationResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleGenerate = async () => {
    if (!keyword.trim() || !videoTitle.trim()) {
      toast({ title: 'Please enter both keyword and video title', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateTags({
        keyword: keyword.trim(),
        videoTitle: videoTitle.trim(),
        count: parseInt(count, 10),
      });
      setResult(res);
      toast({ title: 'Tags generated', description: `${res.tags.length} tags` });
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

  const handleCopyAll = async () => {
    if (!result) return;
    const allTags = result.tags.map((t) => t.tag).join(', ');
    await navigator.clipboard.writeText(allTags);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast({ title: 'All tags copied', description: `${result.tags.length} tags copied to clipboard` });
  };

  const handleCopyTag = async (tag: string) => {
    await navigator.clipboard.writeText(tag);
    toast({ title: 'Tag copied', description: tag });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags Generator"
        description="Generate SEO-optimized YouTube tags from your keyword and title"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tag-keyword" className="mb-2 block">Keyword</Label>
              <Input
                id="tag-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. react tutorial"
              />
            </div>
            <div>
              <Label htmlFor="tag-video-title" className="mb-2 block">Video Title</Label>
              <Input
                id="tag-video-title"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g. React Tutorial for Beginners 2024"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48">
              <Label className="mb-2 block">Number of Tags</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 40, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} tags</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating || !keyword.trim() || !videoTitle.trim()} className="w-full sm:w-auto">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Tags
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {generating ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">Generating tags...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzing keyword relevance and search volume patterns
                </p>
              </div>
            </Card>
          </motion.div>
        ) : result ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-primary" />
                  <span className="font-display text-lg font-semibold">{result.tags.length} Tags Generated</span>
                </div>
                <Button variant="outline" onClick={handleCopyAll}>
                  {copiedAll ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                      Copied All!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>

              {/* Category legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Primary
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Title-Derived
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Broad
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Long-Tail
                </span>
              </div>

              {/* Tags grid */}
              <div className="flex flex-wrap gap-2">
                {result.tags.map((item, i) => (
                  <motion.button
                    key={`${item.tag}-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => handleCopyTag(item.tag)}
                    className="group"
                  >
                    <Badge
                      variant="secondary"
                      className={`cursor-pointer gap-1.5 py-1.5 pl-3 pr-2 text-sm transition-transform hover:scale-105 ${CATEGORY_COLORS[item.category] ?? ''}`}
                    >
                      {item.tag}
                      <span className="rounded bg-black/20 px-1 text-xs">
                        {item.relevanceScore}
                      </span>
                      <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
                    </Badge>
                  </motion.button>
                ))}
              </div>

              {/* Summary card */}
              <Card className="glass p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  <span>
                    {result.tags.filter((t) => t.category === 'primary').length} primary ·
                    {' '}{result.tags.filter((t) => t.category === 'title-derived').length} title-derived ·
                    {' '}{result.tags.filter((t) => t.category === 'broad').length} broad ·
                    {' '}{result.tags.filter((t) => t.category === 'long-tail').length} long-tail
                  </span>
                </div>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Tags}
              title="No tags generated yet"
              description="Enter a keyword and video title above, then click Generate to create SEO-optimized tags."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
