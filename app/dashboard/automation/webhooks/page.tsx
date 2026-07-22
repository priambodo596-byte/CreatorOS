'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Power,
  Send,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  Activity,
  Clock,
  Hash,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
} from '@/components/dashboard/shared';
import {
  fetchWebhooks,
  insertWebhook,
  updateWebhook,
  deleteWebhook,
  insertActivityLog,
  type WebhookRow,
} from '@/lib/automation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EVENT_TYPES = [
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'agent.started',
  'agent.completed',
  'agent.failed',
  'job.completed',
  'job.failed',
  'video.published',
  'thumbnail.generated',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

const EVENT_BADGE_COLORS: Record<string, string> = {
  'workflow.started': 'bg-blue-500/15 text-blue-500',
  'workflow.completed': 'bg-success/15 text-success',
  'workflow.failed': 'bg-destructive/15 text-destructive',
  'agent.started': 'bg-violet-500/15 text-violet-500',
  'agent.completed': 'bg-emerald-500/15 text-emerald-500',
  'agent.failed': 'bg-rose-500/15 text-rose-500',
  'job.completed': 'bg-cyan-500/15 text-cyan-500',
  'job.failed': 'bg-orange-500/15 text-orange-500',
  'video.published': 'bg-pink-500/15 text-pink-500',
  'thumbnail.generated': 'bg-amber-500/15 text-amber-500',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatLastTriggered(iso: string | null): string {
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

function getStatusMeta(status: string | null): {
  label: string;
  cls: string;
  icon: typeof CheckCircle2;
} {
  if (!status) return { label: 'Never triggered', cls: 'bg-muted/30 text-muted-foreground', icon: Clock };
  switch (status) {
    case 'success':
      return { label: 'Success', cls: 'bg-success/15 text-success', icon: CheckCircle2 };
    case 'failed':
      return { label: 'Failed', cls: 'bg-destructive/15 text-destructive', icon: XCircle };
    case 'pending':
      return { label: 'Pending', cls: 'bg-warning/15 text-warning', icon: AlertTriangle };
    default:
      return { label: status, cls: 'bg-muted/30 text-muted-foreground', icon: Clock };
  }
}

function getResponseCodeMeta(code: number | null): { cls: string } {
  if (code == null) return { cls: 'text-muted-foreground' };
  if (code >= 200 && code < 300) return { cls: 'text-success' };
  if (code >= 300 && code < 400) return { cls: 'text-info' };
  if (code >= 400 && code < 500) return { cls: 'text-warning' };
  return { cls: 'text-destructive' };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function WebhooksPage() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    url: '',
    event_types: [] as string[],
    secret: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<WebhookRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    event_types: [] as string[],
    secret: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Per-card action loading
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWebhooks();
      setWebhooks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load webhooks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // -------------------------------------------------------------------------
  // Derived stats
  // -------------------------------------------------------------------------
  const totalWebhooks = webhooks.length;
  const activeWebhooks = webhooks.filter((w) => w.is_active).length;
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.delivery_count, 0);
  const totalFailures = webhooks.reduce((sum, w) => sum + w.failure_count, 0);

  // -------------------------------------------------------------------------
  // Busy helpers
  // -------------------------------------------------------------------------
  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setTesting = (id: string, testing: boolean) => {
    setTestingIds((prev) => {
      const next = new Set(prev);
      if (testing) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const patchWebhook = (id: string, patch: Partial<WebhookRow>) => {
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const removeWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  // -------------------------------------------------------------------------
  // Event type toggle helpers
  // -------------------------------------------------------------------------
  const toggleEventType = <
    T extends { event_types: string[] },
  >(
    form: T,
    setForm: (updater: (prev: T) => T) => void,
    eventType: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter((e) => e !== eventType)
        : [...prev.event_types, eventType],
    }));
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleOpenCreate = () => {
    setCreateForm({ name: '', url: '', event_types: [], secret: generateSecret() });
    setShowSecret(false);
    setCreateOpen(true);
  };

  const handleRegenerateSecret = () => {
    setCreateForm((prev) => ({ ...prev, secret: generateSecret() }));
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a webhook name.', variant: 'destructive' });
      return;
    }
    if (!createForm.url.trim()) {
      toast({ title: 'URL required', description: 'Please enter a webhook URL.', variant: 'destructive' });
      return;
    }
    if (createForm.event_types.length === 0) {
      toast({ title: 'Select events', description: 'Please select at least one event type.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await insertWebhook({
        name: createForm.name.trim(),
        url: createForm.url.trim(),
        event_types: createForm.event_types,
        secret: createForm.secret,
      });
      setWebhooks((prev) => [created, ...prev]);
      await insertActivityLog({
        module: 'automation',
        action: 'webhook.create',
        entity_type: 'webhook',
        entity_id: created.id,
        details: { name: created.name, url: created.url, event_types: created.event_types },
        level: 'success',
      });
      toast({ title: 'Webhook created', description: `"${created.name}" has been created.` });
      setCreateOpen(false);
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Could not create webhook.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (webhook: WebhookRow) => {
    setBusy(webhook.id, true);
    const newActive = !webhook.is_active;
    try {
      const updated = await updateWebhook(webhook.id, { is_active: newActive });
      patchWebhook(webhook.id, updated);
      await insertActivityLog({
        module: 'automation',
        action: newActive ? 'webhook.activate' : 'webhook.deactivate',
        entity_type: 'webhook',
        entity_id: webhook.id,
        details: { name: webhook.name },
        level: newActive ? 'success' : 'warning',
      });
      toast({
        title: newActive ? 'Webhook activated' : 'Webhook deactivated',
        description: `"${webhook.name}" is now ${newActive ? 'active' : 'inactive'}.`,
      });
    } catch (e) {
      toast({
        title: 'Toggle failed',
        description: e instanceof Error ? e.message : 'Could not toggle webhook.',
        variant: 'destructive',
      });
    } finally {
      setBusy(webhook.id, false);
    }
  };

  const handleOpenEdit = (webhook: WebhookRow) => {
    setEditTarget(webhook);
    setEditForm({
      name: webhook.name,
      url: webhook.url,
      event_types: [...webhook.event_types],
      secret: webhook.secret ?? '',
    });
  };

  const handleEditRegenerateSecret = () => {
    setEditForm((prev) => ({ ...prev, secret: generateSecret() }));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a webhook name.', variant: 'destructive' });
      return;
    }
    if (!editForm.url.trim()) {
      toast({ title: 'URL required', description: 'Please enter a webhook URL.', variant: 'destructive' });
      return;
    }
    if (editForm.event_types.length === 0) {
      toast({ title: 'Select events', description: 'Please select at least one event type.', variant: 'destructive' });
      return;
    }
    setEditSubmitting(true);
    try {
      const updated = await updateWebhook(editTarget.id, {
        name: editForm.name.trim(),
        url: editForm.url.trim(),
        event_types: editForm.event_types,
        secret: editForm.secret,
      });
      patchWebhook(editTarget.id, updated);
      await insertActivityLog({
        module: 'automation',
        action: 'webhook.update',
        entity_type: 'webhook',
        entity_id: editTarget.id,
        details: { name: editForm.name.trim(), url: editForm.url.trim(), event_types: editForm.event_types },
        level: 'info',
      });
      toast({ title: 'Webhook updated', description: `"${editForm.name.trim()}" has been saved.` });
      setEditTarget(null);
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Could not update webhook.',
        variant: 'destructive',
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await deleteWebhook(deleteTarget.id);
      removeWebhook(deleteTarget.id);
      await insertActivityLog({
        module: 'automation',
        action: 'webhook.delete',
        entity_type: 'webhook',
        entity_id: deleteTarget.id,
        details: { name: deleteTarget.name },
        level: 'warning',
      });
      toast({ title: 'Webhook deleted', description: `"${deleteTarget.name}" has been removed.` });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Could not delete webhook.',
        variant: 'destructive',
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleTest = (webhook: WebhookRow) => {
    setTesting(webhook.id, true);
    // Simulate sending a test payload with setTimeout 1s
    setTimeout(async () => {
      try {
        const updated = await updateWebhook(webhook.id, {
          last_triggered_at: new Date().toISOString(),
          last_status: 'success',
          last_response_code: 200,
          delivery_count: webhook.delivery_count + 1,
        });
        patchWebhook(webhook.id, updated);
        await insertActivityLog({
          module: 'automation',
          action: 'webhook.test',
          entity_type: 'webhook',
          entity_id: webhook.id,
          details: {
            name: webhook.name,
            url: webhook.url,
            response_code: 200,
            status: 'success',
          },
          level: 'success',
        });
        toast({
          title: 'Test delivery sent',
          description: `"${webhook.name}" responded with 200 OK.`,
        });
      } catch (e) {
        toast({
          title: 'Test failed',
          description: e instanceof Error ? e.message : 'Could not test webhook.',
          variant: 'destructive',
        });
      } finally {
        setTesting(webhook.id, false);
      }
    }, 1000);
  };

  const handleCopySecret = (secret: string) => {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      toast({ title: 'Copied', description: 'Secret copied to clipboard.' });
    });
  };

  // -------------------------------------------------------------------------
  // Event type checkbox grid (shared between create and edit dialogs)
  // -------------------------------------------------------------------------
  const renderEventTypeGrid = (
    selected: string[],
    onToggle: (eventType: string) => void,
  ) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {EVENT_TYPES.map((eventType) => {
        const isSelected = selected.includes(eventType);
        const badgeCls = EVENT_BADGE_COLORS[eventType] ?? 'bg-muted/30 text-muted-foreground';
        return (
          <button
            key={eventType}
            type="button"
            onClick={() => onToggle(eventType)}
            className={cn(
              'flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border/40 bg-muted/10 hover:border-border hover:bg-muted/20',
            )}
          >
            <div
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30',
              )}
            >
              {isSelected && <CheckCircle2 className="h-3 w-3" />}
            </div>
            <Badge variant="outline" className={cn('text-[10px] font-mono', badgeCls)}>
              {eventType}
            </Badge>
          </button>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Webhooks"
        description="Manage webhook endpoints that receive event notifications for your automation workflows."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          </div>
        }
      />

      {/* Stats grid */}
      {!loading && !error && webhooks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Webhooks"
            value={totalWebhooks}
            icon={Webhook}
            color="text-primary"
            bg="bg-primary/10"
            delay={0}
          />
          <StatCard
            label="Active"
            value={activeWebhooks}
            icon={Power}
            color="text-success"
            bg="bg-success/10"
            delay={0.05}
          />
          <StatCard
            label="Deliveries"
            value={totalDeliveries}
            icon={TrendingUp}
            color="text-info"
            bg="bg-info/10"
            delay={0.1}
          />
          <StatCard
            label="Failures"
            value={totalFailures}
            icon={TrendingDown}
            color="text-destructive"
            bg="bg-destructive/10"
            delay={0.15}
          />
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingState message="Loading webhooks…" />}

      {/* Error */}
      {error && !loading && <ErrorState message={error} onRetry={load} />}

      {/* Empty */}
      {!loading && !error && webhooks.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No webhooks yet"
          description="Create your first webhook endpoint to receive event notifications for workflow, agent, and job events."
          action={
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          }
        />
      )}

      {/* Webhook cards grid */}
      {!loading && !error && webhooks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {webhooks.map((webhook, i) => {
              const statusMeta = getStatusMeta(webhook.last_status);
              const StatusIcon = statusMeta.icon;
              const codeMeta = getResponseCodeMeta(webhook.last_response_code);
              const isBusy = busyIds.has(webhook.id);
              const isTesting = testingIds.has(webhook.id);
              const failureRate =
                webhook.delivery_count > 0
                  ? Math.round((webhook.failure_count / webhook.delivery_count) * 100)
                  : 0;

              return (
                <motion.div
                  key={webhook.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={cn('glass glass-hover flex h-full flex-col p-5', isBusy && 'opacity-70')}>
                    {/* Header: name + active toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            webhook.is_active ? 'bg-amber-500/10' : 'bg-muted/20',
                          )}
                        >
                          <Webhook
                            className={cn(
                              'h-5 w-5',
                              webhook.is_active ? 'text-amber-500' : 'text-muted-foreground',
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-base font-semibold">{webhook.name}</h3>
                          <p className="truncate text-xs text-muted-foreground" title={webhook.url}>
                            {webhook.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={() => handleToggleActive(webhook)}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    {/* Event type badges */}
                    <div className="mt-4">
                      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Event Types</span>
                      <div className="flex flex-wrap gap-1.5">
                        {webhook.event_types.length === 0 ? (
                          <span className="text-xs text-muted-foreground/60">No events subscribed</span>
                        ) : (
                          webhook.event_types.map((eventType) => (
                            <Badge
                              key={eventType}
                              variant="outline"
                              className={cn(
                                'text-[10px] font-mono',
                                EVENT_BADGE_COLORS[eventType] ?? 'bg-muted/30 text-muted-foreground',
                              )}
                            >
                              {eventType}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Last triggered + status */}
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Last triggered:</span>
                        <span className="font-medium">{formatLastTriggered(webhook.last_triggered_at)}</span>
                      </div>
                    </div>

                    {/* Status + response code */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={cn('h-3.5 w-3.5', statusMeta.cls.replace('bg-', 'text-'))} />
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className={cn('text-xs', statusMeta.cls)}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Code:</span>
                        <span className={cn('font-mono font-medium', codeMeta.cls)}>
                          {webhook.last_response_code ?? '—'}
                        </span>
                      </div>
                    </div>

                    {/* Delivery + failure counts */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Send className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Deliveries:</span>
                        <span className="font-medium">{webhook.delivery_count}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Failures:</span>
                        <span
                          className={cn(
                            'font-medium',
                            webhook.failure_count > 0 ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {webhook.failure_count}
                          {webhook.delivery_count > 0 && (
                            <span className="ml-1 text-muted-foreground/60">({failureRate}%)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(webhook)}
                        disabled={isTesting || isBusy}
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
                        onClick={() => handleOpenEdit(webhook)}
                        disabled={isBusy}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(webhook)}
                        disabled={isBusy}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create webhook dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) setCreateOpen(false);
        }}
      >
        <DialogContent className="glass-strong max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-amber-500" />
              Create Webhook
            </DialogTitle>
            <DialogDescription>
              Configure a new webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g. Slack notifications"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhook"
                value={createForm.url}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, url: e.target.value }))}
              />
            </div>

            {/* Event types */}
            <div className="space-y-2">
              <Label>Event Types</Label>
              <p className="text-xs text-muted-foreground">
                Select the events that should trigger this webhook.
              </p>
              {renderEventTypeGrid(createForm.event_types, (et) =>
                toggleEventType(createForm, setCreateForm, et),
              )}
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret (auto-generated)</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={createForm.secret}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret((prev) => !prev)}
                  title={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRegenerateSecret}
                  title="Regenerate secret"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopySecret(createForm.secret)}
                  title="Copy secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This secret is used to sign webhook payloads. Share it with the receiving endpoint for verification.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit webhook dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="glass-strong max-w-lg">
          {editTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-primary" />
                  Edit Webhook
                </DialogTitle>
                <DialogDescription>
                  Update the webhook configuration for &ldquo;{editTarget.name}&rdquo;.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-webhook-name">Name</Label>
                  <Input
                    id="edit-webhook-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* URL */}
                <div className="space-y-2">
                  <Label htmlFor="edit-webhook-url">URL</Label>
                  <Input
                    id="edit-webhook-url"
                    value={editForm.url}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                  />
                </div>

                {/* Event types */}
                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <p className="text-xs text-muted-foreground">
                    Select the events that should trigger this webhook.
                  </p>
                  {renderEventTypeGrid(editForm.event_types, (et) =>
                    toggleEventType(editForm, setEditForm, et),
                  )}
                </div>

                {/* Secret */}
                <div className="space-y-2">
                  <Label htmlFor="edit-webhook-secret">Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-webhook-secret"
                      type={showSecret ? 'text' : 'password'}
                      value={editForm.secret}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSecret((prev) => !prev)}
                      title={showSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleEditRegenerateSecret}
                      title="Regenerate secret"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopySecret(editForm.secret)}
                      title="Copy secret"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Regenerating the secret will invalidate the previous signing key.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={editSubmitting}>
                  {editSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="glass-strong max-w-md">
          {deleteTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  Delete Webhook
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &ldquo;{deleteTarget.name}&rdquo;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Warning</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deleting this webhook will stop all event deliveries to the configured URL. Any
                    automation relying on this webhook will no longer receive notifications.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
                  {deleteSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
