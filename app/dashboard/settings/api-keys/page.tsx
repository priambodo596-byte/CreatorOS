'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
} from '@/components/dashboard/shared';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  fetchApiKeys,
  insertApiKey,
  deleteApiKey,
  insertAuditLog,
  insertActivityLog,
  type ApiKeyRow,
} from '@/lib/automation';

// ─── helpers ────────────────────────────────────────────────────────────────

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return 'never used';
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // reveal dialog (shown once after creation)
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [copiedReveal, setCopiedReveal] = useState(false);

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // per-row copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApiKeys();
      setKeys(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now();
    const active = keys.filter(
      (k) => k.last_used_at && now - new Date(k.last_used_at).getTime() <= THIRTY_DAYS,
    ).length;
    const unused = keys.filter((k) => !k.last_used_at).length;
    const recent = keys.filter(
      (k) => now - new Date(k.created_at).getTime() <= SEVEN_DAYS,
    ).length;
    return { total: keys.length, active, unused, recent };
  }, [keys]);

  // ─── create ──────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: 'Name required', description: 'Please provide a name for the API key.' });
      return;
    }
    setCreating(true);
    try {
      const { key, row } = await insertApiKey(name);
      setKeys((prev) => [row, ...prev]);
      setRevealedKey(key);
      setRevealedName(name);
      setAcknowledged(false);
      setCopiedReveal(false);
      setCreateOpen(false);
      setNewName('');

      try {
        await insertAuditLog({
          action: 'api_key.create',
          entity_type: 'api_key',
          entity_id: row.id,
          after_state: { name: row.name, key_prefix: row.key_prefix },
        });
      } catch {
        /* non-fatal */
      }
      try {
        await insertActivityLog({
          module: 'settings',
          action: 'api_key.create',
          entity_type: 'api_key',
          entity_id: row.id,
          details: { name: row.name, key_prefix: row.key_prefix },
          level: 'info',
        });
      } catch {
        /* non-fatal */
      }

      toast({ title: 'API key created', description: 'Copy it now — it will not be shown again.' });
    } catch (e) {
      toast({
        title: 'Failed to create key',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }, [newName, toast]);

  // ─── delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteApiKey(deleteTarget.id);
      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));

      try {
        await insertAuditLog({
          action: 'api_key.delete',
          entity_type: 'api_key',
          entity_id: deleteTarget.id,
          before_state: { name: deleteTarget.name, key_prefix: deleteTarget.key_prefix },
        });
      } catch {
        /* non-fatal */
      }
      try {
        await insertActivityLog({
          module: 'settings',
          action: 'api_key.delete',
          entity_type: 'api_key',
          entity_id: deleteTarget.id,
          details: { name: deleteTarget.name },
          level: 'warning',
        });
      } catch {
        /* non-fatal */
      }

      toast({ title: 'API key revoked', description: `"${deleteTarget.name}" was deleted.` });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: 'Failed to delete key',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, toast]);

  // ─── copy helpers ──────────────────────────────────────────────────────────
  const copyText = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
      return true;
    } catch {
      return false;
    }
  }, []);

  const copyRevealed = useCallback(async () => {
    if (!revealedKey) return;
    const ok = await copyText(revealedKey, '__reveal__');
    if (ok) {
      setCopiedReveal(true);
      setTimeout(() => setCopiedReveal(false), 2000);
    }
  }, [revealedKey, copyText]);

  const closeReveal = useCallback(() => {
    if (!acknowledged) return;
    setRevealedKey(null);
    setRevealedName('');
    setAcknowledged(false);
    setCopiedReveal(false);
  }, [acknowledged]);

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage API keys used to access the automation API programmatically."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Keys"
          value={stats.total}
          icon={KeyRound}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Active (30d)"
          value={stats.active}
          icon={Check}
          color="text-emerald-500"
          bg="bg-emerald-500/10"
          delay={0.05}
        />
        <StatCard
          label="Unused"
          value={stats.unused}
          icon={Clock}
          color="text-amber-500"
          bg="bg-amber-500/10"
          delay={0.1}
        />
        <StatCard
          label="Recently Created (7d)"
          value={stats.recent}
          icon={Plus}
          color="text-sky-500"
          bg="bg-sky-500/10"
          delay={0.15}
        />
      </div>

      {/* content */}
      {loading ? (
        <LoadingState message="Loading API keys..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create your first API key to start authenticating automation requests."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          }
        />
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Key</th>
                    <th className="px-4 py-3 font-medium">Last Used</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k, i) => {
                    const isActive =
                      k.last_used_at &&
                      Date.now() - new Date(k.last_used_at).getTime() <= THIRTY_DAYS;
                    return (
                      <motion.tr
                        key={k.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b last:border-0 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium">{k.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                              {k.key_prefix}
                              <span className="text-muted-foreground">...</span>
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyText(k.key_prefix, k.id)}
                              title="Copy key prefix"
                            >
                              {copiedId === k.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-normal',
                                isActive
                                  ? 'border-emerald-500/30 text-emerald-600'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {relativeFromNow(k.last_used_at)}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(k.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(k)}
                            title="Delete key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give this key a descriptive name so you can identify it later. The full key value will
              be shown only once after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              placeholder="e.g. Production automation"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* reveal dialog — shown once after creation */}
      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => {
          if (!open) closeReveal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Your new API key
            </DialogTitle>
            <DialogDescription>
              This is the only time the full key for <strong>{revealedName}</strong> will be shown.
              Copy it now and store it somewhere safe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* warning */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                You will <strong>not</strong> be able to see this key again. If you lose it, you will
                need to create a new one and update any integrations using it.
              </p>
            </div>

            {/* key value + copy */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs">
                  {revealedKey}
                </code>
                <Button onClick={copyRevealed} variant="default" size="sm">
                  {copiedReveal ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* acknowledge */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span>I have copied and securely stored this key.</span>
            </label>
          </div>

          <DialogFooter>
            <Button onClick={closeReveal} disabled={!acknowledged} variant="default">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the key <strong>{deleteTarget?.name}</strong>? Any
              integrations using it will stop working immediately. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
