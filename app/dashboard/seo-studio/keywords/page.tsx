'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Save,
  ArrowUp,
  ArrowDown,
  Filter,
  History,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase-client';

type CompetitionLevel = 'Low' | 'Medium' | 'High';
type TrendDirection = 'up' | 'down' | 'stable';
type SortField = 'volume' | 'opportunity' | 'score' | 'competition';

interface KeywordIdea {
  keyword: string;
  searchVolume: number;
  competition: CompetitionLevel;
  cpc: number;
  trendDirection: TrendDirection;
  opportunityScore: number;
}

interface SearchHistoryEntry {
  keyword: string;
  country: string;
  language: string;
  resultCount: number;
  searchedAt: string;
}

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'KR', label: 'South Korea' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'global', label: 'Global' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'hi', label: 'Hindi' },
  { value: 'zh', label: 'Chinese' },
];

const COMPETITION_COLORS: Record<CompetitionLevel, string> = {
  Low: 'bg-success/15 text-success border-success/30',
  Medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  High: 'bg-destructive/15 text-destructive border-destructive/30',
};

function getTrendIcon(direction: TrendDirection) {
  if (direction === 'up') return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (direction === 'down') return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCPC(cpc: number): string {
  if (cpc === 0) return '--';
  return `$${cpc.toFixed(2)}`;
}

function getOpportunityColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-500';
  return 'text-destructive';
}

export default function KeywordResearchPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState('en');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<KeywordIdea[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [competitionFilter, setCompetitionFilter] = useState<CompetitionLevel | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('seo-keyword-history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const saveHistory = useCallback((entries: SearchHistoryEntry[]) => {
    setHistory(entries);
    try {
      localStorage.setItem('seo-keyword-history', JSON.stringify(entries.slice(0, 20)));
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) {
      toast({ title: 'Please enter a seed keyword', variant: 'destructive' });
      return;
    }
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(`${supabaseUrl}/functions/v1/youtube-keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token || supabaseAnonKey}`,
        },
        body: JSON.stringify({
          keyword: keyword.trim(),
          country,
          language,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const ideas: KeywordIdea[] = (data.keywords || data.results || []).map(
        (k: Record<string, unknown>) => ({
          keyword: String(k.keyword || k.text || ''),
          searchVolume: Number(k.searchVolume ?? k.volume ?? 0),
          competition: (k.competition as CompetitionLevel) || 'Medium',
          cpc: Number(k.cpc ?? 0),
          trendDirection: (k.trendDirection as TrendDirection) || 'stable',
          opportunityScore: Number(k.opportunityScore ?? k.score ?? 50),
        })
      );

      setResults(ideas);
      setHasSearched(true);

      // Save to history
      const entry: SearchHistoryEntry = {
        keyword: keyword.trim(),
        country,
        language,
        resultCount: ideas.length,
        searchedAt: new Date().toISOString(),
      };
      const newHistory = [entry, ...history.filter((h) => h.keyword !== keyword.trim())].slice(0, 20);
      saveHistory(newHistory);

      toast({ title: 'Keywords found', description: `${ideas.length} keyword ideas` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast({ title: 'Search failed', description: msg, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, [keyword, country, language, history, saveHistory, toast]);

  const filteredAndSorted = useMemo(() => {
    let filtered = results.filter((k) => {
      const matchesSearch = !searchQuery || k.keyword.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCompetition = competitionFilter === 'All' || k.competition === competitionFilter;
      return matchesSearch && matchesCompetition;
    });

    const competitionOrder: Record<CompetitionLevel, number> = { Low: 1, Medium: 2, High: 3 };

    filtered = filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'volume':
          cmp = a.searchVolume - b.searchVolume;
          break;
        case 'opportunity':
          cmp = a.opportunityScore - b.opportunityScore;
          break;
        case 'score':
          cmp = a.opportunityScore - b.opportunityScore;
          break;
        case 'competition':
          cmp = competitionOrder[a.competition] - competitionOrder[b.competition];
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return filtered;
  }, [results, searchQuery, competitionFilter, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleExportCSV = useCallback(() => {
    if (!filteredAndSorted.length) return;
    const headers = ['Keyword', 'Search Volume', 'Competition', 'CPC', 'Trend', 'Opportunity Score'];
    const rows = filteredAndSorted.map((k) => [
      k.keyword,
      k.searchVolume,
      k.competition,
      formatCPC(k.cpc),
      k.trendDirection,
      k.opportunityScore,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${keyword.trim().toLowerCase().replace(/\s+/g, '-')}-${country}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: `${filteredAndSorted.length} keywords` });
  }, [filteredAndSorted, keyword, country, toast]);

  const handleSave = useCallback(async () => {
    if (!filteredAndSorted.length) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const inserts = filteredAndSorted.map((k) => ({
        user_id: userId,
        keyword: k.keyword,
        search_volume: k.searchVolume,
        competition: k.competition,
        cpc: k.cpc,
        trend_direction: k.trendDirection,
        opportunity_score: k.opportunityScore,
        country,
        language,
      }));

      const { error: saveError } = await supabase
        .from('seo_saved_keywords')
        .insert(inserts);

      if (saveError) throw saveError;
      toast({ title: 'Keywords saved to Supabase', description: `${inserts.length} keywords saved` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [filteredAndSorted, country, language, toast]);

  const handleHistoryClick = useCallback((entry: SearchHistoryEntry) => {
    setKeyword(entry.keyword);
    setCountry(entry.country);
    setLanguage(entry.language);
  }, []);

  const handleClearHistory = useCallback(() => {
    saveHistory([]);
    toast({ title: 'Search history cleared' });
  }, [saveHistory, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword Research"
        description="Discover YouTube keyword ideas with search volume, competition, and opportunity scores"
      />

      {/* Input form */}
      <Card className="glass p-5">
        <div className="space-y-4">
          <div>
            <Label htmlFor="kw-seed" className="mb-2 block">Seed Keyword</Label>
            <Input
              id="kw-seed"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. react tutorial"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
            className="w-full sm:w-auto"
          >
            {searching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Keywords
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Search History */}
      {history.length > 0 && (
        <Card className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Search History</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearHistory}>
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => handleHistoryClick(entry)}
                className="group flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="font-medium">{entry.keyword}</span>
                <span className="text-muted-foreground">
                  {entry.country} · {entry.resultCount} results
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">Searching for keyword ideas...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzing search volume, competition, and trends for "{keyword}"
                </p>
              </div>
            </Card>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState message={error} onRetry={handleSearch} />
          </motion.div>
        ) : hasSearched && results.length > 0 ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* Toolbar */}
              <Card className="glass p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="font-display text-lg font-semibold">
                      {filteredAndSorted.length} Keyword Ideas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filteredAndSorted.length}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !filteredAndSorted.length}>
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

                {/* Filters */}
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search keywords..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={competitionFilter} onValueChange={(v) => setCompetitionFilter(v as CompetitionLevel | 'All')}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Competition</SelectItem>
                        <SelectItem value="Low">Low Competition</SelectItem>
                        <SelectItem value="Medium">Medium Competition</SelectItem>
                        <SelectItem value="High">High Competition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Keywords Table */}
              <Card className="glass p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[40%]">Keyword</TableHead>
                        <TableHead>
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleSort('volume')}
                          >
                            Volume
                            {sortField === 'volume' && (
                              sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleSort('competition')}
                          >
                            Competition
                            {sortField === 'competition' && (
                              sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>CPC</TableHead>
                        <TableHead>Trend</TableHead>
                        <TableHead>
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleSort('opportunity')}
                          >
                            Opportunity
                            {sortField === 'opportunity' && (
                              sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                            )}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSorted.map((k, i) => (
                        <motion.tr
                          key={`${k.keyword}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.02, 0.5) }}
                          className="group"
                        >
                          <TableCell className="font-medium">{k.keyword}</TableCell>
                          <TableCell className="font-mono text-sm">{formatVolume(k.searchVolume)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('border', COMPETITION_COLORS[k.competition])}>
                              {k.competition}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {formatCPC(k.cpc)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {getTrendIcon(k.trendDirection)}
                              <span className="text-xs capitalize text-muted-foreground">
                                {k.trendDirection}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn('font-display text-sm font-bold', getOpportunityColor(k.opportunityScore))}>
                                {k.opportunityScore}
                              </span>
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    k.opportunityScore >= 80 ? 'bg-success' : k.opportunityScore >= 60 ? 'bg-primary' : k.opportunityScore >= 40 ? 'bg-yellow-500' : 'bg-destructive'
                                  )}
                                  style={{ width: `${k.opportunityScore}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </motion.div>
        ) : hasSearched && results.length === 0 ? (
          <motion.div key="empty-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Search}
              title="No keyword ideas found"
              description="Try a different seed keyword or adjust your country/language settings."
            />
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Search}
              title="No keywords searched yet"
              description="Enter a seed keyword above, select your country and language, then click Search to discover keyword ideas."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
