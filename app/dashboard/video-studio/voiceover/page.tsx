'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Play,
  Pause,
  Download,
  Loader2,
  Volume2,
  AudioLines,
  Sparkles,
  Upload,
  Copy,
  Trash2,
  Clock,
  Type,
  Music,
  Waves,
  User,
  Languages,
  Smile,
  Zap,
} from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateVoiceover, type VoiceoverResult } from '@/lib/video-tools';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  icon: typeof Mic;
  accent: string;
}

interface VoiceModelOption {
  value: string;
  label: string;
  description: string;
}

interface LanguageOption {
  value: string;
  label: string;
  flag: string;
}

interface EmotionOption {
  value: string;
  label: string;
  icon: typeof Smile;
  color: string;
}

interface HistoryItem {
  id: string;
  text: string;
  provider: string;
  voiceModel: string;
  language: string;
  emotion: string;
  speed: number;
  pitch: number;
  result: VoiceoverResult;
  createdAt: number;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const PROVIDERS: ProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI TTS',
    description: 'High-quality natural voices with fast generation. Great for narration and explainer videos.',
    icon: Sparkles,
    accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Ultra-realistic expressive voices with emotion control. Best for cinematic and dramatic content.',
    icon: AudioLines,
    accent: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30',
  },
  {
    id: 'google',
    name: 'Google TTS',
    description: 'Wide language support with WaveNet neural voices. Ideal for multi-language content.',
    icon: Waves,
    accent: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  },
];

const VOICE_MODELS_BY_PROVIDER: Record<string, VoiceModelOption[]> = {
  openai: [
    { value: 'tts-1-alloy', label: 'Alloy', description: 'Balanced, neutral tone' },
    { value: 'tts-1-echo', label: 'Echo', description: 'Warm, conversational male' },
    { value: 'tts-1-fable', label: 'Fable', description: 'Expressive, storytelling' },
    { value: 'tts-1-onyx', label: 'Onyx', description: 'Deep, authoritative male' },
    { value: 'tts-1-nova', label: 'Nova', description: 'Bright, energetic female' },
    { value: 'tts-1-shimmer', label: 'Shimmer', description: 'Soft, gentle female' },
  ],
  elevenlabs: [
    { value: 'eleven_multilingual_v2-rachel', label: 'Rachel', description: 'Calm, professional female' },
    { value: 'eleven_multilingual_v2-domi', label: 'Domi', description: 'Strong, confident female' },
    { value: 'eleven_multilingual_v2-bella', label: 'Bella', description: 'Soft, friendly female' },
    { value: 'eleven_multilingual_v2-antoni', label: 'Antoni', description: 'Smooth, versatile male' },
    { value: 'eleven_multilingual_v2-josh', label: 'Josh', description: 'Deep, documentary male' },
    { value: 'eleven_multilingual_v2-arnold', label: 'Arnold', description: 'Powerful, energetic male' },
    { value: 'eleven_multilingual_v2-adam', label: 'Adam', description: 'Deep, narration male' },
    { value: 'eleven_multilingual_v2-sam', label: 'Sam', description: 'Young, casual male' },
  ],
  google: [
    { value: 'en-US-Standard-A', label: 'EN-US Standard A', description: 'Male, standard quality' },
    { value: 'en-US-Standard-B', label: 'EN-US Standard B', description: 'Male, natural quality' },
    { value: 'en-US-Standard-C', label: 'EN-US Standard C', description: 'Female, standard quality' },
    { value: 'en-US-Standard-D', label: 'EN-US Standard D', description: 'Female, natural quality' },
    { value: 'en-US-Wavenet-A', label: 'EN-US WaveNet A', description: 'Male, premium neural' },
    { value: 'en-US-Wavenet-C', label: 'EN-US WaveNet C', description: 'Female, premium neural' },
    { value: 'en-US-Wavenet-D', label: 'EN-US WaveNet D', description: 'Male, premium neural' },
    { value: 'en-US-Neural2-A', label: 'EN-US Neural2 A', description: 'Male, studio quality' },
    { value: 'en-US-Neural2-C', label: 'EN-US Neural2 C', description: 'Female, studio quality' },
  ],
};

const LANGUAGES: LanguageOption[] = [
  { value: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { value: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { value: 'en-AU', label: 'English (AU)', flag: '🇦🇺' },
  { value: 'es-ES', label: 'Spanish (Spain)', flag: '🇪🇸' },
  { value: 'es-MX', label: 'Spanish (Mexico)', flag: '🇲🇽' },
  { value: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { value: 'de-DE', label: 'German', flag: '🇩🇪' },
  { value: 'it-IT', label: 'Italian', flag: '🇮🇹' },
  { value: 'pt-BR', label: 'Portuguese (BR)', flag: '🇧🇷' },
  { value: 'nl-NL', label: 'Dutch', flag: '🇳🇱' },
  { value: 'ru-RU', label: 'Russian', flag: '🇷🇺' },
  { value: 'ja-JP', label: 'Japanese', flag: '🇯🇵' },
  { value: 'ko-KR', label: 'Korean', flag: '🇰🇷' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { value: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { value: 'ar-SA', label: 'Arabic', flag: '🇸🇦' },
];

const EMOTIONS: EmotionOption[] = [
  { value: 'neutral', label: 'Neutral', icon: Smile, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  { value: 'happy', label: 'Happy', icon: Smile, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'sad', label: 'Sad', icon: Smile, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'excited', label: 'Excited', icon: Zap, color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { value: 'calm', label: 'Calm', icon: Waves, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { value: 'dramatic', label: 'Dramatic', icon: AudioLines, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'whisper', label: 'Whisper', icon: User, color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getProviderName(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

function getVoiceLabel(provider: string, value: string): string {
  return VOICE_MODELS_BY_PROVIDER[provider]?.find((v) => v.value === value)?.label ?? value;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceoverPage() {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Script + provider
  const [text, setText] = useState('');
  const [provider, setProvider] = useState('openai');
  const [voiceModel, setVoiceModel] = useState('tts-1-alloy');
  const [language, setLanguage] = useState('en-US');
  const [emotion, setEmotion] = useState('neutral');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceoverResult | null>(null);

  // Audio player
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Voice clone
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Derived
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.ceil((wordCount / (2.5 * speed)) || 0);
  const availableVoices = VOICE_MODELS_BY_PROVIDER[provider] ?? [];
  const charCount = text.length;
  const maxChars = 5000;

  // ─── Provider change resets voice model ──────────────────────────────────
  const handleProviderChange = (id: string) => {
    setProvider(id);
    const voices = VOICE_MODELS_BY_PROVIDER[id];
    if (voices && voices.length > 0) {
      setVoiceModel(voices[0].value);
    }
  };

  // ─── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: 'Please enter script text', variant: 'destructive' });
      return;
    }
    if (charCount > maxChars) {
      toast({ title: `Script exceeds ${maxChars} character limit`, variant: 'destructive' });
      return;
    }

    setGenerating(true);
    setError(null);
    stopAudio();

    try {
      const res = await generateVoiceover({
        text,
        voiceModel,
        speed,
        pitch,
      });
      setResult(res);
      setProgress(0);

      const historyItem: HistoryItem = {
        id: `${Date.now()}`,
        text,
        provider,
        voiceModel,
        language,
        emotion,
        speed,
        pitch,
        result: res,
        createdAt: Date.now(),
      };
      setHistory((prev) => [historyItem, ...prev].slice(0, 20));

      toast({
        title: 'Voiceover generated',
        description: `${res.durationSeconds}s · ${getVoiceLabel(provider, voiceModel)}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Audio playback ────────────────────────────────────────────────────────
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
  };

  const togglePlay = () => {
    if (!result) return;

    if (!audioRef.current) {
      const el = new Audio(result.audioUrl);
      el.addEventListener('timeupdate', () => {
        const pct = el.duration ? (el.currentTime / el.duration) * 100 : 0;
        setProgress(pct);
      });
      el.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
      });
      el.play().catch(() => {
        toast({ title: 'Failed to play audio', variant: 'destructive' });
      });
      audioRef.current = el;
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.audioUrl;
    a.download = `voiceover-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Download started' });
  };

  const handleCopyScript = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: 'Script copied to clipboard' });
  };

  // ─── Voice clone ──────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Please upload an audio file', variant: 'destructive' });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'File too large (max 25MB)', variant: 'destructive' });
      return;
    }
    setCloneFile(file);
  };

  const handleCloneVoice = async () => {
    if (!cloneFile) {
      toast({ title: 'Upload an audio sample first', variant: 'destructive' });
      return;
    }
    setCloning(true);
    // Simulated clone — in production this would upload to the provider API
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setCloning(false);
    toast({
      title: 'Voice cloned successfully',
      description: `${cloneFile.name} is ready to use`,
    });
    setCloneFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── History actions ───────────────────────────────────────────────────────
  const handleHistoryPlay = (item: HistoryItem) => {
    stopAudio();
    setResult(item.result);
    setText(item.text);
    setProvider(item.provider);
    setVoiceModel(item.voiceModel);
    setLanguage(item.language);
    setEmotion(item.emotion);
    setSpeed(item.speed);
    setPitch(item.pitch);
    toast({ title: 'Loaded from history', description: formatRelativeTime(item.createdAt) });
  };

  const handleHistoryDelete = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    toast({ title: 'Removed from history' });
  };

  const handleHistoryDownload = (item: HistoryItem) => {
    const a = document.createElement('a');
    a.href = item.result.audioUrl;
    a.download = `voiceover-${item.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Over Studio"
        description="Generate lifelike AI voiceovers with multi-provider support, emotion control, and voice cloning."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <AudioLines className="h-3.5 w-3.5" />
            {history.length} generated
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ═══════════════════════════════════════════════════════════════════════
            LEFT COLUMN — Script + Provider + Voice Settings
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-6 lg:col-span-3">
          {/* Script Input */}
          <Card className="glass p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Type className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold">Script</h3>
                    <p className="text-xs text-muted-foreground">Enter the text to convert to speech</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyScript}
                  disabled={!text}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Welcome to my channel! In today's video, I'll be walking you through..."
                className="min-h-[180px] resize-none text-sm leading-relaxed"
                maxLength={maxChars}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Type className="h-3 w-3" />
                    {wordCount} words
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{formatDuration(estimatedDuration)}
                  </span>
                  <span>
                    {charCount} / {maxChars}
                  </span>
                </div>
                {charCount > maxChars * 0.9 && (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                    Near limit
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* TTS Provider Selection */}
          <Card className="glass p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <AudioLines className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">TTS Provider</h3>
                  <p className="text-xs text-muted-foreground">Choose your text-to-speech engine</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PROVIDERS.map((p) => {
                  const isActive = provider === p.id;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProviderChange(p.id)}
                      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                        isActive
                          ? `bg-gradient-to-br ${p.accent} ring-2 ring-primary/40`
                          : 'border-border bg-muted/20 hover:border-border/60 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            isActive ? 'bg-primary/20' : 'bg-muted/40'
                          }`}
                        >
                          <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                          >
                            <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.div>
                        )}
                      </div>
                      <h4 className="mt-3 text-sm font-semibold">{p.name}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Voice Settings */}
          <Card className="glass p-5">
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Mic className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">Voice Settings</h3>
                  <p className="text-xs text-muted-foreground">Fine-tune your voice output</p>
                </div>
              </div>

              {/* Voice Model + Language */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs">Voice Model</Label>
                  <Select value={voiceModel} onValueChange={setVoiceModel}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVoices.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          <div className="flex flex-col">
                            <span>{v.label}</span>
                            <span className="text-xs text-muted-foreground">{v.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block text-xs">
                    <span className="flex items-center gap-1">
                      <Languages className="h-3 w-3" />
                      Language
                    </span>
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          <span className="flex items-center gap-2">
                            <span>{l.flag}</span>
                            {l.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Emotion Selector */}
              <div>
                <Label className="mb-2 block text-xs">
                  <span className="flex items-center gap-1">
                    <Smile className="h-3 w-3" />
                    Emotion
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((em) => {
                    const Icon = em.icon;
                    const isActive = emotion === em.value;
                    return (
                      <button
                        key={em.value}
                        onClick={() => setEmotion(em.value)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? `${em.color} ring-1 ring-primary/30`
                            : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {em.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Speed Slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="flex items-center gap-1 text-xs">
                    <Zap className="h-3 w-3" />
                    Speed
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {speed.toFixed(1)}x
                  </Badge>
                </div>
                <Slider
                  value={[speed]}
                  onValueChange={(v) => setSpeed(v[0])}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>

              {/* Pitch Slider */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="flex items-center gap-1 text-xs">
                    <Music className="h-3 w-3" />
                    Pitch
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {pitch > 0 ? `+${pitch}` : pitch}
                  </Badge>
                </div>
                <Slider
                  value={[pitch]}
                  onValueChange={(v) => setPitch(v[0])}
                  min={-10}
                  max={10}
                  step={1}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>-10</span>
                  <span>0</span>
                  <span>+10</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Voice Clone Section */}
          <Card className="glass p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
                  <User className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">Voice Clone</h3>
                  <p className="text-xs text-muted-foreground">Upload an audio sample to clone a voice</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!cloneFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/20"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Click to upload audio sample</p>
                    <p className="text-xs text-muted-foreground">WAV, MP3, or M4A — max 25MB</p>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
                      <Waves className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{cloneFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(cloneFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        setCloneFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCloneVoice}
                disabled={!cloneFile || cloning}
                variant="outline"
                className="w-full gap-2"
              >
                {cloning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cloning voice...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Clone Voice
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !text.trim()}
            size="lg"
            className="w-full gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating voiceover...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Voiceover
              </>
            )}
          </Button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Preview Player + History
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-6 lg:col-span-2">
          {/* Preview Player */}
          <Card className="glass p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Volume2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold">Preview</h3>
                <p className="text-xs text-muted-foreground">Listen to your generated voiceover</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 py-12 text-center"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">Generating voiceover...</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Processing {wordCount} words at {speed.toFixed(1)}x speed
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <span className="text-lg">⚠</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-destructive">Generation failed</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">{error}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-1">
                    Try again
                  </Button>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Result header */}
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                      <AudioLines className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Voiceover Ready</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getProviderName(provider)} · {getVoiceLabel(provider, voiceModel)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {result.sampleRate}Hz
                    </Badge>
                  </div>

                  {/* Audio player */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="flex items-center gap-4">
                      <Button
                        size="icon"
                        onClick={togglePlay}
                        className="h-12 w-12 shrink-0 rounded-full"
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5 translate-x-0.5" />
                        )}
                      </Button>

                      <div className="flex-1">
                        {/* Progress bar */}
                        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="absolute left-0 top-0 h-full rounded-full bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {/* Time labels */}
                        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                          <span>
                            {formatDuration(
                              result.durationSeconds * (progress / 100),
                            )}
                          </span>
                          <span>{formatDuration(result.durationSeconds)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Waveform visualization (decorative) */}
                    <div className="mt-4 flex h-10 items-center justify-center gap-0.5">
                      {Array.from({ length: 40 }).map((_, i) => {
                        const height = isPlaying
                          ? 20 + Math.sin(i * 0.5 + progress * 0.1) * 15 + Math.random() * 10
                          : 4;
                        return (
                          <div
                            key={i}
                            className="w-0.5 rounded-full bg-primary/40 transition-all duration-150"
                            style={{ height: `${Math.max(2, height)}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Download button */}
                  <Button variant="outline" onClick={handleDownload} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    Download Audio
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EmptyState
                    icon={Mic}
                    title="No voiceover yet"
                    description="Enter your script, choose a provider and voice model, then click generate to create your first AI voiceover."
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* History */}
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">History</h3>
                  <p className="text-xs text-muted-foreground">
                    {history.length > 0
                      ? `${history.length} recent generation${history.length > 1 ? 's' : ''}`
                      : 'Your generated voiceovers will appear here'}
                  </p>
                </div>
              </div>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => {
                    setHistory([]);
                    toast({ title: 'History cleared' });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">No history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="group rounded-xl border border-border bg-muted/15 p-3 transition-colors hover:bg-muted/25"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleHistoryPlay(item)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors hover:bg-primary/20"
                        >
                          <Play className="h-4 w-4 translate-x-0.5 text-primary" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
                            {item.text}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {getProviderName(item.provider)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {getVoiceLabel(item.provider, item.voiceModel)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {formatDuration(item.result.durationSeconds)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => handleHistoryDownload(item)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            onClick={() => handleHistoryDelete(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
