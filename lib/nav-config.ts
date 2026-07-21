import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  CheckSquare,
  Search,
  TrendingUp,
  Target,
  Users,
  Flame,
  Sparkles,
  PenLine,
  Clapperboard,
  Link2,
  Languages,
  Video,
  Captions,
  Mic,
  Music,
  Film,
  Image,
  Wand2,
  GanttChartSquare,
  BarChart3,
  DollarSign,
  Eye,
  Clock,
  Repeat,
  MousePointerClick,
  UserPlus,
  LineChart,
  Zap,
  Bot,
  Timer,
  Plug,
  FolderOpen,
  Settings,
  User,
  CreditCard,
  KeyRound,
  Cpu,
  Bell,
  HelpCircle,
  Scissors,
  Activity,
  Gauge,
  Hash,
  ListOrdered,
  FileText,
  Palette,
  Library,
  LayoutGrid,
  FileEdit,
  Send,
  CheckCircle2,
  Archive,
  Tag,
  ListMusic,
  Trash2,
  Webhook as WebhookIcon,
  ScrollText,
  LayoutTemplate,
  FileOutput,
  UsersRound,
  ShieldCheck,
  Database,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Projects', icon: FolderKanban, href: '/dashboard/projects' },
      { label: 'Content Calendar', icon: CalendarDays, href: '/dashboard/calendar' },
      { label: 'Tasks', icon: CheckSquare, href: '/dashboard/tasks' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'All Content', icon: LayoutGrid, href: '/dashboard/content' },
      { label: 'Draft', icon: FileEdit, href: '/dashboard/content/draft' },
      { label: 'Scheduled', icon: Send, href: '/dashboard/content/scheduled' },
      { label: 'Published', icon: CheckCircle2, href: '/dashboard/content/published' },
      { label: 'Archived', icon: Archive, href: '/dashboard/content/archived' },
      { label: 'Categories', icon: Tag, href: '/dashboard/content/categories' },
      { label: 'Tags', icon: Hash, href: '/dashboard/content/tags' },
      { label: 'Playlist', icon: ListMusic, href: '/dashboard/content/playlists' },
      { label: 'Trash', icon: Trash2, href: '/dashboard/content/trash' },
    ],
  },
  {
    title: 'Research',
    items: [
      { label: 'Trending Topics', icon: TrendingUp, href: '/dashboard/research' },
      { label: 'Keyword Research', icon: Search, href: '/dashboard/research/keywords' },
      { label: 'Competitor Analysis', icon: Users, href: '/dashboard/research/competitors' },
      { label: 'Viral Score', icon: Flame, href: '/dashboard/research/viral-score' },
    ],
  },
  {
    title: 'AI Studio Editor',
    items: [
      { label: 'AI Chat', icon: Sparkles, href: '/dashboard/ai-studio?mode=chat' },
      { label: 'Script Generator', icon: PenLine, href: '/dashboard/ai-studio?mode=script' },
      { label: 'Storyboard', icon: Clapperboard, href: '/dashboard/ai-studio?mode=storyboard' },
      { label: 'Hook Generator', icon: Zap, href: '/dashboard/ai-studio?mode=hooks' },
      { label: 'CTA Generator', icon: Link2, href: '/dashboard/ai-studio?mode=cta' },
      { label: 'Rewrite Script', icon: PenLine, href: '/dashboard/ai-studio?mode=rewrite' },
      { label: 'Translate Script', icon: Languages, href: '/dashboard/ai-studio?mode=translate' },
    ],
  },
  {
    title: 'Video Studio',
    items: [
      { label: 'Video Editor', icon: Video, href: '/dashboard/video-studio' },
      { label: 'Trending Videos', icon: TrendingUp, href: '/dashboard/video-studio/trending', badge: 'New' },
      { label: 'Video Analyzer', icon: Activity, href: '/dashboard/video-studio/analyzer', badge: 'New' },
      { label: 'AI Clipper', icon: Scissors, href: '/dashboard/video-studio/clipper', badge: 'New' },
      { label: 'Viral Finder', icon: Flame, href: '/dashboard/video-studio/viral-finder', badge: 'New' },
      { label: 'Hook Analyzer', icon: Gauge, href: '/dashboard/video-studio/hook-analyzer', badge: 'New' },
      { label: 'Scene Editor', icon: Clapperboard, href: '/dashboard/video-studio/scene-editor', badge: 'New' },
      { label: 'Subtitles', icon: Captions, href: '/dashboard/video-studio/subtitles' },
      { label: 'Voice Over', icon: Mic, href: '/dashboard/video-studio/voiceover' },
      { label: 'B-Roll Library', icon: Film, href: '/dashboard/video-studio/broll' },
      { label: 'Music Library', icon: Music, href: '/dashboard/video-studio/music' },
    ],
  },
  {
    title: 'Thumbnail Studio',
    items: [
      { label: 'Thumbnail Generator', icon: Image, href: '/dashboard/thumbnail-studio' },
      { label: 'Thumbnail Editor', icon: PenLine, href: '/dashboard/thumbnail-studio/editor', badge: 'New' },
      { label: 'A/B Testing', icon: GanttChartSquare, href: '/dashboard/thumbnail-studio/ab-testing' },
      { label: 'Brand Kit', icon: Palette, href: '/dashboard/thumbnail-studio/brand-kit', badge: 'New' },
      { label: 'Asset Library', icon: Library, href: '/dashboard/thumbnail-studio/asset-library', badge: 'New' },
    ],
  },
  {
    title: 'SEO Studio',
    items: [
      { label: 'SEO Optimizer', icon: Wand2, href: '/dashboard/seo-studio' },
      { label: 'Title Generator', icon: PenLine, href: '/dashboard/seo-studio/titles' },
      { label: 'Description Generator', icon: FileText, href: '/dashboard/seo-studio/descriptions', badge: 'New' },
      { label: 'Tags Generator', icon: Target, href: '/dashboard/seo-studio/tags' },
      { label: 'Hashtag Generator', icon: Hash, href: '/dashboard/seo-studio/hashtags', badge: 'New' },
      { label: 'Chapters Generator', icon: ListOrdered, href: '/dashboard/seo-studio/chapters', badge: 'New' },
      { label: 'Keyword Research', icon: Search, href: '/dashboard/seo-studio/keywords', badge: 'New' },
      { label: 'SEO Analytics', icon: BarChart3, href: '/dashboard/seo-studio/analytics', badge: 'New' },
    ],
  },
  {
    title: 'Publishing',
    items: [
      { label: 'Upload Video', icon: Video, href: '/dashboard/publishing' },
      { label: 'Schedule', icon: Timer, href: '/dashboard/publishing/schedule' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Overview', icon: BarChart3, href: '/dashboard/analytics' },
      { label: 'Revenue', icon: DollarSign, href: '/dashboard/analytics/revenue' },
      { label: 'Audience', icon: Users, href: '/dashboard/analytics/audience' },
      { label: 'Retention', icon: Repeat, href: '/dashboard/analytics/retention' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'Workflow Builder', icon: Zap, href: '/dashboard/automation' },
      { label: 'AI Agents', icon: Bot, href: '/dashboard/automation/agent' },
      { label: 'Scheduled Jobs', icon: Timer, href: '/dashboard/automation/jobs' },
      { label: 'Integrations', icon: Plug, href: '/dashboard/automation/integrations' },
      { label: 'Webhooks', icon: WebhookIcon, href: '/dashboard/automation/webhooks', badge: 'New' },
      { label: 'Activity Logs', icon: ScrollText, href: '/dashboard/automation/logs', badge: 'New' },
    ],
  },
  {
    title: 'Assets',
    items: [
      { label: 'Media Library', icon: FolderOpen, href: '/dashboard/assets' },
      { label: 'Brand Assets', icon: Palette, href: '/dashboard/assets/brand' },
      { label: 'Templates', icon: LayoutTemplate, href: '/dashboard/assets/templates', badge: 'New' },
      { label: 'Exports', icon: FileOutput, href: '/dashboard/assets/exports', badge: 'New' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
      { label: 'Team Management', icon: UsersRound, href: '/dashboard/settings/team', badge: 'New' },
      { label: 'API Keys', icon: KeyRound, href: '/dashboard/settings/api-keys', badge: 'New' },
      { label: 'Audit Logs', icon: ShieldCheck, href: '/dashboard/settings/audit-logs', badge: 'New' },
      { label: 'Storage', icon: Database, href: '/dashboard/settings/storage', badge: 'New' },
      { label: 'Help', icon: HelpCircle, href: '/dashboard/help' },
    ],
  },
];
