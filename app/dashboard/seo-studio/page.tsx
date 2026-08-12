'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Sparkles,
  Copy,
  Check,
  Hash,
  Type,
  FileText,
  Clock,
  Target,
  TrendingUp,
  RefreshCw,
  Loader2,
  Video,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  generateTags,
  getScoreBadgeVariant,
  getScoreLabel,
  type TitleGenerationResult,
  type TagGenerationResult,
} from '@/lib/seo-tools';
import { getSyncedVideos, type SyncedVideo } from '@/lib/youtube';

interface TimestampEntry {
  time: string;
  label: string;
}

export default function SEOStudioPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [videos, setVideos] = useState<SyncedVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('none');
  const [keyword, setKeyword] = useState('');
  const [topic, setTopic] = useState('');

  const [titleResult, setTitleResult] = useState<TitleGenerationResult | null>(null);
  const [tagResult, setTagResult] = useState<TagGenerationResult | null>(null);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<TimestampEntry[]>([]);

  const [genTitles, setGenTitles] = useState(false);
  const [genTags, setGenTags] = useState(false);
  const [genDesc, setGenDesc] = useState(false);
  const [genHashtags, setGenHashtags] = useState(false);
  const [genTimestamps, setGenTimestamps] = useState(false);

  const selectedVideo = videos.find((v) => v.video_id === selectedVideoId) || null;

  useEffect(() => {
    (async () => {
      try {
        const vids = await getSyncedVideos(50);
        setVideos(vids);
      } catch {
        // no videos synced yet
      } finally {
        setVideosLoading(false);
      }
    })();
  }, []);

  // Auto-fill keyword/topic from selected video
  useEffect(() => {
    if (selectedVideo) {
      setKeyword(selectedVideo.title?.split(/\s+/).slice(0, 3).join(' ') || '');
      setTopic(selectedVideo.title || '');
      setDescription(selectedVideo.description || '');
      setHashtags(extractHashtags(selectedVideo.description || ''));
      setTimestamps(extractTimestamps(selectedVideo.description || ''));
    }
  }, [selectedVideo]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateTitles = async () => {
    if (!keyword.trim() || !topic.trim()) {
      toast({ title: 'Enter a keyword and topic first', variant: 'destructive' });
      return;
    }
    setGenTitles(true);
    try {
      const res = await generateTitles({ keyword: keyword.trim(), videoTopic: topic.trim(), count: 8 });
      setTitleResult(res);
      toast({ title: 'Titles generated', description: `${res.titles.length} variations` });
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setGenTitles(false);
    }
  };

  const handleGenerateTags = async () => {
    const titleForTags = topic.trim() || selectedVideo?.title || '';
    const kwForTags = keyword.trim() || titleForTags.split(/\s+/).slice(0, 2).join(' ');
    if (!kwForTags || !titleForTags) {
      toast({ title: 'Enter a keyword and topic first', variant: 'destructive' });
      return;
    }
    setGenTags(true);
    try {
      const res = await generateTags({ keyword: kwForTags, videoTitle: titleForTags, count: 20 });
      setTagResult(res);
      toast({ title: 'Tags generated', description: `${res.tags.length} tags` });
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setGenTags(false);
    }
  };

  const handleGenerateDescription = useCallback(() => {
    if (!topic.trim()) {
      toast({ title: 'Enter a topic first', variant: 'destructive' });
      return;
    }
    setGenDesc(true);
    setTimeout(() => {
      const desc = buildDescription(topic, keyword, timestamps, hashtags);
      setDescription(desc);
      setGenDesc(false);
      toast({ title: 'Description generated' });
    }, 600);
  }, [topic, keyword, timestamps, hashtags, toast]);

  const handleGenerateHashtags = useCallback(() => {
    if (!keyword.trim()) {
      toast({ title: 'Enter a keyword first', variant: 'destructive' });
      return;
    }
    setGenHashtags(true);
    setTimeout(() => {
      const tags = buildHashtags(keyword, topic);
      setHashtags(tags);
      setGenHashtags(false);
      toast({ title: 'Hashtags generated', description: `${tags.length} hashtags` });
    }, 500);
  }, [keyword, topic, toast]);

  const handleGenerateTimestamps = useCallback(() => {
    if (!topic.trim()) {
      toast({ title: 'Enter a topic first', variant: 'destructive' });
      return;
    }
    setGenTimestamps(true);
    setTimeout(() => {
      const ts = buildTimestamps(topic);
      setTimestamps(ts);
      setGenTimestamps(false);
      toast({ title: 'Timestamps generated', description: `${ts.length} chapters` });
    }, 500);
  }, [topic, toast]);

  // Compute SEO scores from real data
  const titleScore = titleResult?.titles?.[0]?.seoScore ?? 0;
  const tagScore = tagResult ? Math.min(100, Math.round((tagResult.tags.length / 20) * 80 + 20)) : 0;
  const descScore = description ? Math.min(100, Math.round((description.length / 500) * 60 + (hashtags.length > 0 ? 20 : 0) + (timestamps.length > 0 ? 20 : 0))) : 0;
  const overallScore = Math.round((titleScore + descScore + tagScore) / 3);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            SEO Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Optimize your videos for YouTube search and discovery with AI.
          </p>
        </div>
      </motion.div>

      {/* Video selector + keyword/topic inputs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="glass p-5">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Select a synced video (optional)</Label>
              {videosLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos...
                </div>
              ) : videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No synced videos found. Connect your YouTube channel in Settings to auto-fill, or enter a keyword and topic manually below.
                </p>
              ) : (
                <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a video to optimize" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {videos.map((v) => (
                      <SelectItem key={v.video_id} value={v.video_id}>
                        {v.title?.slice(0, 60) ?? 'Untitled'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="seo-keyword" className="mb-2 block">Keyword</Label>
                <Input
                  id="seo-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. AI tools"
                />
              </div>
              <div>
                <Label htmlFor="seo-topic" className="mb-2 block">Video Topic / Title</Label>
                <Input
                  id="seo-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Building an AI app in 24 hours"
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* SEO Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="relative mx-auto h-24 w-24">
                <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-primary/20">
                  <div className="text-center">
                    <p className="font-display text-3xl font-bold text-primary">{overallScore}</p>
                    <p className="text-xs text-muted-foreground">/100</p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium">Overall SEO Score</p>
            </div>
            {[
              { label: 'Title', score: titleScore, icon: Type },
              { label: 'Description', score: descScore, icon: FileText },
              { label: 'Tags', score: tagScore, icon: Hash },
            ].map((item) => (
              <div key={item.label} className="rounded-xl glass p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="font-display text-lg font-bold text-success">{item.score}</span>
                </div>
                <Progress value={item.score} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <Tabs defaultValue="titles">
        <TabsList className="glass">
          <TabsTrigger value="titles">Title Generator</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="timestamps">Timestamps</TabsTrigger>
        </TabsList>

        {/* Titles */}
        <TabsContent value="titles" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Titles</h2>
              <Button variant="outline" size="sm" onClick={handleGenerateTitles} disabled={genTitles}>
                {genTitles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
            </div>
            <AnimatePresence mode="wait">
              {genTitles ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Generating titles...</p>
                </motion.div>
              ) : titleResult ? (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {titleResult.titles.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <span className="font-display text-sm font-bold text-primary">{item.seoScore}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.characterCount} chars · {item.wordCount} words · {getScoreLabel(item.seoScore)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copy(item.title, `title-${i}`)}>
                        {copied === `title-${i}` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col items-center py-8 text-center">
                    <Type className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">Enter a keyword and topic above, then click Regenerate to create titles.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </TabsContent>

        {/* Description */}
        <TabsContent value="description" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Description</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerateDescription} disabled={genDesc}>
                  {genDesc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Regenerate
                </Button>
                {description && (
                  <Button variant="outline" size="sm" onClick={() => copy(description, 'desc')}>
                    {copied === 'desc' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={18}
              placeholder="Click Regenerate to create an SEO-optimized description, or select a synced video to load its existing description."
              className="glass font-mono text-sm"
            />
            {description && (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-muted-foreground">Characters: {description.length}</span>
                <Badge variant="secondary">SEO Score: {descScore}/100</Badge>
                {timestamps.length > 0 && <Badge variant="secondary">Has timestamps</Badge>}
                {hashtags.length > 0 && <Badge variant="secondary">Has hashtags</Badge>}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Tags</h2>
              <Button variant="outline" size="sm" onClick={handleGenerateTags} disabled={genTags}>
                {genTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
            </div>
            <AnimatePresence mode="wait">
              {genTags ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Generating tags...</p>
                </motion.div>
              ) : tagResult ? (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-wrap gap-2">
                    {tagResult.tags.map((tag, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:border-primary/30 transition-colors">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span>{tag.tag}</span>
                        <Badge variant="outline" className="text-xs">{tag.relevanceScore}</Badge>
                        <button onClick={() => copy(tag.tag, `tag-${i}`)} className="text-muted-foreground hover:text-foreground">
                          {copied === `tag-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl glass p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium">AI Tip:</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">Use a mix of broad and specific tags. Your top 3 tags should match your title keywords for best search visibility.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col items-center py-8 text-center">
                    <Hash className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">Click Regenerate to create SEO-optimized tags.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </TabsContent>

        {/* Hashtags */}
        <TabsContent value="hashtags" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Hashtags</h2>
              <Button variant="outline" size="sm" onClick={handleGenerateHashtags} disabled={genHashtags}>
                {genHashtags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
            </div>
            <AnimatePresence mode="wait">
              {genHashtags ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Generating hashtags...</p>
                </motion.div>
              ) : hashtags.length > 0 ? (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:border-primary/30 transition-colors">
                        <Hash className="h-3 w-3 text-primary" />
                        <span>{tag.replace('#', '')}</span>
                        <button onClick={() => copy(tag, `hash-${i}`)} className="text-muted-foreground hover:text-foreground">
                          {copied === `hash-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">YouTube allows up to 15 hashtags in the description. The first 3 appear above the title.</p>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col items-center py-8 text-center">
                    <Hash className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">Click Regenerate to create hashtags from your keyword.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </TabsContent>

        {/* Timestamps */}
        <TabsContent value="timestamps" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Timestamps</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerateTimestamps} disabled={genTimestamps}>
                  {genTimestamps ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Regenerate
                </Button>
                {timestamps.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => copy(timestamps.map(t => `${t.time} ${t.label}`).join('\n'), 'ts')}>
                    {copied === 'ts' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
            <AnimatePresence mode="wait">
              {genTimestamps ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Generating timestamps...</p>
                </motion.div>
              ) : timestamps.length > 0 ? (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  {timestamps.map((ts, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg glass p-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm font-medium text-primary">{ts.time}</span>
                      </div>
                      <span className="text-sm">{ts.label}</span>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex flex-col items-center py-8 text-center">
                    <Clock className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">Click Regenerate to create chapter timestamps, or select a synced video to load existing chapters.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches ? matches.slice(0, 15) : [];
}

function extractTimestamps(text: string): TimestampEntry[] {
  const lines = text.split('\n');
  const result: TimestampEntry[] = [];
  const tsRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/;
  for (const line of lines) {
    const m = line.match(tsRegex);
    if (m) result.push({ time: m[1], label: m[2].trim() });
  }
  return result;
}

function buildDescription(topic: string, keyword: string, timestamps: TimestampEntry[], hashtags: string[]): string {
  const parts: string[] = [];
  parts.push(`In this video, we dive deep into ${topic}. Whether you're a beginner or an experienced creator, you'll learn practical tips and strategies you can apply right away.`);
  parts.push('');
  parts.push('What you\'ll learn:');
  parts.push(`- Key concepts around ${keyword}`);
  parts.push('- Step-by-step walkthrough');
  parts.push('- Pro tips and common mistakes to avoid');
  parts.push('- Real-world examples and use cases');
  parts.push('');
  if (timestamps.length > 0) {
    parts.push('Timestamps:');
    timestamps.forEach((ts) => parts.push(`${ts.time} ${ts.label}`));
    parts.push('');
  }
  parts.push('Links:');
  parts.push('- Subscribe for more content');
  parts.push('- Follow for updates');
  parts.push('');
  if (hashtags.length > 0) {
    parts.push(hashtags.join(' '));
  } else {
    parts.push(`#${keyword.replace(/\s+/g, '')} #YouTube #Tutorial`);
  }
  return parts.join('\n');
}

function buildHashtags(keyword: string, topic: string): string[] {
  const kw = keyword.trim().replace(/\s+/g, '');
  const topicWords = topic.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const tags = new Set<string>([`#${kw}`]);
  topicWords.slice(0, 5).forEach((w) => tags.add(`#${w}`));
  ['YouTube', 'Tutorial', 'HowTo', 'Guide', 'Tips', '2026', 'Trending', 'Viral', 'ContentCreator', 'Education'].forEach((t) => tags.add(`#${t}`));
  return Array.from(tags).slice(0, 15);
}

function buildTimestamps(topic: string): TimestampEntry[] {
  const labels = [
    'Intro',
    `What is ${topic.split(/\s+/).slice(0, 3).join(' ')}`,
    'Getting Started',
    'Step-by-Step Walkthrough',
    'Pro Tips & Tricks',
    'Common Mistakes to Avoid',
    'Real-World Examples',
    'Final Thoughts & Next Steps',
  ];
  const times = ['0:00', '0:45', '2:00', '5:30', '10:00', '14:30', '18:00', '22:00'];
  return labels.map((label, i) => ({ time: times[i] || `${i * 3}:00`, label }));
}
