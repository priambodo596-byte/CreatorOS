'use client';

import * as React from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Copy,
  RefreshCw,
  Save,
  Sparkles,
  Zap,
  Link as LinkIcon,
  Languages,
  Edit3,
  Clapperboard,
  PenLine,
  MessageSquare,
  Check,
  FileText,
  Camera,
  Video,
  Type,
  Music,
  ArrowRight,
  TrendingUp,
  Heart,
  ThumbsUp,
  MessageCircle,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

import {
  StudioMode,
  ChatMessage,
  REWRITE_STYLES,
  TRANSLATE_LANGUAGES,
  TONES,
  TARGET_AUDIENCES,
  SCRIPT_LANGUAGES,
} from '@/lib/ai-studio-models';
import {
  generateScript,
  generateStoryboard,
  generateHooks,
  generateCTAs,
  rewriteScript,
  translateScript,
  copyToClipboard,
  type ScriptGeneration,
  type StoryboardResult,
  type StoryboardScene,
  type HookResult,
  type HookVariation,
  type CTAResult,
  type CTAVariation,
  type CTAType,
  type RewriteResult,
  type TranslationResult,
} from '@/lib/ai-studio';
import { LoadingState, ErrorState, EmptyState } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Shared Props ────────────────────────────────────────────────────────────

export interface ModePanelProps {
  mode: StudioMode;
  content: string;
  setContent: (c: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  // Chat-specific
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  // Shared settings
  model: string;
  language: string;
  tone: string;
  audience: string;
  temperature: number;
}

// ─── Tiny Markdown renderer (regex-based, safe for AI output) ─────────────────

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (!line.trim()) {
      out.push(<br key={`br-${i}`} />);
      return;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level <= 1
          ? 'text-xl font-bold'
          : level === 2
            ? 'text-lg font-bold'
            : 'text-base font-semibold';
      out.push(
        <div key={`h-${i}`} className={cn('mt-2 mb-1', cls)}>
          {inlineFormat(h[2])}
        </div>,
      );
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      out.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground"
        >
          {inlineFormat(line.slice(2))}
        </blockquote>,
      );
      return;
    }

    // List items
    if (/^\s*[-*]\s+/.test(line)) {
      out.push(
        <div key={`li-${i}`} className="ml-4 flex gap-1.5">
          <span className="text-muted-foreground">•</span>
          <span>{inlineFormat(line.replace(/^\s*[-*]\s+/, ''))}</span>
        </div>,
      );
      return;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const m = line.match(/^\s*(\d+)\.\s+(.*)$/);
      out.push(
        <div key={`ol-${i}`} className="ml-4 flex gap-1.5">
          <span className="font-medium text-muted-foreground">{m?.[1]}.</span>
          <span>{inlineFormat(m?.[2] ?? '')}</span>
        </div>,
      );
      return;
    }

    // Paragraph
    out.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {inlineFormat(line)}
      </p>,
    );
  });

  return out;
}

function inlineFormat(text: string): React.ReactNode {
  // Handle bold, italic, inline code, links
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  const patterns: { re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }[] = [
    {
      re: /\*\*(.+?)\*\*/,
      render: (m) => <strong key={`b-${key++}`}>{m[1]}</strong>,
    },
    {
      re: /`([^`]+)`/,
      render: (m) => (
        <code key={`c-${key++}`} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
          {m[1]}
        </code>
      ),
    },
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a key={`l-${key++}`} href={m[2]} target="_blank" rel="noreferrer" className="text-primary underline">
          {m[1]}
        </a>
      ),
    },
    {
      re: /\*(.+?)\*/,
      render: (m) => <em key={`i-${key++}`}>{m[1]}</em>,
    },
  ];

  while (rest.length) {
    let earliest: { idx: number; match: RegExpExecArray; render: (m: RegExpExecArray) => React.ReactNode } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, match: m, render: p.render };
      }
    }
    if (!earliest) {
      parts.push(rest);
      break;
    }
    if (earliest.idx > 0) parts.push(rest.slice(0, earliest.idx));
    parts.push(earliest.render(earliest.match));
    rest = rest.slice(earliest.idx + earliest.match[0].length);
  }

  return parts;
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function ScoreBar({ value, label, color = 'bg-primary' }: { value: number; label: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <Card className="glass p-4">{children}</Card>;
}

// ─── 1. ChatPanel ─────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  onSendMessage,
  isGenerating,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
}) {
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSendMessage(trimmed);
    setInput('');
  };

  return (
    <PanelShell>
      <Card className="glass flex h-[60vh] min-h-[400px] flex-col p-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !isGenerating && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquare className="mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs">Ask anything — ideas, scripts, analysis, code.</p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground',
                )}
              >
                <div className="prose-sm">{renderMarkdown(m.content)}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.attachments.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        <FileText className="mr-1 h-3 w-3" />
                        {a.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' && (
                  <div className="mt-2 flex gap-1 border-t border-border/30 pt-1.5">
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                      <Copy className="mr-1 h-3 w-3" /> Copy
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                      <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                      <ArrowRight className="mr-1 h-3 w-3" /> Continue
                    </Button>
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <MessageSquare className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
              </div>
              <div className="rounded-2xl bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border/40 p-3">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" title="Attach file">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="shrink-0" title="Voice input">
              <Mic className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              className="min-h-[44px] flex-1 resize-none"
              rows={1}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isGenerating} className="shrink-0">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Card>
    </PanelShell>
  );
}

// ─── 2. ScriptPanel ──────────────────────────────────────────────────────────

function ScriptPanel({
  content,
  setContent,
  model,
  language: langProp,
  tone: toneProp,
  audience: audienceProp,
}: {
  content: string;
  setContent: (c: string) => void;
  model: string;
  language: string;
  tone: string;
  audience: string;
}) {
  const { toast } = useToast();
  const [keyword, setKeyword] = React.useState('');
  const [audience, setAudience] = React.useState(audienceProp || TARGET_AUDIENCES[0]);
  const [duration, setDuration] = React.useState(5);
  const [language, setLanguage] = React.useState(langProp || 'en');
  const [tone, setTone] = React.useState(toneProp || TONES[0]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScriptGeneration | null>(null);

  const handleGenerate = async () => {
    if (!keyword.trim()) {
      toast({ title: 'Keyword required', description: 'Enter a topic keyword first.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateScript({
        keyword,
        audience,
        durationMinutes: duration,
        language,
      });
      setResult(res);
      setContent(res.content);
      toast({ title: 'Script generated', description: res.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Keyword / Topic</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. productivity tips" />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Duration</Label>
              <Badge variant="secondary">{duration} min</Badge>
            </div>
            <Slider value={[duration]} min={1} max={30} step={1} onValueChange={(v) => setDuration(v[0] ?? 5)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate Script
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Generating script…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={PenLine} title="No script yet" description="Fill the form and generate a script." />
      )}

      {result && !loading && (
        <Card className="glass space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold">{result.title}</h3>
            <div className="flex gap-1">
              <CopyButton text={result.content} />
              <Button variant="ghost" size="sm"><Save className="h-3.5 w-3.5" /> Save</Button>
              <Button variant="ghost" size="sm" onClick={handleGenerate}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Hook</div>
            <p className="text-sm font-medium">{result.hook}</p>
          </div>

          <div className="prose-sm text-sm">{renderMarkdown(result.content)}</div>

          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Call to Action</div>
            <p className="text-sm font-medium">{result.cta}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">~{result.estimatedWordCount} words</Badge>
            <Badge variant="secondary">{result.estimatedReadTime}</Badge>
            <Badge variant="secondary">{model}</Badge>
          </div>
        </Card>
      )}
    </PanelShell>
  );
}

// ─── 3. StoryboardPanel ──────────────────────────────────────────────────────

function StoryboardPanel({ content, setContent }: { content: string; setContent: (c: string) => void }) {
  const { toast } = useToast();
  const [script, setScript] = React.useState(content || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<StoryboardResult | null>(null);

  const handleGenerate = async () => {
    if (!script.trim()) {
      toast({ title: 'Script required', description: 'Paste a script to storyboard.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateStoryboard(script);
      setResult(res);
      setContent(JSON.stringify(res, null, 2));
      toast({ title: 'Storyboard created', description: `${res.metadata.sceneCount} scenes` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="space-y-2">
          <Label>Script</Label>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your script here…"
            rows={6}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
            Generate Storyboard
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Building storyboard…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={Clapperboard} title="No storyboard yet" description="Paste a script and generate scenes." />
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.scenes.map((scene: StoryboardScene, i) => (
            <Card key={i} className="glass space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="default">Scene {scene.sceneNumber}</Badge>
                <div className="flex gap-1">
                  <CopyButton
                    text={`Scene ${scene.sceneNumber}\nVisual: ${scene.visualSuggestion}\nCamera: ${scene.cameraAngle ?? ''}\nVO: ${scene.dialogue}\nDuration: ${scene.duration}`}
                    label=""
                  />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Camera className="h-3 w-3" /> Visual
                  </div>
                  <p>{scene.visualSuggestion}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Video className="h-3 w-3" /> Camera
                  </div>
                  <p>{scene.cameraAngle ?? '—'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Type className="h-3 w-3" /> Voice Over
                  </div>
                  <p>{scene.dialogue}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary"><Music className="mr-1 h-3 w-3" />{scene.duration}</Badge>
                  {scene.notes && <Badge variant="outline">{scene.notes}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ─── 4. HookPanel ────────────────────────────────────────────────────────────

function HookPanel({ content, setContent }: { content: string; setContent: (c: string) => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = React.useState('');
  const [count, setCount] = React.useState(5);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<HookResult | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a video topic.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateHooks(topic, count);
      setResult(res);
      setContent(res.hooks.map((h) => h.text).join('\n'));
      toast({ title: 'Hooks generated', description: `${res.hooks.length} hooks` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. morning routines" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Count</Label>
              <Badge variant="secondary">{count} hooks</Badge>
            </div>
            <Slider value={[count]} min={1} max={10} step={1} onValueChange={(v) => setCount(v[0] ?? 5)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Generate Hooks
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Generating hooks…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={Zap} title="No hooks yet" description="Enter a topic and generate viral hooks." />
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.hooks.map((h: HookVariation) => (
            <Card key={h.id} className="glass space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-sm font-medium">{h.text}</p>
                <CopyButton text={h.text} label="" />
              </div>
              <Badge variant="secondary">{h.type}</Badge>
              <ScoreBar value={h.engagementScore} label="Click Probability" color="bg-accent" />
              <ScoreBar value={Math.round(h.engagementScore * 0.85)} label="Est. Retention" color="bg-success" />
              {h.reasoning && <p className="text-xs text-muted-foreground">{h.reasoning}</p>}
            </Card>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ─── 5. CTAPanel ─────────────────────────────────────────────────────────────

const CTA_TYPES: { value: CTAType; label: string; icon: React.ElementType }[] = [
  { value: 'subscribe', label: 'Subscribe', icon: ThumbsUp },
  { value: 'like', label: 'Like', icon: Heart },
  { value: 'comment', label: 'Comment', icon: MessageCircle },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'custom', label: 'Custom', icon: Sparkles },
];

function CTAPanel({ content, setContent }: { content: string; setContent: (c: string) => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = React.useState('');
  const [ctaType, setCtaType] = React.useState<CTAType>('subscribe');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CTAResult | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({ title: 'Topic required', description: 'Enter a video topic.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateCTAs(topic, ctaType);
      setResult(res);
      setContent(res.ctas.map((c) => c.text).join('\n'));
      toast({ title: 'CTAs generated', description: `${res.ctas.length} variations` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. channel about cooking" />
          </div>
          <div className="space-y-2">
            <Label>CTA Type</Label>
            <Select value={ctaType} onValueChange={(v) => setCtaType(v as CTAType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Generate CTAs
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Generating CTAs…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={LinkIcon} title="No CTAs yet" description="Enter a topic and generate CTAs." />
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.ctas.map((c: CTAVariation) => {
            const typeMeta = CTA_TYPES.find((t) => t.value === c.type);
            const Icon = typeMeta?.icon ?? LinkIcon;
            return (
              <Card key={c.id} className="glass space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm font-medium">{c.text}</p>
                  <CopyButton text={c.text} label="" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary"><Icon className="mr-1 h-3 w-3" />{c.type}</Badge>
                  <Badge variant="outline">{c.placement}</Badge>
                </div>
                <ScoreBar value={c.engagementScore} label="Engagement Score" color="bg-info" />
                {c.reasoning && <p className="text-xs text-muted-foreground">{c.reasoning}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

// ─── 6. RewritePanel ─────────────────────────────────────────────────────────

function RewritePanel({ content, setContent, tone: toneProp }: { content: string; setContent: (c: string) => void; tone: string }) {
  const { toast } = useToast();
  const [original, setOriginal] = React.useState(content || '');
  const [style, setStyle] = React.useState(REWRITE_STYLES[0].value);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RewriteResult | null>(null);

  const handleGenerate = async () => {
    if (!original.trim()) {
      toast({ title: 'Script required', description: 'Paste a script to rewrite.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await rewriteScript(original, toneProp || 'Casual', style);
      setResult(res);
      setContent(res.content);
      toast({ title: 'Rewrite complete', description: `${res.metadata.rewrittenLength} chars` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Original Script</Label>
            <Textarea value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="Paste your script…" rows={6} />
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REWRITE_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} — {s.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
            Rewrite Script
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Rewriting…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={Edit3} title="No rewrite yet" description="Paste a script and choose a style." />
      )}

      {result && !loading && (
        <Card className="glass space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold">Rewritten</h3>
            <div className="flex gap-1">
              <CopyButton text={result.content} />
              <Button variant="ghost" size="sm"><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original ({result.metadata.originalLength} chars)</div>
            <p className="line-clamp-3 text-sm text-muted-foreground">{original}</p>
          </div>

          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">Rewritten ({result.metadata.rewrittenLength} chars)</div>
            <div className="prose-sm text-sm">{renderMarkdown(result.content)}</div>
          </div>

          {result.changes.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes</div>
              <ul className="space-y-1">
                {result.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </PanelShell>
  );
}

// ─── 7. TranslatePanel ───────────────────────────────────────────────────────

function TranslatePanel({ content, setContent }: { content: string; setContent: (c: string) => void }) {
  const { toast } = useToast();
  const [script, setScript] = React.useState(content || '');
  const [target, setTarget] = React.useState('id');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TranslationResult | null>(null);

  const handleGenerate = async () => {
    if (!script.trim()) {
      toast({ title: 'Script required', description: 'Paste a script to translate.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await translateScript(script, target);
      setResult(res);
      setContent(res.content);
      const langLabel = TRANSLATE_LANGUAGES.find((l) => l.value === target)?.label ?? target;
      toast({ title: 'Translated', description: `→ ${langLabel}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelShell>
      <FormCard>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Script</Label>
            <Textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste your script…" rows={6} />
          </div>
          <div className="space-y-2">
            <Label>Target Language</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSLATE_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.flag} {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
            Translate
          </Button>
        </div>
      </FormCard>

      {loading && <LoadingState message="Translating…" />}
      {error && <ErrorState message={error} onRetry={handleGenerate} />}
      {!loading && !error && !result && (
        <EmptyState icon={Languages} title="No translation yet" description="Paste a script and pick a language." />
      )}

      {result && !loading && (
        <Card className="glass space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold">
              {TRANSLATE_LANGUAGES.find((l) => l.value === result.targetLanguage)?.flag} Translation
            </h3>
            <CopyButton text={result.content} />
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original</div>
            <p className="line-clamp-3 text-sm text-muted-foreground">{script}</p>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Translated</div>
            <div className="prose-sm text-sm">{renderMarkdown(result.content)}</div>
          </div>

          {result.notes.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Translation Notes</div>
              <ul className="space-y-1">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{result.metadata.originalLength} → {result.metadata.translatedLength} chars</Badge>
          </div>
        </Card>
      )}
    </PanelShell>
  );
}

// ─── ModePanel switcher ─────────────────────────────────────────────────────

export function ModePanel(props: ModePanelProps) {
  const { mode } = props;

  switch (mode) {
    case 'chat':
      return <ChatPanel messages={props.messages} onSendMessage={props.onSendMessage} isGenerating={props.isGenerating} />;
    case 'script':
      return (
        <ScriptPanel
          content={props.content}
          setContent={props.setContent}
          model={props.model}
          language={props.language}
          tone={props.tone}
          audience={props.audience}
        />
      );
    case 'storyboard':
      return <StoryboardPanel content={props.content} setContent={props.setContent} />;
    case 'hooks':
      return <HookPanel content={props.content} setContent={props.setContent} />;
    case 'cta':
      return <CTAPanel content={props.content} setContent={props.setContent} />;
    case 'rewrite':
      return <RewritePanel content={props.content} setContent={props.setContent} tone={props.tone} />;
    case 'translate':
      return <TranslatePanel content={props.content} setContent={props.setContent} />;
    default:
      return (
        <EmptyState
          icon={Inbox}
          title="Unknown mode"
          description={`Mode "${mode}" is not supported.`}
        />
      );
  }
}

export default ModePanel;
