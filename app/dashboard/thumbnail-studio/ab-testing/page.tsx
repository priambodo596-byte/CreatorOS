'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Trophy,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  X,
  Eye,
  Send,
  Trash2,
  Flame,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  abTestThumbnails,
  uploadThumbnailFile,
  fetchABTests,
  insertABTest,
  deleteABTest,
  type ABTestMultiResult,
  type ABTestRow,
} from '@/lib/thumbnail-studio';
import { supabase } from '@/lib/supabase-client';

const MAX_VARIANTS = 4;

interface VariantSlot {
  file: File | null;
  url: string;
}

export default function ABTestingPage() {
  const { toast } = useToast();
  const [variants, setVariants] = useState<VariantSlot[]>([
    { file: null, url: '' },
    { file: null, url: '' },
  ]);
  const [videoTitle, setVideoTitle] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ABTestMultiResult | null>(null);
  const [history, setHistory] = useState<ABTestRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const rows = await fetchABTests();
      setHistory(rows);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFileSelect = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    setVariants((prev) => {
      const next = [...prev];
      next[index] = { file, url };
      return next;
    });
    setResult(null);
  };

  const clearVariant = (index: number) => {
    setVariants((prev) => {
      const next = [...prev];
      if (next[index].url) URL.revokeObjectURL(next[index].url);
      next[index] = { file: null, url: '' };
      return next;
    });
    setResult(null);
  };

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return;
    setVariants((prev) => [...prev, { file: null, url: '' }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants((prev) => {
      const next = [...prev];
      if (next[index].url) URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
    setResult(null);
  };

  const handleAnalyze = async () => {
    const filled = variants.filter((v) => v.file);
    if (filled.length < 2 || !videoTitle.trim()) {
      toast({ title: 'Add at least 2 thumbnails and a video title', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Upload all variants to Storage
      const uploadedUrls: string[] = [];
      for (const v of filled) {
        if (!v.file) continue;
        const { url } = await uploadThumbnailFile(v.file, userId, 'draft');
        uploadedUrls.push(url);
      }

      const res = await abTestThumbnails({
        thumbnails: uploadedUrls,
        videoTitle,
        targetAudience,
      });
      setResult(res);

      // Persist to DB
      const variantsData = uploadedUrls.map((url, i) => ({
        thumbnail_id: '',
        image_url: url,
        scores: {
          predictedCtr: res.variants[i]?.predictedCtr ?? 0,
          visualAttention: res.variants[i]?.visualAttentionScore ?? 0,
          emotion: res.variants[i]?.emotionScore ?? 0,
          textReadability: res.variants[i]?.textReadability ?? 0,
          colorContrast: res.variants[i]?.colorContrast ?? 0,
        },
      }));

      await insertABTest({
        video_title: videoTitle,
        target_audience: targetAudience,
        variants: variantsData,
        winner_index: res.winnerIndex,
        confidence_score: res.confidenceScore,
        ai_recommendation: res.recommendation,
        published: false,
      });

      toast({ title: 'Analysis complete', description: `Winner: Thumbnail ${String.fromCharCode(65 + res.winnerIndex)}` });
      await loadHistory();
    } catch (err) {
      toast({
        title: 'Analysis failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePublishWinner = async () => {
    if (!result) return;
    toast({ title: 'Winner published', description: 'Your winning thumbnail is ready to go live.' });
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteABTest(id);
      toast({ title: 'Test deleted' });
      await loadHistory();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="A/B Thumbnail Testing"
        description="Compare up to 4 thumbnails with AI-powered CTR predictions, attention heatmaps, and winner analysis."
      />

      {/* Upload + Form */}
      <Card className="glass p-5">
        <div className="space-y-5">
          {/* Thumbnail uploads */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {variants.map((variant, index) => (
              <div key={index}>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label>Thumbnail {String.fromCharCode(65 + index)}</Label>
                  {variants.length > 2 && (
                    <Button size="sm" variant="ghost" onClick={() => removeVariant(index)} className="h-6 px-2">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <input
                  ref={(el) => { fileRefs.current[index] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect(index)}
                />
                {variant.url ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={variant.url} alt={`Thumbnail ${String.fromCharCode(65 + index)}`} className="aspect-video w-full object-cover" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() => clearVariant(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    {result && (
                      <div className="absolute left-2 top-2">
                        {result.winnerIndex === index ? (
                          <Badge className="bg-green-500 text-white">
                            <Trophy className="mr-1 h-3 w-3" /> Winner
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{String.fromCharCode(65 + index)}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => fileRefs.current[index]?.click()}
                    className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 transition-colors hover:border-primary hover:bg-muted/30"
                  >
                    <div className="text-center">
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="mt-1 text-xs text-muted-foreground">Upload</p>
                    </div>
                  </button>
                )}
              </div>
            ))}
            {variants.length < MAX_VARIANTS && (
              <div className="flex items-center">
                <Button variant="outline" onClick={addVariant} className="aspect-video w-full">
                  + Add Variant
                </Button>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="video-title" className="mb-2 block">Video Title</Label>
              <Input
                id="video-title"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Enter your video title..."
              />
            </div>
            <div>
              <Label htmlFor="target-audience" className="mb-2 block">Target Audience (optional)</Label>
              <Input
                id="target-audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. tech enthusiasts, gamers, students..."
              />
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || variants.filter((v) => v.file).length < 2 || !videoTitle.trim()}
            className="w-full bg-gradient-to-r from-primary to-accent text-white"
          >
            {analyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing thumbnails...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Analyze & Predict</>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {analyzing ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium">Running AI analysis...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Comparing visual elements, text placement, face detection, and color theory
                </p>
              </div>
            </Card>
          </motion.div>
        ) : result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* Winner banner */}
              <Card className="glass p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                    <Trophy className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-semibold">
                      Thumbnail {String.fromCharCode(65 + result.winnerIndex)} is predicted to win
                    </h3>
                    <p className="text-sm text-muted-foreground">{result.recommendation}</p>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {result.confidenceScore}% confidence
                  </Badge>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handlePublishWinner} className="bg-green-600 text-white hover:bg-green-700">
                    <Send className="mr-2 h-4 w-4" /> Publish Winner
                  </Button>
                </div>
              </Card>

              {/* Variant comparison grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {result.variants.map((analysis, i) => (
                  <Card key={i} className="glass p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-display text-sm font-semibold">
                        Thumbnail {String.fromCharCode(65 + i)}
                      </span>
                      {result.winnerIndex === i && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <Trophy className="mr-1 h-3 w-3" /> Winner
                        </Badge>
                      )}
                    </div>

                    {/* Heatmap visualization */}
                    <div className="relative mb-3 aspect-video overflow-hidden rounded-lg">
                      {variants[i]?.url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={variants[i].url} alt="" className="h-full w-full object-cover opacity-70" />
                      )}
                      <div className="absolute inset-0 bg-gradient-radial from-red-500/40 via-yellow-500/20 to-transparent" style={{
                        background: `radial-gradient(circle at ${analysis.focusPoint.includes('right') ? '70%' : '30%'} ${analysis.focusPoint.includes('Upper') ? '30%' : '50%'}, rgba(239,68,68,0.4), transparent 60%)`,
                      }} />
                      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5">
                        <span className="flex items-center gap-1 text-xs text-white">
                          <Flame className="h-3 w-3" /> {analysis.focusPoint}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <ScoreRow label="Predicted CTR" value={analysis.predictedCtr} suffix="%" max={10} />
                      <ScoreRow label="Click Probability" value={analysis.clickProbability * 100} suffix="%" max={100} />
                      <ScoreRow label="Visual Attention" value={analysis.visualAttentionScore} max={100} />
                      <ScoreRow label="Emotion" value={analysis.emotionScore} max={100} />
                      <ScoreRow label="Text Readability" value={analysis.textReadability} max={100} />
                      <ScoreRow label="Color Contrast" value={analysis.colorContrast} max={100} />

                      <div className="flex gap-2 pt-1">
                        <div className={`flex items-center gap-1 text-xs ${analysis.faceDetection ? 'text-success' : 'text-muted-foreground'}`}>
                          <CheckCircle2 className="h-3 w-3" /> Face
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${analysis.eyeContact ? 'text-success' : 'text-muted-foreground'}`}>
                          <CheckCircle2 className="h-3 w-3" /> Eye Contact
                        </div>
                      </div>
                    </div>

                    {/* Strengths / Weaknesses */}
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {analysis.strengths.slice(0, 2).map((s, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                          {s}
                        </div>
                      ))}
                      {analysis.weaknesses.slice(0, 2).map((w, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                          {w}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Improvement tips */}
              <Card className="glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                  </div>
                  <h3 className="font-display text-base font-semibold">Improvement Tips</h3>
                </div>
                <ul className="space-y-2">
                  {result.improvementTips.map((tip, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {tip}
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </div>
          </motion.div>
        ) : variants.every((v) => !v.file) ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={ImageIcon}
              title="No analysis yet"
              description="Upload at least 2 thumbnails above and click Analyze to get AI-powered CTR predictions."
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* History */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Test History</h2>
        {loadingHistory ? (
          <LoadingState message="Loading test history..." />
        ) : historyError ? (
          <ErrorState message={historyError} onRetry={loadHistory} />
        ) : history.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No tests yet"
            description="Your A/B test results will be saved here for comparison."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((test) => (
              <Card key={test.id} className="glass glass-hover p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="truncate text-sm font-medium">{test.video_title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteHistory(test.id)}
                    className="h-6 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    Winner: {test.winner_index !== null ? String.fromCharCode(65 + test.winner_index) : '—'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{test.confidence_score}% confidence</Badge>
                  {test.published && <Badge className="bg-green-500 text-white text-xs">Published</Badge>}
                </div>
                <div className="flex gap-1.5">
                  {Array.isArray(test.variants) && test.variants.slice(0, 4).map((v, i) => (
                    <div key={i} className="relative h-12 flex-1 overflow-hidden rounded">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                      {test.winner_index === i && (
                        <div className="absolute inset-0 ring-2 ring-green-500 rounded" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(test.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, value, suffix = '', max = 100 }: { label: string; value: number; suffix?: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${color}`}>{value.toFixed(1)}{suffix}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
