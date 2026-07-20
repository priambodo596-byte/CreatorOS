'use client';

import * as React from 'react';
import {
  Sparkles,
  Square,
  ArrowRight,
  Thermometer,
  Zap,
  Globe,
  Users,
  Mic,
  Cpu,
  ChevronDown,
  Brain,
  Clapperboard,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { AI_MODELS, TONES, TARGET_AUDIENCES, SCRIPT_LANGUAGES } from '@/lib/ai-studio-models';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface StudioBottomToolbarProps {
  model: string;
  setModel: (m: string) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  creativity: number;
  setCreativity: (c: number) => void;
  language: string;
  setLanguage: (l: string) => void;
  tone: string;
  setTone: (t: string) => void;
  audience: string;
  setAudience: (a: string) => void;
  onGenerate: () => void;
  onStop: () => void;
  onContinue: () => void;
  isGenerating: boolean;
  canContinue: boolean;
  canGenerate: boolean;
}

// Map the string icon names stored on AIModel to actual lucide components.
const MODEL_ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  brain: Brain,
  clapperboard: Clapperboard,
  video: Video,
};

function getModelIcon(iconName: string): LucideIcon {
  return MODEL_ICON_MAP[iconName] ?? Cpu;
}

// Small labelled wrapper used for each control cluster inside the toolbar.
function ToolbarControl({
  label,
  tooltip,
  children,
  className,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5 transition-colors hover:border-border/70',
            className,
          )}
        >
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// Compact slider shown inside a popover for temperature / creativity.
function CompactSliderControl({
  label,
  icon: Icon,
  value,
  onChange,
  tooltip,
  accentClass,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  onChange: (v: number) => void;
  tooltip: string;
  accentClass: string;
}) {
  // Slider works in 0-100 integer space; the underlying model value is 0.0-1.0.
  const sliderValue = Math.round(value * 100);
  const displayValue = value.toFixed(2);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 flex-col gap-1 rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5 text-left transition-colors hover:border-border/70"
            >
              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', accentClass)} />
                {displayValue}
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={8}
        className="w-56 rounded-xl glass-strong p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
            {displayValue}
          </span>
        </div>
        <Slider
          value={[sliderValue]}
          min={0}
          max={100}
          step={1}
          onValueChange={(vals) => {
            const next = vals[0] ?? 0;
            onChange(next / 100);
          }}
          className="py-2"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>0.00</span>
          <span>0.50</span>
          <span>1.00</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StudioBottomToolbar({
  model,
  setModel,
  temperature,
  setTemperature,
  creativity,
  setCreativity,
  language,
  setLanguage,
  tone,
  setTone,
  audience,
  setAudience,
  onGenerate,
  onStop,
  onContinue,
  isGenerating,
  canContinue,
  canGenerate,
}: StudioBottomToolbarProps) {
  const selectedModel = React.useMemo(
    () => AI_MODELS.find((m) => m.id === model) ?? AI_MODELS[0],
    [model],
  );
  const SelectedModelIcon = getModelIcon(selectedModel.icon);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-3 sm:px-4 sm:pb-4">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-5xl',
            'rounded-2xl border border-border/50 glass-strong shadow-2xl shadow-black/20',
            'flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:gap-2.5 sm:p-3',
          )}
        >
          {/* AI Model Selector */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-2.5 py-2 transition-colors hover:border-border/70"
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        selectedModel.bg,
                      )}
                    >
                      <SelectedModelIcon className={cn('h-4 w-4', selectedModel.color)} />
                    </span>
                    <span className="flex min-w-0 flex-col text-left">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Model
                      </span>
                      <span className="truncate text-xs font-semibold text-foreground">
                        {selectedModel.name}
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Choose the AI model used for generation
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-80 rounded-xl glass-strong p-2"
            >
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                AI Models
              </div>
              <div className="flex flex-col gap-1">
                {AI_MODELS.map((m) => {
                  const Icon = getModelIcon(m.icon);
                  const isActive = m.id === model;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                        isActive
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-transparent hover:bg-accent/50',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          m.bg,
                        )}
                      >
                        <Icon className={cn('h-4 w-4', m.color)} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">
                            {m.name}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                            {m.provider}
                          </span>
                        </span>
                        <span className="text-[11px] leading-snug text-muted-foreground">
                          {m.description}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {m.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                            >
                              {cap}
                            </span>
                          ))}
                        </span>
                      </span>
                      {isActive && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider (desktop) */}
          <div className="hidden h-10 w-px shrink-0 bg-border/40 sm:block" />

          {/* Temperature + Creativity sliders */}
          <CompactSliderControl
            label="Temp"
            icon={Thermometer}
            value={temperature}
            onChange={setTemperature}
            tooltip="Temperature controls randomness. Lower = focused & deterministic, higher = creative & varied."
            accentClass="bg-orange-400"
          />
          <CompactSliderControl
            label="Creativity"
            icon={Zap}
            value={creativity}
            onChange={setCreativity}
            tooltip="Creativity controls how imaginative the output is. Lower = safe & literal, higher = bold & inventive."
            accentClass="bg-fuchsia-400"
          />

          {/* Divider (desktop) */}
          <div className="hidden h-10 w-px shrink-0 bg-border/40 sm:block" />

          {/* Language */}
          <ToolbarControl
            label="Language"
            tooltip="Output language for the generated script or content"
            className="flex-1 sm:flex-none sm:w-32"
          >
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-7 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none focus:ring-0 [&>svg]:hidden">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Language" />
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {SCRIPT_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ToolbarControl>

          {/* Tone */}
          <ToolbarControl
            label="Tone"
            tooltip="Voice & emotional style of the generated content"
            className="flex-1 sm:flex-none sm:w-32"
          >
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-7 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none focus:ring-0 [&>svg]:hidden">
                <span className="flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Tone" />
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TONES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ToolbarControl>

          {/* Audience */}
          <ToolbarControl
            label="Audience"
            tooltip="Target audience the content should be optimized for"
            className="flex-1 sm:flex-none sm:w-32"
          >
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="h-7 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none focus:ring-0 [&>svg]:hidden">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Audience" />
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TARGET_AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a} className="text-xs">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ToolbarControl>

          {/* Spacer pushes action buttons to the right on desktop */}
          <div className="hidden flex-1 sm:block" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isGenerating && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={onStop}
                    variant="destructive"
                    size="sm"
                    className="h-9 rounded-xl px-3 text-xs font-semibold shadow-md"
                  >
                    <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    Stop
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Stop the current generation
                </TooltipContent>
              </Tooltip>
            )}

            {canContinue && !isGenerating && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={onContinue}
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-border/60 bg-background/60 px-3 text-xs font-semibold backdrop-blur"
                  >
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                    Continue
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Continue generating from where it stopped
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canGenerate || isGenerating}
                  size="sm"
                  className={cn(
                    'h-9 rounded-xl bg-gradient-to-r from-primary via-primary to-accent px-4 text-xs font-bold text-white shadow-lg shadow-primary/30 transition-all',
                    'hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:shadow-none',
                  )}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isGenerating
                  ? 'Generation in progress…'
                  : canGenerate
                    ? 'Generate content with the current settings'
                    : 'Enter a prompt or content first to enable generation'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default StudioBottomToolbar;
