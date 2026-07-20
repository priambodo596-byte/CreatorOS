// AI Studio Editor - Models, Modes, and Shared Types

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  capabilities: string[];
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'ChatGPT 4o',
    provider: 'OpenAI',
    description: 'Best for script writing, creative content, and general tasks',
    icon: 'sparkles',
    color: 'text-success',
    bg: 'bg-success/10',
    capabilities: ['Script Writing', 'Creative', 'Analysis', 'Code'],
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: 'Best for research, multi-modal analysis, and data synthesis',
    icon: 'brain',
    color: 'text-info',
    bg: 'bg-info/10',
    capabilities: ['Research', 'Multi-modal', 'Analysis', 'Search'],
  },
  {
    id: 'storyshort-ai',
    name: 'StoryShort AI',
    provider: 'StoryShort',
    description: 'Best for storyboards, viral shorts, and scene generation',
    icon: 'clapperboard',
    color: 'text-warning',
    bg: 'bg-warning/10',
    capabilities: ['Storyboard', 'Viral Shorts', 'Scenes', 'Visual'],
  },
  {
    id: 'heygen-ai',
    name: 'HeyGen AI',
    provider: 'HeyGen',
    description: 'Best for AI avatar videos, voice generation, and talking heads',
    icon: 'video',
    color: 'text-accent',
    bg: 'bg-accent/10',
    capabilities: ['AI Avatar', 'Voice', 'Video', 'Talking Head'],
  },
];

export type StudioMode = 'chat' | 'script' | 'storyboard' | 'hooks' | 'cta' | 'rewrite' | 'translate';

export interface StudioModeConfig {
  id: StudioMode;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
}

export const STUDIO_MODES: StudioModeConfig[] = [
  { id: 'chat', label: 'AI Chat', description: 'Chat with AI about anything', icon: 'message-square', color: 'text-primary', bg: 'bg-primary/10' },
  { id: 'script', label: 'Script Generator', description: 'Generate complete video scripts', icon: 'pen-line', color: 'text-success', bg: 'bg-success/10' },
  { id: 'storyboard', label: 'Storyboard', description: 'Convert scripts to visual scenes', icon: 'clapperboard', color: 'text-warning', bg: 'bg-warning/10' },
  { id: 'hooks', label: 'Hook Generator', description: 'Generate viral opening hooks', icon: 'zap', color: 'text-accent', bg: 'bg-accent/10' },
  { id: 'cta', label: 'CTA Generator', description: 'Generate call-to-action variations', icon: 'link', color: 'text-info', bg: 'bg-info/10' },
  { id: 'rewrite', label: 'Rewrite Script', description: 'Rewrite in different styles', icon: 'edit-3', color: 'text-destructive', bg: 'bg-destructive/10' },
  { id: 'translate', label: 'Translate Script', description: 'Translate preserving tone & SEO', icon: 'languages', color: 'text-primary', bg: 'bg-primary/10' },
];

export const REWRITE_STYLES = [
  { value: 'shorter', label: 'Shorter', description: 'Condense and tighten' },
  { value: 'longer', label: 'Longer', description: 'Expand with more detail' },
  { value: 'professional', label: 'More Professional', description: 'Formal, polished tone' },
  { value: 'funny', label: 'Funny', description: 'Humorous and entertaining' },
  { value: 'storytelling', label: 'Storytelling', description: 'Narrative-driven approach' },
  { value: 'viral', label: 'Viral Style', description: 'High-energy, click-optimized' },
  { value: 'educational', label: 'Educational', description: 'Clear, informative, teaching' },
  { value: 'beginner', label: 'Beginner Friendly', description: 'Simple, accessible language' },
];

export const TRANSLATE_LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'ar', label: 'Arabic', flag: '🇸🇦' },
];

export const TONES = [
  'Casual', 'Professional', 'Energetic', 'Educational', 'Entertaining',
  'Inspirational', 'Authoritative', 'Friendly', 'Dramatic', 'Humorous',
];

export const TARGET_AUDIENCES = [
  'General', 'Beginners', 'Professionals', 'Teens', 'Young Adults',
  'Entrepreneurs', 'Developers', 'Creators', 'Gamers', 'Students',
];

export const SCRIPT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Indonesia' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
];

export interface Conversation {
  id: string;
  title: string;
  mode: StudioMode;
  model: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timestamp: string;
  attachments?: { name: string; type: string; url?: string }[];
}

export interface SavedDocument {
  id: string;
  title: string;
  type: StudioMode;
  content: string;
  model: string;
  favorite: boolean;
  updated_at: string;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  favorite: boolean;
}

export interface BuiltinPrompt {
  title: string;
  content: string;
  category: string;
  icon: string;
  color: string;
}

export const BUILTIN_PROMPTS: BuiltinPrompt[] = [
  { title: 'Write a Script', content: 'Write a YouTube script about [TOPIC] for [AUDIENCE]. Duration: [DURATION] minutes. Tone: [TONE].', category: 'script', icon: 'pen-line', color: 'text-success' },
  { title: 'Generate Hooks', content: 'Generate 5 viral opening hooks for a video about [TOPIC]. Include emotional trigger and retention estimate.', category: 'hooks', icon: 'zap', color: 'text-accent' },
  { title: 'Create Storyboard', content: 'Break down this script into visual scenes with camera shots, AI image prompts, and voice over: [SCRIPT]', category: 'storyboard', icon: 'clapperboard', color: 'text-warning' },
  { title: 'Optimize SEO', content: 'Optimize the SEO for my video about [TOPIC]. Generate title, description, and tags.', category: 'seo', icon: 'trending-up', color: 'text-info' },
  { title: 'Generate CTA', content: 'Generate 5 call-to-action variations for a video about [TOPIC]. Mix subscribe, like, comment, and link CTAs.', category: 'cta', icon: 'link', color: 'text-primary' },
  { title: 'Translate Script', content: 'Translate this script to [LANGUAGE] while preserving tone, SEO, and emotion: [SCRIPT]', category: 'translate', icon: 'languages', color: 'text-primary' },
  { title: 'Analyze Trends', content: 'What topics are trending in [NICHE] right now? Give me 10 video ideas with viral scores.', category: 'research', icon: 'trending-up', color: 'text-warning' },
  { title: 'Rewrite for Viral', content: 'Rewrite this script in a viral, high-energy style with strong hooks and retention tactics: [SCRIPT]', category: 'rewrite', icon: 'edit-3', color: 'text-destructive' },
];

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModeById(id: StudioMode): StudioModeConfig | undefined {
  return STUDIO_MODES.find((m) => m.id === id);
}

export function calculateReadabilityScore(content: string): number {
  if (!content.trim()) return 0;
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const avgWordsPerSentence = words.length / sentences.length;
  const longWords = words.filter((w) => w.length > 7).length;
  const score = Math.max(0, Math.min(100, Math.round(100 - (avgWordsPerSentence * 1.5) - (longWords / words.length * 50))));
  return score;
}

export function calculateSEOScore(content: string, title?: string): number {
  if (!content.trim()) return 0;
  let score = 0;
  if (title && title.length >= 20 && title.length <= 70) score += 25;
  else if (title) score += 10;
  if (content.length >= 200) score += 20;
  if (content.length >= 500) score += 10;
  const hasKeywords = /\b(how to|best|top|tutorial|guide|tips|2025|2026|review|explained)\b/i.test(content);
  if (hasKeywords) score += 15;
  const hasStructure = /^#{1,3}\s/m.test(content) || /\*\*.+\*\*/.test(content);
  if (hasStructure) score += 15;
  const wordCount = content.split(/\s+/).length;
  if (wordCount >= 100) score += 15;
  return Math.min(100, score);
}

export function calculateContentScore(content: string): number {
  if (!content.trim()) return 0;
  let score = 0;
  const wordCount = content.split(/\s+/).length;
  if (wordCount >= 50) score += 20;
  if (wordCount >= 200) score += 20;
  if (wordCount >= 500) score += 10;
  const hasHook = /^(what|why|how|imagine|did you know|stop)/i.test(content.trim());
  if (hasHook) score += 15;
  const hasCTA = /(subscribe|like|comment|share|follow|click|link below|check out)/i.test(content);
  if (hasCTA) score += 15;
  const hasStructure = /\n\s*\n/.test(content);
  if (hasStructure) score += 10;
  const hasQuestions = /\?/.test(content);
  if (hasQuestions) score += 10;
  return Math.min(100, score);
}

export function estimateVideoDuration(content: string): string {
  const words = content.split(/\s+/).filter((w) => w.length > 0).length;
  const minutes = Math.round((words / 150) * 10) / 10;
  if (minutes < 1) return `${Math.round(words / 2.5)} sec`;
  return `${minutes} min`;
}

export function countWords(content: string): number {
  return content.split(/\s+/).filter((w) => w.length > 0).length;
}

export function countCharacters(content: string): number {
  return content.length;
}
