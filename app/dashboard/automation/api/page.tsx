'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Youtube,
  Brain,
  Sparkles,
  Mic,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Settings2,
  ExternalLink,
  Key,
  Zap,
  Plug,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useYouTubeData } from '@/hooks/use-youtube-data';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, ErrorState, StatCard } from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------
interface Integration {
  id: string;
  name: string;
  icon: typeof Youtube;
  color: string;
  bg: string;
  description: string;
  status: 'connected' | 'not_configured' | 'error';
  docsUrl: string;
  envVars: string[];
  setupSteps: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'youtube',
    name: 'YouTube Data API',
    icon: Youtube,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    description: 'Pull channel stats, videos, analytics, comments, and playlists from YouTube.',
    status: 'not_configured',
    docsUrl: 'https://developers.google.com/youtube/v3/getting-started',
    envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_API_KEY'],
    setupSteps: [
      'Go to the Google Cloud Console and create a new project',
      'Enable the YouTube Data API v3',
      'Create OAuth 2.0 credentials and copy the Client ID and Secret',
      'Create an API key for server-side requests',
      'Add the credentials to your environment variables',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: Brain,
    color: 'text-success',
    bg: 'bg-success/10',
    description: 'Generate scripts, titles, descriptions, and analyze content with GPT models.',
    status: 'not_configured',
    docsUrl: 'https://platform.openai.com/api-keys',
    envVars: ['OPENAI_API_KEY'],
    setupSteps: [
      'Go to platform.openai.com and sign in',
      'Navigate to API Keys and create a new key',
      'Copy the API key (starts with sk-)',
      'Add OPENAI_API_KEY to your environment variables',
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: Sparkles,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Use Google\'s Gemini models for content generation, analysis, and multimodal tasks.',
    status: 'not_configured',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    envVars: ['GEMINI_API_KEY'],
    setupSteps: [
      'Go to Google AI Studio (aistudio.google.com)',
      'Click "Get API Key" and create a new key',
      'Copy the API key',
      'Add GEMINI_API_KEY to your environment variables',
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: Mic,
    color: 'text-info',
    bg: 'bg-info/10',
    description: 'Generate high-quality voiceovers and narration with AI text-to-speech.',
    status: 'not_configured',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    envVars: ['ELEVENLABS_API_KEY'],
    setupSteps: [
      'Go to elevenlabs.io and sign in',
      'Navigate to Settings → API Keys',
      'Create a new API key',
      'Add ELEVENLABS_API_KEY to your environment variables',
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: Database,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Database, authentication, and storage backend for your CreatorOS data.',
    status: 'not_configured',
    docsUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    setupSteps: [
      'Go to your Supabase project dashboard',
      'Navigate to Settings → API',
      'Copy the Project URL and anon public key',
      'Add them to your environment variables',
      'Optionally add the service role key for server-side operations',
    ],
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function APIIntegrationPage() {
  const yt = useYouTubeData();
  const { toast } = useToast();
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const loading = yt.loading;
  const error = yt.error;

  // Determine YouTube connection status from the hook
  const integrations = INTEGRATIONS.map((int) => {
    if (int.id === 'youtube') {
      return {
        ...int,
        status: (yt.connected ? 'connected' : 'not_configured') as 'connected' | 'not_configured',
      };
    }
    // Supabase is always "connected" since the app is running on it
    if (int.id === 'supabase') {
      return {
        ...int,
        status: 'connected' as 'connected' | 'not_configured',
      description:
          'Database, authentication, and storage backend for your CreatorOS data. Connected via the app runtime.',
      setupSteps: [
        'Already configured! Your app is running on Supabase.',
        'To add the service role key for server-side operations, add SUPABASE_SERVICE_ROLE_KEY to your environment variables.',
      ],
      envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      };
    }
    return int;
  });

  const connectedCount = integrations.filter((i) => i.status === 'connected').length;
  const notConfiguredCount = integrations.filter((i) => i.status === 'not_configured').length;

  const configuring = integrations.find((i) => i.id === configuringId);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    setTimeout(() => setCopiedVar(null), 2000);
    toast({ title: 'Copied', description: 'Environment variable name copied to clipboard.' });
  };

  const handleConfigure = (id: string) => {
    setConfiguringId(id);
  };

  const handleRefresh = () => {
    yt.refresh();
    toast({ title: 'Refreshing', description: 'Checking integration status.' });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="API Integrations"
        description="Connect and manage external services that power your CreatorOS automation."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Check Status
          </Button>
        }
      />

      {/* Loading */}
      {loading && (
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Checking integration status…</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={handleRefresh} />}

      {/* Main content */}
      {!loading && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Connected"
              value={connectedCount}
              icon={CheckCircle2}
              color="text-success"
              bg="bg-success/10"
              delay={0}
            />
            <StatCard
              label="Not Configured"
              value={notConfiguredCount}
              icon={XCircle}
              color="text-destructive"
              bg="bg-destructive/10"
              delay={0.1}
            />
            <StatCard
              label="Total Services"
              value={integrations.length}
              icon={Plug}
              color="text-primary"
              bg="bg-primary/10"
              delay={0.2}
            />
            <StatCard
              label="YouTube Status"
              value={yt.connected ? 'Connected' : 'Disconnected'}
              icon={Youtube}
              color={yt.connected ? 'text-success' : 'text-muted-foreground'}
              bg={yt.connected ? 'bg-success/10' : 'bg-muted/20'}
              delay={0.3}
            />
          </div>

          {/* Integration cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {integrations.map((int, i) => {
              const Icon = int.icon;
              const isConnected = int.status === 'connected';

              return (
                <motion.div
                  key={int.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="glass glass-hover p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                          int.bg,
                        )}
                      >
                        <Icon className={cn('h-6 w-6', int.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-base font-semibold">{int.name}</h3>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              isConnected
                                ? 'bg-success/15 text-success'
                                : 'bg-muted/20 text-muted-foreground',
                            )}
                          >
                            {isConnected ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Connected
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-1 h-3 w-3" />
                                Not configured
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{int.description}</p>

                        {/* Actions */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isConnected ? 'outline' : 'default'}
                            onClick={() => handleConfigure(int.id)}
                          >
                            <Settings2 className="mr-2 h-3.5 w-3.5" />
                            {isConnected ? 'Configure' : 'Set Up'}
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <a href={int.docsUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Docs
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Info banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass p-4">
              <div className="flex items-start gap-3">
                <Key className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Environment Variables</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Integration credentials are stored as environment variables in your deployment
                    platform. Never commit API keys to your repository. Use{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> for
                    development and your hosting provider&apos;s dashboard for production.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}

      {/* Configuration dialog */}
      <Dialog open={!!configuringId} onOpenChange={(o) => !o && setConfiguringId(null)}>
        <DialogContent className="glass-strong max-w-lg">
          {configuring && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', configuring.bg)}>
                    <configuring.icon className={cn('h-4 w-4', configuring.color)} />
                  </div>
                  Configure {configuring.name}
                </DialogTitle>
                <DialogDescription>
                  {configuring.status === 'connected'
                    ? 'This integration is currently active. Review setup details below.'
                    : 'Follow these steps to connect this integration.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Setup steps */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">Setup Steps</h4>
                  <ol className="space-y-2">
                    {configuring.setupSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Environment variables */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                    Required Environment Variables
                  </h4>
                  <div className="space-y-2">
                    {configuring.envVars.map((envVar) => (
                      <div
                        key={envVar}
                        className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
                      >
                        <code className="text-xs font-mono">{envVar}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleCopy(envVar)}
                        >
                          {copiedVar === envVar ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Docs link */}
                <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <a
                    href={configuring.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open {configuring.name} documentation
                  </a>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setConfiguringId(null)}>
                  Close
                </Button>
                {configuring.status !== 'connected' && (
                  <Button
                    onClick={() => {
                      toast({
                        title: 'Setup guide opened',
                        description: `Follow the steps above to configure ${configuring.name}, then add the environment variables to your deployment.`,
                      });
                      setConfiguringId(null);
                    }}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Got it
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
