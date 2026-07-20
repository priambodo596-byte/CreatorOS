'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Hash,
  TrendingUp,
  FileText,
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
  generateTitles,
  getScoreColor,
  getScoreBadgeVariant,
  getScoreLabel,
  type TitleGenerationResult,
} from '@/lib/seo-tools';

export default function TitlesPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [videoTopic, setVideoTopic] = useState('');
  const [count, setCount] = useState('10');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TitleGenerationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!keyword.trim() || !videoTopic.trim()) {
      toast({ title: 'Please enter both keyword and video topic', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateTitles({
        keyword: keyword.trim(),
        videoTopic: videoTopic.trim(),
        count: parseInt(count, 10),
      });
      setResult(res);
      toast({ title: 'Titles generated', description: `${res.titles.length} variations` });
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

  const handleCopy = async (title: string, index: number) => {
    await navigator.clipboard.writeText(title);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: 'Title copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Title Generator"
        description="Generate SEO-optimized YouTube titles with AI scoring"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="keyword" className="mb-2 block">Keyword</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. react tutorial"
              />
            </div>
            <div>
              <Label htmlFor="video-topic" className="mb-2 block">Video Topic</Label>
              <Input
                id="video-topic"
                value={videoTopic}
                onChange={(e) => setVideoTopic(e.target.value)}
                placeholder="e.g. building a todo app"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48">
              <Label className="mb-2 block">Number of Titles</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} titles</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating || !keyword.trim() || !videoTopic.trim()} className="w-full sm:w-auto">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Titles
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
                <p className="mt-4 text-sm font-medium">Generating title variations...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optimizing for SEO, CTR, and keyword relevance
                </p>
              </div>
            </Card>
          </motion.div>
        ) : result ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-3">
              {result.titles.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass glass-hover p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-relaxed">{item.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={getScoreBadgeVariant(item.seoScore)}>
                            <TrendingUp className="mr-1 h-3 w-3" />
                            {item.seoScore} · {getScoreLabel(item.seoScore)}
                          </Badge>
                          <Badge variant="outline">
                            <Hash className="mr-1 h-3 w-3" />
                            {item.characterCount} chars
                          </Badge>
                          <Badge variant="outline">
                            <FileText className="mr-1 h-3 w-3" />
                            {item.wordCount} words
                          </Badge>
                        </div>
                        {item.reasons.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {item.reasons.map((reason, ri) => (
                              <li key={ri} className="text-xs text-muted-foreground">
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleCopy(item.title, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Type}
              title="No titles generated yet"
              description="Enter a keyword and video topic above, then click Generate to create SEO-optimized title variations."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
