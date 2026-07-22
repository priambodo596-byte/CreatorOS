'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash,
  Sparkles,
  Copy,
  Check,
  Loader2,
  TrendingUp,
  Search,
  Filter,
  BarChart3,
  Target,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  SearchInput,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type CompetitionLevel = 'Low' | 'Medium' | 'High';
type RelevanceLevel = 'High' | 'Medium' | 'Low';

interface Hashtag {
  tag: string;
  relevance: RelevanceLevel;
  competition: CompetitionLevel;
  competitionScore: number;
  searchVolume: number;
  trendScore: number;
}

interface HashtagResult {
  hashtags: Hashtag[];
}

const COMPETITION_COLORS: Record<CompetitionLevel, string> = {
  Low: 'bg-success/15 text-success border-success/30',
  Medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  High: 'bg-destructive/15 text-destructive border-destructive/30',
};

const RELEVANCE_COLORS: Record<RelevanceLevel, string> = {
  High: 'bg-primary/15 text-primary border-primary/30',
  Medium: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  Low: 'bg-muted text-muted-foreground border-border',
};

const COMPETITION_FILTERS: Array<CompetitionLevel | 'All'> = ['All', 'Low', 'Medium', 'High'];

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getTrendIcon(score: number) {
  if (score >= 70) return <TrendingUp className="h-3 w-3 text-success" />;
  if (score >= 40) return <TrendingUp className="h-3 w-3 text-yellow-500" />;
  return <TrendingUp className="h-3 w-3 text-destructive rotate-180" />;
}

export default function HashtagGeneratorPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HashtagResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [competitionFilter, setCompetitionFilter] = useState<CompetitionLevel | 'All'>('All');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSelected, setCopiedSelected] = useState(false);

  const filteredHashtags = useMemo(() => {
    if (!result) return [];
    return result.hashtags.filter((h) => {
      const matchesSearch = !searchQuery || h.tag.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCompetition = competitionFilter === 'All' || h.competition === competitionFilter;
      return matchesSearch && matchesCompetition;
    });
  }, [result, searchQuery, competitionFilter]);

  const groupedHashtags = useMemo(() => {
    const groups: Record<RelevanceLevel, Hashtag[]> = { High: [], Medium: [], Low: [] };
    filteredHashtags.forEach((h) => {
      groups[h.relevance].push(h);
    });
    return groups;
  }, [filteredHashtags]);

  const toggleSelect = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!title.trim() || !topic.trim()) {
      toast({ title: 'Please enter a video title and topic', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setSelectedTags(new Set());
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
          action: 'hashtags',
          title: title.trim(),
          topic: topic.trim(),
          niche: niche.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const hashtags: Hashtag[] = (data.hashtags || []).map((h: Record<string, unknown>) => ({
        tag: String(h.tag || ''),
        relevance: (h.relevance as RelevanceLevel) || 'Medium',
        competition: (h.competition as CompetitionLevel) || 'Medium',
        competitionScore: Number(h.competitionScore ?? 50),
        searchVolume: Number(h.searchVolume ?? 0),
        trendScore: Number(h.trendScore ?? 50),
      }));

      setResult({ hashtags });
      toast({ title: 'Hashtags generated', description: `${hashtags.length} hashtags found` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast({ title: 'Generation failed', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [title, topic, niche, toast]);

  const handleCopyAll = useCallback(async () => {
    if (!filteredHashtags.length) return;
    const text = filteredHashtags.map((h) => `#${h.tag}`).join(' ');
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast({ title: 'All hashtags copied', description: `${filteredHashtags.length} hashtags` });
  }, [filteredHashtags, toast]);

  const handleCopySelected = useCallback(async () => {
    if (!selectedTags.size) {
      toast({ title: 'No hashtags selected', variant: 'destructive' });
      return;
    }
    const text = Array.from(selectedTags).map((t) => `#${t}`).join(' ');
    await navigator.clipboard.writeText(text);
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
    toast({ title: 'Selected hashtags copied', description: `${selectedTags.size} hashtags` });
  }, [selectedTags, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hashtag Generator"
        description="Generate 30 relevant YouTube hashtags with competition, volume, and trend data"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="hash-title" className="mb-2 block">Video Title</Label>
              <Input
                id="hash-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. React Tutorial 2024"
              />
            </div>
            <div>
              <Label htmlFor="hash-topic" className="mb-2 block">Topic</Label>
              <Input
                id="hash-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Web development basics"
              />
            </div>
            <div>
              <Label htmlFor="hash-niche" className="mb-2 block">Niche</Label>
              <Input
                id="hash-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Technology, Education"
              />
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
                Generate Hashtags
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
                <p className="mt-4 text-sm font-medium">Generating hashtags...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzing competition, search volume, and trend scores
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
              {/* Toolbar */}
              <Card className="glass p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-primary" />
                    <span className="font-display text-lg font-semibold">
                      {result.hashtags.length} Hashtags
                    </span>
                    {selectedTags.size > 0 && (
                      <Badge variant="secondary">{selectedTags.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyAll} disabled={!filteredHashtags.length}>
                      {copiedAll ? (
                        <>
                          <Check className="mr-2 h-3.5 w-3.5 text-success" />
                          Copied All!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy All
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopySelected} disabled={!selectedTags.size}>
                      {copiedSelected ? (
                        <>
                          <Check className="mr-2 h-3.5 w-3.5 text-success" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy Selected
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search hashtags..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={competitionFilter} onValueChange={(v) => setCompetitionFilter(v as CompetitionLevel | 'All')}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPETITION_FILTERS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f === 'All' ? 'All Competition' : `${f} Competition`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Hashtag groups */}
              {(['High', 'Medium', 'Low'] as RelevanceLevel[]).map((relevance) => {
                const tags = groupedHashtags[relevance];
                if (!tags.length) return null;
                return (
                  <Card key={relevance} className="glass p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="outline" className={cn('gap-1 border', RELEVANCE_COLORS[relevance])}>
                        <Target className="h-3 w-3" />
                        {relevance} Relevance
                      </Badge>
                      <span className="text-xs text-muted-foreground">{tags.length} hashtags</span>
                    </div>
                    <div className="space-y-2">
                      {tags.map((h, i) => {
                        const isSelected = selectedTags.has(h.tag);
                        return (
                          <motion.div
                            key={`${h.tag}-${i}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <div
                              className={cn(
                                'flex items-center gap-3 rounded-xl border p-3 transition-colors cursor-pointer',
                                isSelected
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-border glass-hover'
                              )}
                              onClick={() => toggleSelect(h.tag)}
                            >
                              <div
                                className={cn(
                                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-muted-foreground/30'
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                #{h.tag}
                              </span>
                              {/* Metrics */}
                              <div className="hidden items-center gap-3 sm:flex">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={cn('gap-1 border', COMPETITION_COLORS[h.competition])}>
                                    {h.competition}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <BarChart3 className="h-3 w-3" />
                                  {formatVolume(h.searchVolume)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {getTrendIcon(h.trendScore)}
                                  {h.trendScore}
                                </div>
                              </div>
                              {/* Mobile metrics */}
                              <div className="flex flex-col items-end gap-1 sm:hidden">
                                <Badge variant="outline" className={cn('gap-1 border', COMPETITION_COLORS[h.competition])}>
                                  {h.competition}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatVolume(h.searchVolume)}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}

              {filteredHashtags.length === 0 && (
                <EmptyState
                  icon={Search}
                  title="No hashtags match your filters"
                  description="Try adjusting your search query or competition filter."
                />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Hash}
              title="No hashtags generated yet"
              description="Enter your video title, topic, and niche above, then click Generate to discover relevant hashtags."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
