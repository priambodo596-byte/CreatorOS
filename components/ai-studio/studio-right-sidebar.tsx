'use client';

import {
  Sparkles,
  TrendingUp,
  BookOpen,
  FileText,
  Type,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  Brain,
  Zap,
  PenLine,
  Clapperboard,
  Link2,
  Languages,
  Edit3,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateReadabilityScore,
  calculateSEOScore,
  calculateContentScore,
  estimateVideoDuration,
  countWords,
  countCharacters,
  STUDIO_MODES,
  AI_MODELS,
} from '@/lib/ai-studio-models';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StudioRightSidebarProps {
  content: string;
  title: string;
  mode: string;
  model: string;
}

// --- Helpers ---------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-success';
  if (score >= 40) return 'bg-warning';
  return 'bg-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}

function getScoreRing(score: number): string {
  if (score >= 70) return 'stroke-success';
  if (score >= 40) return 'stroke-warning';
  return 'stroke-destructive';
}

// Circular progress indicator (SVG ring)
function ScoreRing({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: typeof Target;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = getScoreColor(value);
  const ringColor = getScoreRing(value);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-muted/30"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={cn(ringColor, 'transition-all duration-700 ease-out')}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={cn('h-4 w-4', color)} />
          <span className={cn('text-lg font-bold leading-none', color)}>
            {value}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold">{label}</p>
        <p className={cn('text-[10px] font-medium', color)}>
          {getScoreLabel(value)}
        </p>
      </div>
    </div>
  );
}

// --- Mode-specific assistant tips -----------------------------------------

interface ModeTip {
  icon: typeof Target;
  title: string;
  tip: string;
}

const MODE_TIPS: Record<string, ModeTip[]> = {
  chat: [
    { icon: MessageSquare, title: 'Ask Anything', tip: 'Be specific in your prompts for better, more actionable answers.' },
    { icon: Brain, title: 'Iterate', tip: 'Refine answers by asking follow-up questions and requesting examples.' },
  ],
  script: [
    { icon: Zap, title: 'Strong Hooks', tip: 'Use strong hooks in the first 15 seconds. Address the viewer directly.' },
    { icon: PenLine, title: 'Structure', tip: 'Break your script into Hook → Intro → Body → CTA for maximum retention.' },
  ],
  storyboard: [
    { icon: Clapperboard, title: 'Visual Cues', tip: 'Describe each scene with camera angle, lighting, and mood for clear visuals.' },
    { icon: Lightbulb, title: 'Image Prompts', tip: 'Keep AI image prompts concise — one subject, one style, one mood.' },
  ],
  hooks: [
    { icon: Zap, title: 'Curiosity Gap', tip: 'Open with a question or bold claim that creates an information gap.' },
    { icon: Target, title: 'Test Variations', tip: 'Generate 5+ hooks and A/B test them to find your highest-retention opener.' },
  ],
  cta: [
    { icon: Link2, title: 'Be Direct', tip: 'Tell viewers exactly what to do — subscribe, like, comment, or click the link.' },
    { icon: Target, title: 'Mix It Up', tip: 'Combine value CTAs with engagement CTAs to lift both metrics.' },
  ],
  rewrite: [
    { icon: Edit3, title: 'Keep Intent', tip: 'Preserve the core message and SEO keywords when changing tone or length.' },
    { icon: PenLine, title: 'Match Audience', tip: 'Adjust vocabulary and pacing to fit the target audience reading level.' },
  ],
  translate: [
    { icon: Languages, title: 'Localize, Don&apos;t Literal', tip: 'Adapt idioms and humor to the target culture rather than translating word-for-word.' },
    { icon: TrendingUp, title: 'Preserve SEO', tip: 'Keep keyword intent intact — translate the meaning, not just the words.' },
  ],
};

function getTipsForMode(mode: string): ModeTip[] {
  return MODE_TIPS[mode] ?? MODE_TIPS.chat;
}

// --- Prompt variables -----------------------------------------------------

interface PromptVariable {
  token: string;
  label: string;
  description: string;
}

const PROMPT_VARIABLES: PromptVariable[] = [
  { token: '[TOPIC]', label: 'Topic', description: 'Main subject of the video' },
  { token: '[AUDIENCE]', label: 'Audience', description: 'Who the video is for' },
  { token: '[DURATION]', label: 'Duration', description: 'Target video length' },
  { token: '[TONE]', label: 'Tone', description: 'Voice and mood of the script' },
  { token: '[LANGUAGE]', label: 'Language', description: 'Output language' },
  { token: '[KEYWORD]', label: 'Keyword', description: 'SEO target keyword' },
];

// --- Component ------------------------------------------------------------

export function StudioRightSidebar({
  content,
  title,
  mode,
  model,
}: StudioRightSidebarProps) {
  const contentScore = calculateContentScore(content);
  const seoScore = calculateSEOScore(content, title);
  const readabilityScore = calculateReadabilityScore(content);
  const wordCount = countWords(content);
  const charCount = countCharacters(content);
  const videoDuration = estimateVideoDuration(content);

  const modeConfig = STUDIO_MODES.find((m) => m.id === mode);
  const modelConfig = AI_MODELS.find((m) => m.id === model);
  const tips = getTipsForMode(mode);

  const handleInsertVariable = (token: string) => {
    // Insert the variable token at the cursor — parent editor wires this up
    // via clipboard as a lightweight, decoupled mechanism.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {
        /* no-op: clipboard may be unavailable in non-secure contexts */
      });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col">
      <div className="scrollbar-thin h-full overflow-y-auto px-3 py-4">
        <div className="space-y-4">
          {/* ---------------------------------------------------------------- */}
          {/* AI Assistant                                                     */}
          {/* ---------------------------------------------------------------- */}
          <Card className="glass-strong overflow-hidden border-primary/20 p-0">
            <div className="flex items-center gap-2 border-b border-border/40 bg-primary/5 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">AI Assistant</h3>
                <p className="text-[11px] text-muted-foreground">
                  {modeConfig?.label ?? 'AI Chat'} context
                </p>
              </div>
              {modelConfig && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[10px] font-medium"
                >
                  <Brain className="h-3 w-3" />
                  {modelConfig.name}
                </Badge>
              )}
            </div>
            <div className="space-y-2.5 p-4">
              {tips.map((tip) => {
                const TipIcon = tip.icon;
                return (
                  <div
                    key={tip.title}
                    className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-2.5"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <TipIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{tip.title}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {tip.tip}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Score cards                                                      */}
          {/* ---------------------------------------------------------------- */}
          <Card className="glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Content Analysis</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ScoreRing value={contentScore} label="Content" icon={Target} />
              <ScoreRing value={seoScore} label="SEO" icon={TrendingUp} />
              <ScoreRing
                value={readabilityScore}
                label="Readability"
                icon={BookOpen}
              />
            </div>

            {/* Linear progress breakdown */}
            <div className="mt-4 space-y-3">
              <ScoreBar
                icon={Target}
                label="Content Score"
                value={contentScore}
              />
              <ScoreBar
                icon={TrendingUp}
                label="SEO Score"
                value={seoScore}
              />
              <ScoreBar
                icon={BookOpen}
                label="Readability"
                value={readabilityScore}
              />
            </div>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Stats grid                                                       */}
          {/* ---------------------------------------------------------------- */}
          <Card className="glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Statistics</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatTile
                icon={FileText}
                label="Words"
                value={wordCount.toLocaleString()}
              />
              <StatTile
                icon={Type}
                label="Characters"
                value={charCount.toLocaleString()}
              />
              <StatTile
                icon={Clock}
                label="Est. Duration"
                value={videoDuration}
              />
            </div>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Prompt variables                                                 */}
          {/* ---------------------------------------------------------------- */}
          <Card className="glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Prompt Variables</h3>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Click a variable to copy it, then paste it into your prompt.
            </p>
            <div className="flex flex-wrap gap-2">
              {PROMPT_VARIABLES.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  onClick={() => handleInsertVariable(variable.token)}
                  title={variable.description}
                  className={cn(
                    'group inline-flex items-center gap-1.5 rounded-full border border-border/60',
                    'bg-muted/40 px-2.5 py-1 text-xs font-medium transition-all',
                    'hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  )}
                >
                  <span className="font-mono text-[11px] text-primary/80 group-hover:text-primary">
                    {variable.token}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Suggestions                                                      */}
          {/* ---------------------------------------------------------------- */}
          <Card className="glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Suggestions</h3>
            </div>
            <div className="space-y-2">
              <Suggestion
                active={wordCount < 50}
                text="Add more content — aim for at least 50 words for a complete script."
              />
              <Suggestion
                active={seoScore < 40 && wordCount > 0}
                text="Improve SEO: add keywords like &quot;how to&quot;, &quot;best&quot;, or &quot;tutorial&quot;."
              />
              <Suggestion
                active={readabilityScore < 40 && wordCount > 20}
                text="Shorten long sentences to boost readability and viewer retention."
              />
              <Suggestion
                active={wordCount >= 50 && !/(subscribe|like|comment|share)/i.test(content)}
                text="Add a call-to-action (subscribe, like, comment) to drive engagement."
              />
              <Suggestion
                active={wordCount > 0 && title.length > 0 && title.length < 20}
                text="Lengthen your title to 20–70 characters for better SEO performance."
              />
              <Suggestion
                active={wordCount === 0}
                text="Start writing or generate content to see live analysis and tips."
              />
            </div>
          </Card>
        </div>
      </div>
    </aside>
  );
}

// --- Sub-components -------------------------------------------------------

function ScoreBar({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: number;
}) {
  const color = getScoreColor(value);
  const bg = getScoreBg(value);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className={cn('text-xs font-bold', color)}>{value}/100</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', bg)}
          style={{ width: `${Math.max(value, 2)}%` }}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/30 p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-base font-bold leading-none">{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Suggestion({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border p-2.5 transition-colors',
        active
          ? 'border-warning/30 bg-warning/5'
          : 'border-success/20 bg-success/5',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          active
            ? 'bg-warning/15 text-warning'
            : 'bg-success/15 text-success',
        )}
      >
        {active ? (
          <Lightbulb className="h-3 w-3" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
      </div>
      <p
        className={cn(
          'text-[11px] leading-snug',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

export default StudioRightSidebar;
