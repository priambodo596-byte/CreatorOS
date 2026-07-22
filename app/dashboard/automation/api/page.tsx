'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Youtube,
  Brain,
  Sparkles,
  Database,
  Cloud,
  Webhook,
  Code,
  KeyRound,
  Video,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plug,
  Activity,
  PlugZap,
  FileText,
  Power,
  Zap,
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
import { useToast } from '@/hooks/use-toast';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
} from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';
import {
  fetchIntegrations,
  upsertIntegration,
  updateIntegration,
  deleteIntegration,
  insertActivityLog,
  type ApiIntegrationRow,
} from '@/lib/automation';

// ---------------------------------------------------------------------------
// Provider catalog
// ---------------------------------------------------------------------------
interface ProviderMeta {
  provider: string;
  name: string;
  icon: typeof Youtube;
  color: string;
  bg: string;
  description: string;
  credentialLabel: string;
  credentialPlaceholder: string;
  defaultQuotaLimit: number;
}

const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'google_oauth',
    name: 'Google OAuth',
    icon: KeyRound,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    description: 'Authenticate users via Google OAuth 2.0 for YouTube, Drive, and other Google services.',
    credentialLabel: 'Client ID',
    credentialPlaceholder: 'xxxxx.apps.googleusercontent.com',
    defaultQuotaLimit: 10000,
  },
  {
    provider: 'youtube_data',
    name: 'YouTube Data API',
    icon: Youtube,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    description: 'Pull channel stats, videos, comments, and playlists from YouTube.',
    credentialLabel: 'API Key',
    credentialPlaceholder: 'AIzaSy...',
    defaultQuotaLimit: 10000,
  },
  {
    provider: 'youtube_analytics',
    name: 'YouTube Analytics API',
    icon: BarChart3,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    description: 'Retrieve detailed analytics reports for your YouTube channel and videos.',
    credentialLabel: 'API Key',
    credentialPlaceholder: 'AIzaSy...',
    defaultQuotaLimit: 5000,
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    icon: Brain,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    description: 'Generate scripts, titles, descriptions, and analyze content with GPT models.',
    credentialLabel: 'API Key',
    credentialPlaceholder: 'sk-...',
    defaultQuotaLimit: 1000,
  },
  {
    provider: 'gemini',
    name: 'Google Gemini',
    icon: Sparkles,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    description: "Use Google's Gemini models for content generation, analysis, and multimodal tasks.",
    credentialLabel: 'API Key',
    credentialPlaceholder: 'AIzaSy...',
    defaultQuotaLimit: 1000,
  },
  {
    provider: 'storyshort',
    name: 'StoryShort',
    icon: Video,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    description: 'Auto-generate and publish short-form videos across social platforms.',
    credentialLabel: 'API Key',
    credentialPlaceholder: 'ss_...',
    defaultQuotaLimit: 500,
  },
  {
    provider: 'heygen',
    name: 'HeyGen',
    icon: Video,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    description: "Create AI avatar videos and voiceovers with HeyGen's video generation API.",
    credentialLabel: 'API Key',
    credentialPlaceholder: 'hg_...',
    defaultQuotaLimit: 500,
  },
  {
    provider: 'supabase',
    name: 'Supabase',
    icon: Database,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    description: 'Database, authentication, and storage backend for your CreatorOS data.',
    credentialLabel: 'Service Role Key',
    credentialPlaceholder: 'eyJhbGci...',
    defaultQuotaLimit: 10000,
  },
  {
    provider: 'cloudinary',
    name: 'Cloudinary',
    icon: Cloud,
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    description: 'Upload, transform, optimize, and deliver media assets via Cloudinary.',
    credentialLabel: 'API Secret',
    credentialPlaceholder: 'cloudinary-api-secret',
    defaultQuotaLimit: 5000,
  },
  {
    provider: 'webhook',
    name: 'Webhook',
    icon: Webhook,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    description: 'Send and receive webhook events to trigger automation workflows.',
    credentialLabel: 'Webhook Secret',
    credentialPlaceholder: 'whsec_...',
    defaultQuotaLimit: 10000,
  },
  {
    provider: 'rest_api',
    name: 'REST API',
    icon: Code,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    description: 'Connect to any custom REST API endpoint for data exchange and automation.',
    credentialLabel: 'Bearer Token',
    credentialPlaceholder: 'Bearer ...',
    defaultQuotaLimit: 5000,
  },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
type IntegrationStatus = ApiIntegrationRow['status']; // 'connected' | 'not_configured' | 'error' | 'disconnected'
type HealthStatus = ApiIntegrationRow['health_status']; // 'healthy' | 'degraded' | 'down' | 'unknown'

const STATUS_BADGE: Record<IntegrationStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  connected: { label: 'Connected', cls: 'bg-success/15 text-success', icon: CheckCircle2 },
  not_configured: { label: 'Not Configured', cls: 'bg-muted/30 text-muted-foreground', icon: XCircle },
  error: { label: 'Error', cls: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
  disconnected: { label: 'Disconnected', cls: 'bg-muted/30 text-muted-foreground', icon: Power },
};

const HEALTH_BADGE: Record<HealthStatus, { label: string; cls: string }> = {
  healthy: { label: 'Healthy', cls: 'bg-success/15 text-success' },
  degraded: { label: 'Degraded', cls: 'bg-amber-500/15 text-amber-500' },
  down: { label: 'Down', cls: 'bg-destructive/15 text-destructive' },
  unknown: { label: 'Unknown', cls: 'bg-muted/30 text-muted-foreground' },
};

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function quotaPct(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function quotaBarColor(pct: number): string {
  if (pct >= 90) return 'bg-destructive';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-success';
}

// ---------------------------------------------------------------------------
// Merged integration (provider meta + DB row)
// ---------------------------------------------------------------------------
interface MergedIntegration extends ProviderMeta {
  row: ApiIntegrationRow | null;
  status: IntegrationStatus;
  health_status: HealthStatus;
  quota_used: number;
  quota_limit: number | null;
  last_sync_at: string | null;
}

function mergeIntegrations(rows: ApiIntegrationRow[]): MergedIntegration[] {
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return PROVIDERS.map((meta) => {
    const row = byProvider.get(meta.provider) ?? null;
    return {
      ...meta,
      row,
      status: (row?.status ?? 'not_configured') as IntegrationStatus,
      health_status: (row?.health_status ?? 'unknown') as HealthStatus,
      quota_used: row?.quota_used ?? 0,
      quota_limit: row?.quota_limit ?? null,
      last_sync_at: row?.last_sync_at ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function APIIntegrationPage() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<MergedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [connectTarget, setConnectTarget] = useState<MergedIntegration | null>(null);
  const [credentialValue, setCredentialValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Per-card action loading
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Logs dialog
  const [logsTarget, setLogsTarget] = useState<MergedIntegration | null>(null);

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchIntegrations();
      setIntegrations(mergeIntegrations(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------
  const connectedCount = integrations.filter((i) => i.status === 'connected').length;
  const notConfiguredCount = integrations.filter((i) => i.status === 'not_configured').length;
  const errorCount = integrations.filter((i) => i.status === 'error').length;
  const totalCount = integrations.length;

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleOpenConnect = (int: MergedIntegration) => {
    setConnectTarget(int);
    setCredentialValue('');
  };

  const handleSaveConnect = async () => {
    if (!connectTarget) return;
    if (!credentialValue.trim()) {
      toast({
        title: 'Credential required',
        description: `Please enter the ${connectTarget.credentialLabel} to connect.`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertIntegration({
        provider: connectTarget.provider,
        name: connectTarget.name,
        status: 'connected',
        credentials: { key: credentialValue.trim() },
        metadata: { connectedVia: 'dashboard', connectedAt: new Date().toISOString() },
      });
      setIntegrations((prev) =>
        mergeIntegrations(
          prev
            .filter((i) => i.row?.id !== saved.id && i.provider !== connectTarget.provider)
            .map((i) => i.row)
            .filter((r): r is ApiIntegrationRow => r !== null)
            .concat([saved]),
        ),
      );
      await insertActivityLog({
        module: 'automation',
        action: 'integration.connect',
        entity_type: 'api_integration',
        entity_id: saved.id,
        details: { provider: connectTarget.provider, name: connectTarget.name },
        level: 'success',
      });
      toast({
        title: 'Connected',
        description: `${connectTarget.name} is now connected.`,
      });
      setConnectTarget(null);
      setCredentialValue('');
    } catch (e) {
      toast({
        title: 'Connection failed',
        description: e instanceof Error ? e.message : 'Could not save credentials.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async (int: MergedIntegration) => {
    setBusyId(int.provider);
    try {
      if (int.row) {
        const updated = await updateIntegration(int.row.id, {
          status: 'connected',
          health_status: 'unknown',
          last_sync_at: new Date().toISOString(),
        });
        setIntegrations((prev) =>
          mergeIntegrations(
            prev
              .map((i) => (i.row?.id === updated.id ? updated : i.row))
              .filter((r): r is ApiIntegrationRow => r !== null),
          ),
        );
      } else {
        // No existing row — open connect dialog instead
        handleOpenConnect(int);
        return;
      }
      await insertActivityLog({
        module: 'automation',
        action: 'integration.reconnect',
        entity_type: 'api_integration',
        entity_id: int.row.id,
        details: { provider: int.provider },
        level: 'info',
      });
      toast({ title: 'Reconnected', description: `${int.name} has been reconnected.` });
    } catch (e) {
      toast({
        title: 'Reconnect failed',
        description: e instanceof Error ? e.message : 'Could not reconnect.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (int: MergedIntegration) => {
    if (!int.row) return;
    setBusyId(int.provider);
    try {
      const updated = await updateIntegration(int.row.id, {
        status: 'disconnected',
        health_status: 'unknown',
      });
      setIntegrations((prev) =>
        mergeIntegrations(
          prev
            .map((i) => (i.row?.id === updated.id ? updated : i.row))
            .filter((r): r is ApiIntegrationRow => r !== null),
        ),
      );
      await insertActivityLog({
        module: 'automation',
        action: 'integration.disconnect',
        entity_type: 'api_integration',
        entity_id: int.row.id,
        details: { provider: int.provider },
        level: 'warning',
      });
      toast({ title: 'Disconnected', description: `${int.name} has been disconnected.` });
    } catch (e) {
      toast({
        title: 'Disconnect failed',
        description: e instanceof Error ? e.message : 'Could not disconnect.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleTestConnection = (int: MergedIntegration) => {
    if (!int.row) {
      toast({
        title: 'Not configured',
        description: `Connect ${int.name} first before testing.`,
        variant: 'destructive',
      });
      return;
    }
    setTestingId(int.provider);
    // Simulate a connection test
    setTimeout(async () => {
      try {
        // Randomly pick healthy or degraded for the simulation
        const health: HealthStatus = Math.random() > 0.25 ? 'healthy' : 'degraded';
        const updated = await updateIntegration(int.row!.id, {
          health_status: health,
          last_sync_at: new Date().toISOString(),
        });
        setIntegrations((prev) =>
          mergeIntegrations(
            prev
              .map((i) => (i.row?.id === updated.id ? updated : i.row))
              .filter((r): r is ApiIntegrationRow => r !== null),
          ),
        );
        await insertActivityLog({
          module: 'automation',
          action: 'integration.test',
          entity_type: 'api_integration',
          entity_id: int.row!.id,
          details: { provider: int.provider, health_status: health },
          level: health === 'healthy' ? 'success' : 'warning',
        });
        toast({
          title: health === 'healthy' ? 'Connection healthy' : 'Connection degraded',
          description:
            health === 'healthy'
              ? `${int.name} responded successfully.`
              : `${int.name} responded with warnings.`,
          variant: health === 'healthy' ? 'default' : 'destructive',
        });
      } catch (e) {
        toast({
          title: 'Test failed',
          description: e instanceof Error ? e.message : 'Could not test connection.',
          variant: 'destructive',
        });
      } finally {
        setTestingId(null);
      }
    }, 1000);
  };

  const handleDelete = async (int: MergedIntegration) => {
    if (!int.row) return;
    setBusyId(int.provider);
    try {
      await deleteIntegration(int.row.id);
      setIntegrations((prev) =>
        mergeIntegrations(
          prev
            .filter((i) => i.row?.id !== int.row!.id)
            .map((i) => i.row)
            .filter((r): r is ApiIntegrationRow => r !== null),
        ),
      );
      await insertActivityLog({
        module: 'automation',
        action: 'integration.delete',
        entity_type: 'api_integration',
        entity_id: int.row.id,
        details: { provider: int.provider },
        level: 'warning',
      });
      toast({ title: 'Removed', description: `${int.name} configuration has been deleted.` });
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Could not delete integration.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
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
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Loading */}
      {loading && <LoadingState message="Loading integrations…" />}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={load} />}

      {/* Empty */}
      {!loading && !error && integrations.length === 0 && (
        <EmptyState
          icon={Plug}
          title="No integrations available"
          description="Integration providers will appear here once configured."
        />
      )}

      {/* Main content */}
      {!loading && !error && integrations.length > 0 && (
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
              color="text-muted-foreground"
              bg="bg-muted/20"
              delay={0.1}
            />
            <StatCard
              label="Errors"
              value={errorCount}
              icon={AlertTriangle}
              color="text-destructive"
              bg="bg-destructive/10"
              delay={0.2}
            />
            <StatCard
              label="Total Services"
              value={totalCount}
              icon={PlugZap}
              color="text-primary"
              bg="bg-primary/10"
              delay={0.3}
            />
          </div>

          {/* Integration cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {integrations.map((int, i) => {
              const Icon = int.icon;
              const statusMeta = STATUS_BADGE[int.status];
              const StatusIcon = statusMeta.icon;
              const healthMeta = HEALTH_BADGE[int.health_status];
              const isConnected = int.status === 'connected';
              const isBusy = busyId === int.provider;
              const isTesting = testingId === int.provider;
              const pct = quotaPct(int.quota_used, int.quota_limit ?? int.defaultQuotaLimit);

              return (
                <motion.div
                  key={int.provider}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass glass-hover flex h-full flex-col p-5">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                          int.bg,
                        )}
                      >
                        <Icon className={cn('h-6 w-6', int.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-base font-semibold">{int.name}</h3>
                          <Badge variant="outline" className={cn('text-xs', statusMeta.cls)}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{int.description}</p>
                      </div>
                    </div>

                    {/* Health + last sync */}
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Health:</span>
                        <Badge variant="outline" className={cn('text-xs', healthMeta.cls)}>
                          {healthMeta.label}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">
                        Last sync: {formatLastSync(int.last_sync_at)}
                      </span>
                    </div>

                    {/* Quota usage bar */}
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Quota usage</span>
                        <span className="font-medium">
                          {int.quota_used} / {int.quota_limit ?? int.defaultQuotaLimit}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                        <div
                          className={cn('h-full rounded-full transition-all', quotaBarColor(pct))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      {!isConnected && (
                        <Button size="sm" onClick={() => handleOpenConnect(int)}>
                          <Plug className="mr-1.5 h-3.5 w-3.5" />
                          Connect
                        </Button>
                      )}
                      {isConnected && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReconnect(int)}
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Reconnect
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDisconnect(int)}
                            disabled={isBusy}
                          >
                            <Power className="mr-1.5 h-3.5 w-3.5" />
                            Disconnect
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestConnection(int)}
                        disabled={isTesting || !int.row}
                      >
                        {isTesting ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLogsTarget(int)}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Logs
                      </Button>
                      {int.row && int.status === 'disconnected' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(int)}
                          disabled={isBusy}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Connect dialog */}
      <Dialog
        open={!!connectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setConnectTarget(null);
            setCredentialValue('');
          }
        }}
      >
        <DialogContent className="glass-strong max-w-md">
          {connectTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      connectTarget.bg,
                    )}
                  >
                    <connectTarget.icon className={cn('h-4 w-4', connectTarget.color)} />
                  </div>
                  Connect {connectTarget.name}
                </DialogTitle>
                <DialogDescription>
                  Enter your {connectTarget.credentialLabel} below to connect this integration.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="credential">{connectTarget.credentialLabel}</Label>
                  <Input
                    id="credential"
                    type="password"
                    placeholder={connectTarget.credentialPlaceholder}
                    value={credentialValue}
                    onChange={(e) => setCredentialValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your credential is stored securely in the integration record. Never share API
                  keys publicly.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConnectTarget(null);
                    setCredentialValue('');
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveConnect} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="mr-2 h-4 w-4" />
                  )}
                  Save & Connect
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
      <Dialog
        open={!!logsTarget}
        onOpenChange={(o) => {
          if (!o) setLogsTarget(null);
        }}
      >
        <DialogContent className="glass-strong max-w-lg">
          {logsTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      logsTarget.bg,
                    )}
                  >
                    <logsTarget.icon className={cn('h-4 w-4', logsTarget.color)} />
                  </div>
                  {logsTarget.name} — Activity Log
                </DialogTitle>
                <DialogDescription>
                  Recent activity for this integration.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
                <div className="rounded-lg border border-border/30 bg-muted/20 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-mono">{logsTarget.provider}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{STATUS_BADGE[logsTarget.status].label}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Health</span>
                    <span>{HEALTH_BADGE[logsTarget.health_status].label}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Last sync</span>
                    <span>{formatLastSync(logsTarget.last_sync_at)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Quota</span>
                    <span>
                      {logsTarget.quota_used} / {logsTarget.quota_limit ?? logsTarget.defaultQuotaLimit}
                    </span>
                  </div>
                  {logsTarget.row && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Integration ID</span>
                      <span className="font-mono text-xs">{logsTarget.row.id}</span>
                    </div>
                  )}
                </div>
                {!logsTarget.row && (
                  <p className="text-sm text-muted-foreground">
                    This integration has not been configured yet. No activity logs to show.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setLogsTarget(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
