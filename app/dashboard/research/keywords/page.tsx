'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Hash,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Target,
  Gauge,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SkeletonTable,
  formatNumber,
} from '@/components/dashboard/shared';
import { fetchKeywordSuggestions, type KeywordSuggestion } from '@/lib/youtube-research';

type SortKey = 'searchVolume' | 'competition' | 'difficulty' | 'avgViews';

function getDifficultyColor(score: number): { color: string; bg: string; label: string } {
  if (score >= 70) return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Hard' };
  if (score >= 40) return { color: 'text-warning', bg: 'bg-warning/10', label: 'Medium' };
  return { color: 'text-success', bg: 'bg-success/10', label: 'Easy' };
}

function getTrendIcon(trend: KeywordSuggestion['trend']) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function KeywordResearchPage() {
  const [keyword, setKeyword] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('searchVolume');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setActiveKeyword(trimmed);

    try {
      const result = await fetchKeywordSuggestions(trimmed);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch keyword data');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      switch (sortBy) {
        case 'competition': return b.competition - a.competition;
        case 'difficulty': return b.difficulty - a.difficulty;
        case 'avgViews': return b.avgViews - a.avgViews;
        case 'searchVolume':
        default: return b.searchVolume - a.searchVolume;
      }
    });
  }, [suggestions, sortBy]);

  // Aggregate stats for summary cards
  const summaryStats = useMemo(() => {
    if (sortedSuggestions.length === 0) {
      return { totalVolume: 0, avgDifficulty: 0, easyKeywords: 0, trendingUp: 0 };
    }
    const totalVolume = sortedSuggestions.reduce((s, k) => s + k.searchVolume, 0);
    const avgDifficulty = Math.round(
      sortedSuggestions.reduce((s, k) => s + k.difficulty, 0) / sortedSuggestions.length,
    );
    const easyKeywords = sortedSuggestions.filter((k) => k.difficulty < 40).length;
    const trendingUp = sortedSuggestions.filter((k) => k.trend === 'up').length;
    return { totalVolume, avgDifficulty, easyKeywords, trendingUp };
  }, [sortedSuggestions]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Keyword Research"
        description="Discover real keyword opportunities with search volume, competition, and difficulty scores from the YouTube Data API."
      />

      {/* Search Bar */}
      <Card className="glass p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a keyword (e.g., 'content marketing', 'react tutorial')..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !keyword.trim()}>
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Researching...' : 'Research'}
          </Button>
        </div>
      </Card>

      {/* States */}
      {loading && (
        <>
          <LoadingState message={`Researching keywords for "${activeKeyword}"...`} />
          <SkeletonTable rows={8} cols={6} />
        </>
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={handleSearch} />
      )}

      {!loading && !error && !hasSearched && (
        <EmptyState
          icon={Hash}
          title="Start your keyword research"
          description="Enter a keyword above to discover related search terms with real search volume, competition data, and difficulty scores."
        />
      )}

      {!loading && !error && hasSearched && sortedSuggestions.length === 0 && (
        <EmptyState
          icon={Hash}
          title="No keyword suggestions found"
          description="Try a different keyword or check your connection."
          action={
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          }
        />
      )}

      {/* Results */}
      {!loading && !error && sortedSuggestions.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'Total Search Volume',
                value: formatNumber(summaryStats.totalVolume),
                icon: Eye,
                color: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                label: 'Avg Difficulty',
                value: `${summaryStats.avgDifficulty}/100`,
                icon: Gauge,
                color: 'text-warning',
                bg: 'bg-warning/10',
              },
              {
                label: 'Easy Keywords',
                value: summaryStats.easyKeywords,
                icon: Target,
                color: 'text-success',
                bg: 'bg-success/10',
              },
              {
                label: 'Trending Up',
                value: summaryStats.trendingUp,
                icon: TrendingUp,
                color: 'text-accent',
                bg: 'bg-accent/10',
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass glass-hover p-5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {sortedSuggestions.length} keyword suggestions for{' '}
              <span className="font-medium text-foreground">&quot;{activeKeyword}&quot;</span>
            </p>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-44">
                <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="searchVolume">Search Volume</SelectItem>
                <SelectItem value="competition">Competition</SelectItem>
                <SelectItem value="difficulty">Difficulty</SelectItem>
                <SelectItem value="avgViews">Avg Views</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <Card className="glass p-5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Keyword</TableHead>
                    <TableHead className="text-right">Search Volume</TableHead>
                    <TableHead className="text-right">Competition</TableHead>
                    <TableHead className="text-right">Difficulty</TableHead>
                    <TableHead className="text-right">Avg Views</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead className="min-w-[200px]">Top Video</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSuggestions.map((kw, i) => {
                    const diff = getDifficultyColor(kw.difficulty);
                    return (
                      <motion.tr
                        key={`${kw.keyword}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/30 hover:bg-muted/20"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-sm">{kw.keyword}</span>
                          </div>
                          {kw.relatedKeywords.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 pl-5">
                              {kw.relatedKeywords.slice(0, 3).map((rel) => (
                                <Badge key={rel} variant="outline" className="text-xs">
                                  {rel}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(kw.searchVolume)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(kw.competition)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted/40">
                              <div
                                className={`h-full rounded-full ${diff.bg.replace('/10', '')}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${diff.color}`}>
                              {diff.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(kw.avgViews)}
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>{getTrendIcon(kw.trend)}</TooltipTrigger>
                              <TooltipContent>
                                <span className="capitalize">{kw.trend}</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {kw.topVideoId ? (
                            <a
                              href={`https://www.youtube.com/watch?v=${kw.topVideoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span className="truncate max-w-[180px]">{kw.topVideoTitle}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* AI Insight */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-display text-lg font-semibold">Keyword Insights</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  {
                    title: 'Best opportunity',
                    detail: summaryStats.easyKeywords > 0
                      ? `${summaryStats.easyKeywords} keywords have low difficulty (under 40). Target these first for quick wins.`
                      : 'All keywords have medium-to-high difficulty. Consider long-tail variations for better chances.',
                    icon: Target,
                    color: 'text-success',
                  },
                  {
                    title: 'Trending keywords',
                    detail: summaryStats.trendingUp > 0
                      ? `${summaryStats.trendingUp} keywords are trending up. Create content around these topics while momentum is building.`
                      : 'No keywords are currently trending up. Monitor for seasonal changes.',
                    icon: TrendingUp,
                    color: 'text-primary',
                  },
                ].map((insight, i) => (
                  <div key={i} className="rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                    <insight.icon className={`mb-2 h-5 w-5 ${insight.color}`} />
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
