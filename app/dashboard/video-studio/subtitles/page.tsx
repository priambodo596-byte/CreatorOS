'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Captions,
  Download,
  Copy,
  Check,
  FileText,
  Loader2,
  Youtube,
  AlertCircle,
  Type,
  Palette,
  Sparkles,
  User,
  Clock,
  Languages,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getSyncedVideos, type SyncedVideo } from '@/lib/youtube';
import { generateSubtitles, type SubtitleResult } from '@/lib/video-tools';

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
];

const FONT_FAMILIES = [
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'arial', label: 'Arial' },
  { value: 'helvetica', label: 'Helvetica' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'courier', label: 'Courier New' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'poppins', label: 'Poppins' },
];

const FONT_SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

const ANIMATION_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide Up' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'pop', label: 'Pop' },
  { value: 'karaoke', label: 'Karaoke' },
];

const POSITIONS = [
  { value: 'bottom', label: 'Bottom Center' },
  { value: 'top', label: 'Top Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const EXPORT_FORMATS = [
  { value: 'srt', label: 'SRT', extension: 'srt', mime: 'text/plain' },
  { value: 'vtt', label: 'WebVTT', extension: 'vtt', mime: 'text/vtt' },
  { value: 'burn-in', label: 'Burn-in (MP4)', extension: 'mp4', mime: 'video/mp4' },
] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number]['value'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseSrtSegments(srt: string): { index: number; start: string; end: string; text: string }[] {
  const blocks = srt.trim().split(/\n\s*\n/);
  const segments: { index: number; start: string; end: string; text: string }[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    const index = parseInt(lines[0], 10);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    segments.push({
      index: isNaN(index) ? segments.length + 1 : index,
      start: timeMatch[1],
      end: timeMatch[2],
      text: lines.slice(2).join('\n'),
    });
  }
  return segments;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  icon: React.ElementType;
}

function ToggleSwitch({ checked, onChange, label, description, icon: Icon }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

// ─── Color Picker ────────────────────────────────────────────────────────────

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const COLOR_PRESETS = ['#FFFFFF', '#FFD700', '#00FF00', '#00FFFF', '#FF6B6B', '#A78BFA', '#F472B6', '#000000'];

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`h-7 w-7 rounded-md border transition-transform hover:scale-110 ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'border-border'}`}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SubtitlesPage() {
  const { toast } = useToast();

  // Video state
  const [videos, setVideos] = useState<SyncedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Options
  const [language, setLanguage] = useState('en');
  const [speakerDetection, setSpeakerDetection] = useState(true);
  const [autoTiming, setAutoTiming] = useState(true);

  // Styling
  const [fontFamily, setFontFamily] = useState('inter');
  const [fontSize, setFontSize] = useState('md');
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [bgColor, setBgColor] = useState('#000000');
  const [animationStyle, setAnimationStyle] = useState('fade');
  const [position, setPosition] = useState('bottom');

  // Generation
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SubtitleResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('srt');

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadVideos = useCallback(async () => {
    setLoadingVideos(true);
    setVideosError(null);
    try {
      const data = await getSyncedVideos(50);
      setVideos(data);
    } catch (err) {
      setVideosError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const selectedVideo = videos.find((v) => v.video_id === selectedVideoId) ?? null;

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedVideoId) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateSubtitles({
        videoId: selectedVideoId,
        language,
      });
      setResult(res);
      toast({
        title: 'Subtitles generated',
        description: `${res.segmentCount} segments in ${LANGUAGES.find((l) => l.code === res.language)?.label ?? res.language}`,
      });
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

  const getExportContent = (format: ExportFormat): string => {
    if (!result) return '';
    if (format === 'vtt') return result.vtt;
    return result.srt;
  };

  const handleDownload = (format: ExportFormat) => {
    if (!result) return;
    const fmt = EXPORT_FORMATS.find((f) => f.value === format)!;
    const content = getExportContent(format);
    const blob = new Blob([content], { type: fmt.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedVideo?.title ?? 'subtitles'}.${fmt.extension}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${fmt.label}`, description: `File saved as ${fmt.extension.toUpperCase()}` });
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(getExportContent(exportFormat));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard', description: `${exportFormat.toUpperCase()} format` });
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const segments = result ? parseSrtSegments(result.srt) : [];

  const previewFontClass: Record<string, string> = {
    inter: 'font-sans',
    roboto: 'font-sans',
    arial: 'font-sans',
    helvetica: 'font-sans',
    georgia: 'font-serif',
    courier: 'font-mono',
    montserrat: 'font-sans',
    poppins: 'font-sans',
  };

  const previewSizeClass: Record<string, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const previewPositionClass: Record<string, string> = {
    bottom: 'items-end justify-center',
    top: 'items-start justify-center',
    'bottom-left': 'items-end justify-start',
    'bottom-right': 'items-end justify-end',
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subtitles"
        description="Generate AI-powered subtitles for your synced YouTube videos"
      />

      {/* Top-level states */}
      {loadingVideos ? (
        <LoadingState message="Loading synced videos..." />
      ) : videosError ? (
        <ErrorState message={videosError} onRetry={loadVideos} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Youtube}
          title="No synced videos"
          description="Sync your YouTube channel to generate subtitles for your videos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ═══════════════════════════════════════════════════════════════════════
              LEFT COLUMN — Video selection + Options
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 lg:col-span-7">
            {/* Search + Language */}
            <Card className="glass p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search videos..."
                  />
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full sm:w-48">
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Language" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="mr-2">{lang.flag}</span>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Video grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredVideos.map((video, i) => (
                <motion.button
                  key={video.video_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedVideoId(video.video_id)}
                  className={`text-left transition-all ${
                    selectedVideoId === video.video_id
                      ? 'ring-2 ring-primary'
                      : 'ring-1 ring-transparent hover:ring-muted'
                  }`}
                >
                  <Card className="glass glass-hover overflow-hidden p-0">
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {video.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Youtube className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute right-2 top-2 flex gap-1">
                        <Badge
                          variant={video.caption_status === 'true' ? 'default' : 'secondary'}
                          className="glass text-xs"
                        >
                          {video.caption_status === 'true' ? 'Has Captions' : 'No Captions'}
                        </Badge>
                      </div>
                      {selectedVideoId === video.video_id && (
                        <div className="absolute left-2 top-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {video.view_count.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {video.duration || '—'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.button>
              ))}
            </div>

            {filteredVideos.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No matching videos"
                description="Try a different search term."
              />
            )}

            {/* Options panel */}
            <Card className="glass p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Generation Options</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleSwitch
                  checked={speakerDetection}
                  onChange={setSpeakerDetection}
                  label="Speaker Detection"
                  description="Identify & label different speakers"
                  icon={User}
                />
                <ToggleSwitch
                  checked={autoTiming}
                  onChange={setAutoTiming}
                  label="Auto Timing"
                  description="Automatically align subtitle timing"
                  icon={Clock}
                />
              </div>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              RIGHT COLUMN — Preview + Styling + Export
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 lg:col-span-5">
            <AnimatePresence mode="wait">
              {selectedVideo ? (
                <motion.div
                  key="selected"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Selected video + Generate button */}
                  <Card className="glass p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-semibold line-clamp-2">{selectedVideo.title}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {selectedVideo.caption_status === 'true' ? 'Captions Available' : 'No Captions'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {LANGUAGES.find((l) => l.code === (selectedVideo.default_language || selectedVideo.default_audio_language))?.label
                              ?? selectedVideo.default_language
                              ?? 'Unknown'}
                          </Badge>
                          <span>{selectedVideo.view_count.toLocaleString()} views</span>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleGenerate} disabled={generating} className="mt-4 w-full">
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating subtitles...
                        </>
                      ) : (
                        <>
                          <Captions className="mr-2 h-4 w-4" />
                          Generate Subtitles
                        </>
                      )}
                    </Button>
                  </Card>

                  {/* Generating state */}
                  <AnimatePresence>
                    {generating && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Card className="glass p-8">
                          <div className="flex flex-col items-center justify-center gap-3 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div>
                              <p className="text-sm font-medium">AI is transcribing your video</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Detecting speech, segmenting, and aligning timing...
                              </p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Result */}
                  {result && !generating && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      {/* Segment preview */}
                      <Card className="glass p-5">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <h3 className="font-display text-lg font-semibold">Subtitle Preview</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{result.segmentCount} segments</Badge>
                            <Badge variant="outline">{formatDuration(result.durationSeconds)}</Badge>
                          </div>
                        </div>

                        {/* Video-style preview frame */}
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-900">
                          <div className={`absolute inset-0 flex p-4 ${previewPositionClass[position]}`}>
                            <div
                              className="max-w-[85%] rounded px-2 py-1 text-center"
                              style={{
                                backgroundColor: bgColor === 'transparent' ? 'transparent' : `${bgColor}CC`,
                                color: fontColor,
              }}
                            >
                              <p className={`${previewFontClass[fontFamily] ?? 'font-sans'} ${previewSizeClass[fontSize] ?? 'text-sm'} leading-snug`}>
                                {segments[0]?.text ?? 'Preview subtitle text appears here'}
                              </p>
                            </div>
                          </div>
                          {/* Time badge */}
                          <div className="absolute right-2 top-2">
                            <Badge className="glass text-xs">{segments[0]?.start ?? '00:00:00,000'}</Badge>
                          </div>
                        </div>

                        {/* Segment list */}
                        <ScrollArea className="mt-4 h-48 rounded-lg border border-border bg-muted/20">
                          <div className="p-3 space-y-2">
                            {segments.length === 0 ? (
                              <p className="py-4 text-center text-sm text-muted-foreground">No segments parsed</p>
                            ) : (
                              segments.slice(0, 50).map((seg) => (
                                <div
                                  key={seg.index}
                                  className="flex items-start gap-3 rounded-md border border-border/50 bg-background/40 p-2 transition-colors hover:bg-background/70"
                                >
                                  <Badge variant="outline" className="shrink-0 text-xs">
                                    {seg.index}
                                  </Badge>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-muted-foreground">
                                      {seg.start} → {seg.end}
                                    </p>
                                    <p className="mt-0.5 text-sm">{seg.text}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </Card>

                      {/* Styling controls */}
                      <Card className="glass p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Palette className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Subtitle Styling</h3>
                        </div>
                        <div className="space-y-4">
                          {/* Font family + size */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Type className="h-3 w-3" />
                                Font Family
                              </label>
                              <Select value={fontFamily} onValueChange={setFontFamily}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FONT_FAMILIES.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">Font Size</label>
                              <Select value={fontSize} onValueChange={setFontSize}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FONT_SIZES.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Colors */}
                          <div className="grid grid-cols-2 gap-3">
                            <ColorPicker label="Text Color" value={fontColor} onChange={setFontColor} />
                            <ColorPicker label="Background Color" value={bgColor} onChange={setBgColor} />
                          </div>

                          {/* Animation + Position */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">Animation</label>
                              <Select value={animationStyle} onValueChange={setAnimationStyle}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ANIMATION_STYLES.map((a) => (
                                    <SelectItem key={a.value} value={a.value}>
                                      {a.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">Position</label>
                              <Select value={position} onValueChange={setPosition}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {POSITIONS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Export options */}
                      <Card className="glass p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Download className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Export</h3>
                        </div>

                        {/* Format selector */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Format</label>
                          <div className="grid grid-cols-3 gap-2">
                            {EXPORT_FORMATS.map((fmt) => (
                              <button
                                key={fmt.value}
                                type="button"
                                onClick={() => setExportFormat(fmt.value)}
                                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                                  exportFormat === fmt.value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/30'
                                }`}
                              >
                                <FileText className="h-4 w-4" />
                                <span className="text-xs font-medium">{fmt.label}</span>
                                <span className="text-[10px] opacity-70">.{fmt.extension}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
                            {copied ? (
                              <>
                                <Check className="mr-2 h-3.5 w-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button size="sm" onClick={() => handleDownload(exportFormat)} className="flex-1">
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Download
                          </Button>
                        </div>

                        {exportFormat === 'burn-in' && (
                          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            Burn-in export renders subtitles directly into the video frame. This may take several minutes.
                          </p>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="glass p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Captions className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="mt-4 font-display text-lg font-semibold">Select a video to begin</h3>
                      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                        Choose a synced YouTube video from the grid to generate AI-powered subtitles with customizable styling.
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
