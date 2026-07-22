"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  ArrowRight,
  Youtube,
  Video,
  Image,
  FileText,
  Layers,
  Search,
  PenLine,
  Layout,
  ThumbsUp,
  Send,
  AlertTriangle,
  Sparkles,
  Hash,
  Tag,
  Clock,
  Globe,
  Eye,
  ListMusic,
  Play,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useNewVideoWizard,
  WIZARD_STEPS,
  STEP_LABELS,
  type WizardStep,
  type ProjectData,
  type ResearchData,
  type ScriptData,
  type StoryboardData,
  type StoryboardScene,
  type VideoData,
  type ThumbnailData,
  type SeoData,
  type ReviewData,
  type PublishData,
} from "@/hooks/use-new-video-wizard";
import {
  listCategories,
  listPlaylists,
  type ContentCategory,
  type ContentPlaylist,
} from "@/lib/content";
import {
  generateScript,
  generateStoryboard,
  generateHooks,
  generateCTAs,
} from "@/lib/ai-studio";
import { generateTitles, generateTags } from "@/lib/seo-tools";
import { generateThumbnails } from "@/lib/thumbnail-studio";
import { getConnection } from "@/lib/youtube";
import {
  fetchTrendingVideos,
  fetchKeywordSuggestions,
  type TrendingVideo,
  type KeywordSuggestion,
} from "@/lib/youtube-research";
import { cn } from "@/lib/utils";

// ─── Step Icon Map ───────────────────────────────────────────────────────────

const STEP_ICONS: Record<WizardStep, typeof FileText> = {
  project: FileText,
  research: Search,
  script: PenLine,
  storyboard: Layout,
  video: Video,
  thumbnail: Image,
  seo: Hash,
  review: CheckCircle2,
  publish: Send,
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface NewVideoWizardProps {
  onClose: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NewVideoWizard({ onClose }: NewVideoWizardProps) {
  const wizard = useNewVideoWizard(true, onClose);
  const { toast } = useToast();
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [playlists, setPlaylists] = useState<ContentPlaylist[]>([]);
  const [ytConnected, setYtConnected] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
    listPlaylists()
      .then(setPlaylists)
      .catch(() => {});
    getConnection()
      .then((c) => setYtConnected(!!c))
      .catch(() => {});
  }, []);

  if (!wizard.open) return null;

  const { state, currentStepLabel } = wizard;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4 glass-strong">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Youtube className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-sm font-bold">
            New Video{" "}
            <span className="text-muted-foreground font-normal">
              · {currentStepLabel}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.lastSaved && (
            <span className="hidden text-xs text-muted-foreground md:block">
              Saved {new Date(state.lastSaved).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={wizard.saveToDatabase}
            disabled={state.saving}
          >
            {state.saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={wizard.closeWizard}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ─── Progress Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border/30 px-4 py-3 overflow-x-auto scrollbar-thin">
        {WIZARD_STEPS.map((step, idx) => {
          const Icon = STEP_ICONS[step];
          const isComplete = wizard.isStepComplete(idx);
          const isCurrent = wizard.isStepCurrent(idx);
          const canNavigate =
            isComplete || isCurrent || idx <= state.currentStep;

          return (
            <button
              key={step}
              onClick={() => canNavigate && wizard.goToStep(idx)}
              disabled={!canNavigate}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shrink-0",
                isCurrent && "bg-primary/10 text-primary",
                isComplete && !isCurrent && "text-success",
                !isComplete && !isCurrent && "text-muted-foreground/50",
                canNavigate && "hover:bg-muted/50"
              )}
            >
              {isComplete ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
              {idx < WIZARD_STEPS.length - 1 && (
                <ChevronRight className="ml-1 h-3 w-3 text-muted-foreground/30" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Content Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {state.currentStep === 0 && (
                <StepProject
                  data={state.project}
                  onChange={wizard.setProject}
                  categories={categories}
                  ytConnected={ytConnected}
                  onNext={wizard.nextStep}
                />
              )}
              {state.currentStep === 1 && (
                <StepResearch
                  data={state.research}
                  onChange={wizard.setResearch}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                />
              )}
              {state.currentStep === 2 && (
                <StepScript
                  data={state.script}
                  onChange={wizard.setScript}
                  projectName={state.project.name}
                  targetAudience={state.project.target_audience}
                  language={state.project.language}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  setGenerating={setGenerating}
                />
              )}
              {state.currentStep === 3 && (
                <StepStoryboard
                  data={state.storyboard}
                  onChange={wizard.setStoryboard}
                  scriptContent={state.script.script_content}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  setGenerating={setGenerating}
                />
              )}
              {state.currentStep === 4 && (
                <StepVideo
                  data={state.video}
                  onChange={wizard.setVideo}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  uploadFile={wizard.uploadFile}
                />
              )}
              {state.currentStep === 5 && (
                <StepThumbnail
                  data={state.thumbnail}
                  onChange={wizard.setThumbnail}
                  projectName={state.project.name}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  setGenerating={setGenerating}
                  uploadFile={wizard.uploadFile}
                />
              )}
              {state.currentStep === 6 && (
                <StepSeo
                  data={state.seo}
                  onChange={wizard.setSeo}
                  projectName={state.project.name}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  setGenerating={setGenerating}
                />
              )}
              {state.currentStep === 7 && (
                <StepReview
                  state={state}
                  onNext={wizard.nextStep}
                  onBack={wizard.prevStep}
                  onChangeReview={wizard.setReview}
                />
              )}
              {state.currentStep === 8 && (
                <StepPublish
                  data={state.publish}
                  onChange={wizard.setPublish}
                  projectName={state.project.name}
                  playlists={playlists}
                  categories={categories}
                  ytConnected={ytConnected}
                  onNext={() => {
                    wizard.saveToDatabase();
                    wizard.closeWizard();
                  }}
                  onBack={wizard.prevStep}
                  uploadFile={wizard.uploadFile}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Bottom Bar ───────────────────────────────────────────────────── */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-border/50 px-4 glass-strong">
        <Button
          variant="ghost"
          size="sm"
          onClick={wizard.discardWizard}
          className="text-muted-foreground"
        >
          <X className="mr-1.5 h-4 w-4" /> Discard
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {state.currentStep + 1} of {WIZARD_STEPS.length}
          </span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: PROJECT
// ═══════════════════════════════════════════════════════════════════════════════

function StepProject({
  data,
  onChange,
  categories,
  ytConnected,
  onNext,
}: {
  data: ProjectData;
  onChange: (d: Partial<ProjectData>) => void;
  categories: ContentCategory[];
  ytConnected: boolean;
  onNext: () => void;
}) {
  const canProceed = data.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Project Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your new video project.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Project Name *</Label>
            <Input
              value={data.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Ultimate AI Tutorial 2025"
            />
          </div>
          <div>
            <Label>YouTube Channel</Label>
            <Select
              value={data.channel_name}
              onValueChange={(v) => onChange({ channel_name: v })}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={ytConnected ? "Select channel" : "Not connected"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Channel</SelectItem>
                {!ytConnected && (
                  <SelectItem value="disconnected" disabled>
                    Connect YouTube first
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {!ytConnected && (
              <p className="mt-1 text-xs text-warning">
                Connect YouTube in Settings Integrations
              </p>
            )}
          </div>
          <div>
            <Label>Content Type</Label>
            <Select
              value={data.content_type}
              onValueChange={(v) => onChange({ content_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="post">Post</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={data.language}
              onValueChange={(v) => onChange({ language: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Indonesian</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={data.category_id}
              onValueChange={(v) => onChange({ category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={data.status}
              onValueChange={(v) =>
                onChange({ status: v as ProjectData["status"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Target Audience</Label>
            <Input
              value={data.target_audience}
              onChange={(e) => onChange({ target_audience: e.target.value })}
              placeholder="e.g. Beginner AI developers, content creators"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Research <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

function StepResearch({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: ResearchData;
  onChange: (d: Partial<ResearchData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [topicInput, setTopicInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [trending, setTrending] = useState<TrendingVideo[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [showTrending, setShowTrending] = useState(false);

  const [keywordSeed, setKeywordSeed] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordSuggestion[]>([]);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordError, setKeywordError] = useState<string | null>(null);

  const loadTrending = async () => {
    setShowTrending(true);
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const result = await fetchTrendingVideos();
      setTrending(result.videos.slice(0, 12));
    } catch (err) {
      setTrendingError(
        err instanceof Error ? err.message : "Failed to load trending videos"
      );
    } finally {
      setTrendingLoading(false);
    }
  };

  const searchKeywords = async () => {
    if (!keywordSeed.trim()) return;
    setKeywordLoading(true);
    setKeywordError(null);
    try {
      const result = await fetchKeywordSuggestions(keywordSeed.trim());
      setKeywordResults(result.suggestions.slice(0, 10));
    } catch (err) {
      setKeywordError(
        err instanceof Error ? err.message : "Failed to fetch keyword suggestions"
      );
    } finally {
      setKeywordLoading(false);
    }
  };

  const addTopic = () => {
    if (
      topicInput.trim() &&
      !data.selected_topics.includes(topicInput.trim())
    ) {
      onChange({
        selected_topics: [...data.selected_topics, topicInput.trim()],
      });
      setTopicInput("");
    }
  };

  const addKeyword = () => {
    if (
      keywordInput.trim() &&
      !data.selected_keywords.includes(keywordInput.trim())
    ) {
      onChange({
        selected_keywords: [...data.selected_keywords, keywordInput.trim()],
      });
      setKeywordInput("");
    }
  };

  const removeTopic = (t: string) => {
    onChange({ selected_topics: data.selected_topics.filter((x) => x !== t) });
  };

  const removeKeyword = (k: string) => {
    onChange({
      selected_keywords: data.selected_keywords.filter((x) => x !== k),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Research</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select trending topics, keywords, and competitor insights.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <Label>Trending Topics</Label>
            <Button variant="outline" size="sm" onClick={loadTrending} disabled={trendingLoading}>
              {trendingLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Browse Trending
            </Button>
          </div>

          {showTrending && (
            <div className="mt-2 rounded-lg glass p-3">
              {trendingLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : trendingError ? (
                <p className="py-3 text-center text-xs text-destructive">{trendingError}</p>
              ) : trending.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">No trending videos found.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {trending.map((v) => {
                    const selected = data.selected_topics.includes(v.title);
                    return (
                      <button
                        key={v.videoId}
                        onClick={() =>
                          selected ? removeTopic(v.title) : onChange({ selected_topics: [...data.selected_topics, v.title] })
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                          selected ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/30"
                        )}
                      >
                        <div className="h-9 w-16 shrink-0 overflow-hidden rounded bg-muted">
                          {v.thumbnail && <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{v.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {v.viewCount.toLocaleString()} views · viral {v.viralScore}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-1.5 flex gap-2">
            <Input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Add a topic..."
              onKeyDown={(e) => e.key === "Enter" && addTopic()}
            />
            <Button variant="outline" size="sm" onClick={addTopic}>
              Add
            </Button>
          </div>
          {data.selected_topics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.selected_topics.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeTopic(t)}
                >
                  {t} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between">
            <Label>Keywords</Label>
          </div>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={keywordSeed}
              onChange={(e) => setKeywordSeed(e.target.value)}
              placeholder="Seed keyword to research..."
              onKeyDown={(e) => e.key === "Enter" && searchKeywords()}
            />
            <Button variant="outline" size="sm" onClick={searchKeywords} disabled={keywordLoading}>
              {keywordLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Research
            </Button>
          </div>

          {keywordError && <p className="mt-2 text-xs text-destructive">{keywordError}</p>}

          {keywordResults.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {keywordResults.map((k) => {
                const selected = data.selected_keywords.includes(k.keyword);
                return (
                  <button
                    key={k.keyword}
                    onClick={() =>
                      selected
                        ? removeKeyword(k.keyword)
                        : onChange({ selected_keywords: [...data.selected_keywords, k.keyword] })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:bg-muted/30"
                    )}
                  >
                    {k.keyword} <span className="text-muted-foreground">· vol {k.searchVolume}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Add a keyword manually..."
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            />
            <Button variant="outline" size="sm" onClick={addKeyword}>
              Add
            </Button>
          </div>
          {data.selected_keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.selected_keywords.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => removeKeyword(k)}
                >
                  {k} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label>Competitor Insights</Label>
          <Textarea
            value={data.competitor_insights}
            onChange={(e) => onChange({ competitor_insights: e.target.value })}
            rows={3}
            placeholder="What are competitors doing? Any gaps you spotted?"
          />
        </div>

        <div>
          <Label>Viral Score Notes</Label>
          <Textarea
            value={data.viral_score_notes}
            onChange={(e) => onChange({ viral_score_notes: e.target.value })}
            rows={2}
            placeholder="Any viral trends or patterns to leverage?"
          />
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Script <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: AI SCRIPT
// ═══════════════════════════════════════════════════════════════════════════════

function StepScript({
  data,
  onChange,
  projectName,
  targetAudience,
  language,
  onNext,
  onBack,
  setGenerating,
}: {
  data: ScriptData;
  onChange: (d: Partial<ScriptData>) => void;
  projectName: string;
  targetAudience: string;
  language: string;
  onNext: () => void;
  onBack: () => void;
  setGenerating: (v: string | null) => void;
}) {
  const [hookInput, setHookInput] = useState("");
  const [ctaInput, setCtaInput] = useState("");

  const handleGenerateScript = async () => {
    if (!projectName) return;
    setGenerating("script");
    try {
      const result = await generateScript({
        keyword: projectName,
        audience: targetAudience || "general",
        durationMinutes: 5,
        language,
      });
      onChange({
        script_content: result.content,
        hook: result.hook,
        cta: result.cta,
      });
    } catch {
      // fallback - user can type manually
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">AI Script</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and edit your video script.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div className="flex items-center justify-between">
          <Label>Script Content</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateScript}
            disabled={!projectName}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Generate with AI
          </Button>
        </div>
        <Textarea
          value={data.script_content}
          onChange={(e) => onChange({ script_content: e.target.value })}
          rows={12}
          placeholder="Write or generate your script here..."
          className="font-mono text-sm"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Hook</Label>
            <Input
              value={data.hook}
              onChange={(e) => onChange({ hook: e.target.value })}
              placeholder="Opening hook"
            />
          </div>
          <div>
            <Label>CTA</Label>
            <Input
              value={data.cta}
              onChange={(e) => onChange({ cta: e.target.value })}
              placeholder="Call to action"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Storyboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4: STORYBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function StepStoryboard({
  data,
  onChange,
  scriptContent,
  onNext,
  onBack,
  setGenerating,
}: {
  data: StoryboardData;
  onChange: (d: Partial<StoryboardData>) => void;
  scriptContent: string;
  onNext: () => void;
  onBack: () => void;
  setGenerating: (v: string | null) => void;
}) {
  const handleGenerate = async () => {
    if (!scriptContent) return;
    setGenerating("storyboard");
    try {
      const result = await generateStoryboard(scriptContent);
      onChange({ scenes: result.scenes });
    } catch {
      // fallback
    } finally {
      setGenerating(null);
    }
  };

  const updateScene = (idx: number, scene: Partial<StoryboardScene>) => {
    const newScenes = [...data.scenes];
    newScenes[idx] = { ...newScenes[idx], ...scene };
    onChange({ scenes: newScenes });
  };

  const addScene = () => {
    onChange({
      scenes: [
        ...data.scenes,
        {
          sceneNumber: data.scenes.length + 1,
          description: "",
          visualSuggestion: "",
          dialogue: "",
          duration: "30s",
        },
      ],
    });
  };

  const removeScene = (idx: number) => {
    onChange({ scenes: data.scenes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Storyboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan your video scene by scene.
        </p>
      </div>

      <Card className="glass p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Label>Scenes ({data.scenes.length})</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addScene}>
              + Add Scene
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={!scriptContent}
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> Generate
            </Button>
          </div>
        </div>

        {data.scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Layers className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No scenes yet. Generate from script or add manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.scenes.map((scene, idx) => (
              <Card key={idx} className="glass p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Scene {idx + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive"
                    onClick={() => removeScene(idx)}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={scene.description}
                      onChange={(e) =>
                        updateScene(idx, { description: e.target.value })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Visual Suggestion</Label>
                    <Textarea
                      value={scene.visualSuggestion}
                      onChange={(e) =>
                        updateScene(idx, { visualSuggestion: e.target.value })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Dialogue</Label>
                    <Textarea
                      value={scene.dialogue}
                      onChange={(e) =>
                        updateScene(idx, { dialogue: e.target.value })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Video Production <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 5: VIDEO PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════════

function StepVideo({
  data,
  onChange,
  onNext,
  onBack,
  uploadFile,
}: {
  data: VideoData;
  onChange: (d: Partial<VideoData>) => void;
  onNext: () => void;
  onBack: () => void;
  uploadFile: (
    file: File,
    subdir: string
  ) => Promise<{ url: string; path: string } | null>;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadFile(file, "videos");
    if (result) {
      onChange({
        video_url: result.url,
        video_storage_path: result.path,
        render_status: "completed",
      });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Video Production</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload or import your video.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        {data.video_url ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-success/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm font-medium">
                Video uploaded successfully
              </span>
            </div>
            <div className="aspect-video rounded-lg bg-muted overflow-hidden">
              <video
                src={data.video_url}
                controls
                className="h-full w-full object-contain"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  video_url: null,
                  video_storage_path: null,
                  render_status: "pending",
                })
              }
            >
              Remove Video
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
              <Video className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Upload Video</p>
              <p className="mt-1 text-xs text-muted-foreground">
                MP4, MOV, or AVI. Max 2GB.
              </p>
              <label className="mt-4 cursor-pointer">
                <Button variant="default" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Select File"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
            </div>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Subtitles</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Checkbox
                checked={data.has_subtitles}
                onCheckedChange={(v) =>
                  onChange({ has_subtitles: v as boolean })
                }
              />
              <span className="text-sm">Generate subtitles</span>
            </div>
          </div>
          <div>
            <Label>Voice Over</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Checkbox
                checked={data.has_voiceover}
                onCheckedChange={(v) =>
                  onChange({ has_voiceover: v as boolean })
                }
              />
              <span className="text-sm">Add voice over</span>
            </div>
          </div>
        </div>

        <div>
          <Label>Video Duration</Label>
          <Input
            value={data.video_duration}
            onChange={(e) => onChange({ video_duration: e.target.value })}
            placeholder="e.g. 5:30"
          />
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Thumbnail <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 6: THUMBNAIL
// ═══════════════════════════════════════════════════════════════════════════════

function StepThumbnail({
  data,
  onChange,
  projectName,
  onNext,
  onBack,
  setGenerating,
  uploadFile,
}: {
  data: ThumbnailData;
  onChange: (d: Partial<ThumbnailData>) => void;
  projectName: string;
  onNext: () => void;
  onBack: () => void;
  setGenerating: (v: string | null) => void;
  uploadFile: (
    file: File,
    subdir: string
  ) => Promise<{ url: string; path: string } | null>;
}) {
  const handleGenerate = async () => {
    if (!projectName) return;
    setGenerating("thumbnail");
    try {
      const result = await generateThumbnails({ title: projectName });
      onChange({
        alt_thumbnails: result.variations.map((v) => ({
          url: v.imageUrl,
          score: v.visualScore,
        })),
        thumbnail_url: result.variations[0]?.imageUrl || null,
        thumbnail_score: result.variations[0]?.visualScore || 0,
      });
    } catch {
      // fallback
    } finally {
      setGenerating(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file, "thumbnails");
    if (result) {
      onChange({
        thumbnail_url: result.url,
        thumbnail_storage_path: result.path,
      });
    }
  };

  const selectThumbnail = (url: string, score: number) => {
    onChange({ thumbnail_url: url, thumbnail_score: score });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Thumbnail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate or upload your video thumbnail.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={!projectName}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Generate with AI
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>Upload Thumbnail</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>

        {data.thumbnail_url && (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={data.thumbnail_url}
              alt="Selected thumbnail"
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-2 top-2">
              Score: {data.thumbnail_score}/100
            </Badge>
          </div>
        )}

        {data.alt_thumbnails.length > 0 && (
          <>
            <Label>Alternatives</Label>
            <div className="grid grid-cols-3 gap-3">
              {data.alt_thumbnails.map((t, i) => (
                <button
                  key={i}
                  onClick={() => selectThumbnail(t.url, t.score)}
                  className={cn(
                    "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                    data.thumbnail_url === t.url
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  <img
                    src={t.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <Badge
                    variant="secondary"
                    className="absolute left-1 bottom-1 text-xs"
                  >
                    {t.score}
                  </Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: SEO <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 7: SEO
// ═══════════════════════════════════════════════════════════════════════════════

function StepSeo({
  data,
  onChange,
  projectName,
  onNext,
  onBack,
  setGenerating,
}: {
  data: SeoData;
  onChange: (d: Partial<SeoData>) => void;
  projectName: string;
  onNext: () => void;
  onBack: () => void;
  setGenerating: (v: string | null) => void;
}) {
  const [tagInput, setTagInput] = useState("");

  const handleGenerateTitles = async () => {
    if (!projectName) return;
    setGenerating("titles");
    try {
      const result = await generateTitles({
        keyword: projectName,
        videoTopic: projectName,
      });
      if (result.titles.length > 0) {
        onChange({
          title: result.titles[0].title,
          seo_score: result.titles[0].seoScore,
        });
      }
    } catch {
      // fallback
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateTags = async () => {
    if (!projectName) return;
    setGenerating("tags");
    try {
      const result = await generateTags({
        keyword: projectName,
        videoTitle: data.title || projectName,
      });
      onChange({ tags: result.tags.map((t) => t.tag).slice(0, 10) });
    } catch {
      // fallback
    } finally {
      setGenerating(null);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !data.tags.includes(tagInput.trim())) {
      onChange({ tags: [...data.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (t: string) => {
    onChange({ tags: data.tags.filter((x) => x !== t) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">SEO Optimization</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optimize your video for search.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label>Title</Label>
            <Input
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Video title for SEO"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-3 mt-5"
            onClick={handleGenerateTitles}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Generate
          </Button>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={4}
            placeholder="Video description..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>Tags</Label>
            <Button variant="outline" size="sm" onClick={handleGenerateTags}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Generate Tags
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag..."
              onKeyDown={(e) => e.key === "Enter" && addTag()}
            />
            <Button variant="outline" size="sm" onClick={addTag}>
              Add
            </Button>
          </div>
          {data.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.tags.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => removeTag(t)}
                >
                  {t} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Hashtags (comma separated)</Label>
            <Input
              value={data.hashtags.join(", ")}
              onChange={(e) =>
                onChange({
                  hashtags: e.target.value
                    .split(",")
                    .map((h) => h.trim())
                    .filter(Boolean),
                })
              }
              placeholder="#ai, #tutorial"
            />
          </div>
          <div>
            <Label>Chapters</Label>
            <Input
              value={data.chapters}
              onChange={(e) => onChange({ chapters: e.target.value })}
              placeholder="0:00 - Intro, 1:30 - Main"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg glass p-3">
          <span className="text-sm font-medium">SEO Score</span>
          <Badge
            variant={
              data.seo_score >= 70
                ? "default"
                : data.seo_score >= 40
                ? "secondary"
                : "outline"
            }
          >
            {data.seo_score || 0}/100
          </Badge>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Review <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 8: REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function StepReview({
  state,
  onNext,
  onBack,
  onChangeReview,
}: {
  state: {
    project: ProjectData;
    seo: SeoData;
    thumbnail: ThumbnailData;
    video: VideoData;
    script: ScriptData;
  };
  onNext: () => void;
  onBack: () => void;
  onChangeReview: (d: Partial<ReviewData>) => void;
}) {
  const checklistItems = [
    {
      key: "video" as const,
      label: "Video uploaded",
      done: !!state.video.video_url,
    },
    {
      key: "thumbnail" as const,
      label: "Thumbnail selected",
      done: !!state.thumbnail.thumbnail_url,
    },
    {
      key: "seo" as const,
      label: "SEO metadata filled",
      done: !!state.seo.title && state.seo.tags.length > 0,
    },
    {
      key: "subtitle" as const,
      label: "Subtitles",
      done: state.video.has_subtitles,
    },
    {
      key: "voiceover" as const,
      label: "Voice Over",
      done: state.video.has_voiceover,
    },
  ];

  const allChecked = checklistItems.every((item) => item.done);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review everything before publishing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Video Preview */}
        <Card className="glass overflow-hidden p-0">
          <div className="aspect-video bg-muted flex items-center justify-center">
            {state.video.video_url ? (
              <video
                src={state.video.video_url}
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <Video className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
        </Card>

        {/* Details */}
        <Card className="glass p-5 space-y-3">
          <div>
            <p className="text-sm font-medium">{state.project.name}</p>
            <p className="text-xs text-muted-foreground">
              {state.project.content_type} · {state.project.language}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-sm">
              {state.seo.description || "No description"}
            </p>
          </div>
          {state.seo.tags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {state.seo.tags.slice(0, 5).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">SEO Score</span>
            <Badge
              variant={state.seo.seo_score >= 70 ? "default" : "secondary"}
            >
              {state.seo.seo_score}/100
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Thumbnail Score</span>
            <Badge
              variant={
                state.thumbnail.thumbnail_score >= 70 ? "default" : "secondary"
              }
            >
              {state.thumbnail.thumbnail_score}/100
            </Badge>
          </div>
        </Card>
      </div>

      {/* Checklist */}
      <Card className="glass p-5">
        <h3 className="mb-3 text-sm font-semibold">Publishing Checklist</h3>
        <div className="space-y-2">
          {checklistItems.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Checkbox checked={item.done} disabled />
              <span
                className={cn(
                  "text-sm",
                  item.done ? "text-success" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
              {item.done && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!allChecked}>
          Next: Publish <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 9: PUBLISH
// ═══════════════════════════════════════════════════════════════════════════════

function StepPublish({
  data,
  onChange,
  projectName,
  playlists,
  categories,
  ytConnected,
  onNext,
  onBack,
  uploadFile,
}: {
  data: PublishData;
  onChange: (d: Partial<PublishData>) => void;
  projectName: string;
  playlists: ContentPlaylist[];
  categories: ContentCategory[];
  ytConnected: boolean;
  onNext: () => void;
  onBack: () => void;
  uploadFile: (
    file: File,
    subdir: string
  ) => Promise<{ url: string; path: string } | null>;
}) {
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    onChange({ published: true });
    // Simulate publish delay
    await new Promise((r) => setTimeout(r, 1000));
    setPublishing(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Publish</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set publishing options and go live.
        </p>
      </div>

      <Card className="glass p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <Select
              value={data.visibility}
              onValueChange={(v) =>
                onChange({ visibility: v as PublishData["visibility"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Playlist</Label>
            <Select
              value={data.playlist_id}
              onValueChange={(v) => onChange({ playlist_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {playlists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={data.category_id}
              onValueChange={(v) => onChange({ category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={data.language}
              onValueChange={(v) => onChange({ language: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Indonesian</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>License</Label>
            <Select
              value={data.license}
              onValueChange={(v) => onChange({ license: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">Standard YouTube</SelectItem>
                <SelectItem value="creative_commons">
                  Creative Commons
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Schedule (optional)</Label>
            <Input
              type="datetime-local"
              value={data.scheduled_at}
              onChange={(e) => onChange({ scheduled_at: e.target.value })}
            />
          </div>
        </div>

        <Separator />

        {!ytConnected && (
          <div className="flex items-center gap-3 rounded-lg bg-warning/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-warning">
              Connect YouTube in Settings to publish directly.
            </span>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handlePublish}
          disabled={publishing}
          className="bg-gradient-to-r from-primary to-accent text-white"
        >
          {publishing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {publishing ? "Publishing..." : "Publish Now"}
        </Button>
      </div>
    </div>
  );
}
