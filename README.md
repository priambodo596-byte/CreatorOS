# CreatorOS AI

**All-in-One Creator Studio** — A powerful SaaS platform for content creators to manage, optimize, and automate their entire content workflow. Built with Next.js, Supabase, and cutting-edge AI integrations.

![CreatorOS AI](https://img.shields.io/badge/Status-Active-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Supabase](https://img.shields.io/badge/Supabase-FFD700)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6)

---

## 🚀 Features

### 📊 Dashboard

- Real-time YouTube channel analytics (views, subscribers, watch time)
- Workspace summary (projects, draft/scheduled/published content)
- AI usage tracking & storage monitoring
- Traffic sources & retention charts

### 🤖 AI Studio

- **AI Chat** — Conversational AI assistant
- **Script Generator** — Generate video scripts with AI
- **Storyboard Generator** — Scene-by-scene storyboard creation
- **Hook Generator** — Viral hook suggestions
- **CTA Generator** — Call-to-action optimization
- **Script Rewrite** — Rewrite and improve scripts
- **Script Translation** — Multi-language translation

### 🎬 Video Studio

- **Video Editor** — Full-featured timeline editor
- **AI Clipper** — Automatic highlight clipping
- **Viral Finder** — Discover trending video patterns
- **Hook Analyzer** — Analyze and optimize hooks
- **Scene Editor** — Scene-level editing
- **Subtitles & Captions** — Auto-generated subtitles
- **Voice Over** — AI voiceover generation
- **B-Roll Library** — Stock footage library
- **Music Library** — Royalty-free music

### 🖼️ Thumbnail Studio

- **AI Thumbnail Generator** — Generate thumbnails with AI
- **Thumbnail Editor** — Advanced image editor
- **A/B Testing** — Test multiple thumbnail variants
- **Brand Kit** — Manage brand assets and colors
- **Asset Library** — Organized asset management

### 🔍 SEO Studio

- **SEO Optimizer** — Full video SEO optimization
- **Title Generator** — AI-powered title suggestions
- **Description Generator** — Auto-generated descriptions
- **Tags Generator** — Smart tag recommendations
- **Hashtag Generator** — Trending hashtag suggestions
- **Chapters Generator** — Video chapter creation
- **Keyword Research** — YouTube keyword analysis
- **SEO Analytics** — Track SEO performance

### 📝 Content Management

- **Content Calendar** — Visual content scheduling
- **Draft/Scheduled/Published/Archived** — Full lifecycle management
- **Categories & Tags** — Content organization
- **Playlists** — YouTube playlist management
- **Trash** — Soft delete with restore

### 📈 Analytics

- **Overview** — Channel performance dashboard
- **Revenue** — Monetization analytics
- **Audience** — Demographics & behavior
- **Retention** — Audience retention analysis

### 🔄 Automation

- **Workflow Builder** — Drag-and-drop automation pipeline
- **AI Agents** — Automated AI content generation
- **Scheduled Jobs** — Cron-based task scheduling
- **Integrations Center** — Connect third-party services
- **Webhooks** — Event-driven webhook triggers
- **Activity Logs** — Audit trail for all actions

### 🔗 Integrations

- **YouTube** — Full OAuth, Data API v3, Analytics API
- **Google Account** — Google OAuth 2.0, Drive, Calendar
- **AI Providers** — OpenAI, Gemini, StoryShort, HeyGen, ElevenLabs, Stability AI
- **Storage** — Supabase Storage integration
- **Social Media** — TikTok, Instagram, Facebook, X/Twitter, LinkedIn, Pinterest
- **Automation** — n8n, Make, Zapier, Pabbly, IFTTT
- **Notifications** — Discord, Telegram, Slack, Email, Firebase
- **Developer API** — REST & GraphQL endpoints, API key management

### 👥 Team & Settings

- **Team Management** — Multi-user workspace
- **API Keys** — Secure key management
- **Audit Logs** — Complete activity history
- **Storage Management** — Usage monitoring

---

## 🛠️ Tech Stack

| Category           | Technology                                       |
| ------------------ | ------------------------------------------------ |
| **Framework**      | Next.js 14 (App Router)                          |
| **Language**       | TypeScript                                       |
| **Database**       | Supabase (PostgreSQL)                            |
| **Auth**           | Supabase Auth                                    |
| **Storage**        | Supabase Storage                                 |
| **Edge Functions** | Supabase Edge Functions (Deno)                   |
| **Styling**        | Tailwind CSS                                     |
| **UI Components**  | shadcn/ui                                        |
| **Animations**     | Framer Motion                                    |
| **Charts**         | Recharts                                         |
| **Icons**          | Lucide React                                     |
| **AI/ML**          | OpenAI, Gemini, ElevenLabs, HeyGen, Stability AI |
| **YouTube API**    | YouTube Data API v3, YouTube Analytics API       |

---

## 📦 Project Structure

```
CreatorOS/
├── app/
│   ├── auth/                    # Authentication pages
│   ├── dashboard/              # Main dashboard (App Router)
│   │   ├── ai-studio/          # AI Studio module
│   │   ├── analytics/          # Analytics module
│   │   ├── assets/             # Media library
│   │   ├── automation/         # Workflow automation
│   │   ├── calendar/           # Content calendar
│   │   ├── content/            # Content management
│   │   ├── help/               # Help & support
│   │   ├── projects/           # Project management
│   │   ├── publishing/         # Publishing tools
│   │   ├── research/           # Research tools
│   │   ├── seo-studio/         # SEO optimization
│   │   ├── settings/           # Settings
│   │   ├── tasks/              # Task management
│   │   ├── thumbnail-studio/   # Thumbnail creation
│   │   └── video-studio/       # Video editing
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── dashboard/              # Dashboard components
│   ├── ai-studio/              # AI Studio components
│   ├── landing/                # Landing page components
│   └── youtube/                # YouTube integration components
├── lib/
│   ├── supabase-client.ts      # Supabase client config
│   ├── auth-context.tsx        # Auth provider
│   ├── nav-config.ts           # Sidebar navigation config
│   ├── youtube.ts              # YouTube API service layer
│   ├── automation.ts           # Automation service layer
│   ├── content.ts              # Content management service
│   ├── dashboard.ts            # Dashboard data service
│   └── ...                     # Other service modules
├── hooks/
│   ├── use-youtube-data.ts     # YouTube data hooks
│   ├── use-youtube-sync.ts     # Sync state hooks
│   ├── use-dashboard-summary.ts
│   └── use-toast.ts            # Toast notifications
├── supabase/
│   ├── functions/              # Edge functions
│   │   ├── youtube-oauth/      # YouTube OAuth flow
│   │   ├── youtube-sync/       # Full YouTube data sync
│   │   ├── youtube-analytics/  # Analytics reports
│   │   ├── youtube-keywords/   # Keyword research
│   │   ├── youtube-trending/   # Trending videos
│   │   ├── youtube-competitor/ # Competitor analysis
│   │   ├── ai-studio/          # AI generation
│   │   ├── seo-tools/          # SEO optimization
│   │   ├── thumbnail-tools/    # Thumbnail generation
│   │   └── video-tools/        # Video processing
│   └── migrations/             # Database migrations
└── config/                     # Configuration files
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Supabase** account (free tier works)
- **Google Cloud Console** project (for YouTube API)
- **OpenAI** / **Gemini** / **ElevenLabs** API keys (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/priambodo596-byte/CreatorOS.git
cd CreatorOS

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (YouTube)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# AI Providers (optional)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Database Setup

```bash
# Run Supabase migrations
supabase migration up
```

### Development

```bash
# Start development server
npm run dev

# Start Supabase edge functions locally
supabase functions serve
```

### Build

```bash
npm run build
npm start
```

---

## 🧩 Key Architecture Decisions

### Authentication

- **Supabase Auth** handles session management
- YouTube OAuth flow via Supabase Edge Functions with offline token refresh
- Sensitive credentials stored securely in database (never exposed to frontend)

### YouTube Integration

- OAuth 2.0 with refresh token rotation
- Full sync pipeline: channels → videos → playlists → comments → analytics
- Rate limiting with exponential backoff (3 retries)
- Daily analytics aggregated in `youtube_analytics_daily` table

### Automation Engine

- Drag-and-drop workflow builder with 23+ node types
- Version history with rollback support
- Execution history with node-level results
- Import/export workflows as JSON

### Security

- Row-Level Security (RLS) on all Supabase tables
- Service role key used only in edge functions (never exposed to client)
- API keys encrypted at rest
- OAuth tokens stored securely with refresh token rotation

---

## 🔄 Database Schema

Key tables (managed via Supabase migrations):

| Table                     | Purpose                         |
| ------------------------- | ------------------------------- |
| `youtube_connections`     | OAuth tokens per user           |
| `youtube_channels`        | Synced channel data             |
| `youtube_videos`          | Video metadata & stats          |
| `youtube_playlists`       | Playlist data                   |
| `youtube_comments`        | Comment threads                 |
| `youtube_analytics_daily` | Daily analytics                 |
| `youtube_sync_logs`       | Sync job history                |
| `workflows`               | Automation workflow definitions |
| `workflow_versions`       | Version snapshots               |
| `workflow_executions`     | Execution history               |
| `scheduled_jobs`          | Cron job scheduling             |
| `activity_logs`           | Global audit trail              |
| `content_items`           | Content management              |
| `projects`                | Project management              |
| `api_keys`                | Developer API keys              |
| `team_members`            | Team management                 |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Recharts](https://recharts.org/)
- [Lucide Icons](https://lucide.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
