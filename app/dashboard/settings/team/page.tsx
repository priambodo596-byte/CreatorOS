'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  Mail,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  fetchTeamMembers,
  insertTeamMember,
  updateTeamMember,
  deleteTeamMember,
  insertAuditLog,
  insertActivityLog,
  type TeamMemberRow,
} from '@/lib/automation';

// ─── Constants ────────────────────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'member';
type Status = 'active' | 'pending' | 'suspended';

const ROLES: Role[] = ['owner', 'admin', 'editor', 'viewer', 'member'];

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  admin: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  editor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  viewer: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  member: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const STATUS_BADGE: Record<Status, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviting, setInviting] = useState(false);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<TeamMemberRow | null>(null);
  const [removing, setRemoving] = useState(false);

  // Per-row action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ── Load ──
  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // ── Stats ──
  const stats = useMemo(() => {
    const counts = { active: 0, pending: 0, suspended: 0 } as Record<Status, number>;
    for (const m of members) counts[m.status] = (counts[m.status] ?? 0) + 1;
    return {
      total: members.length,
      active: counts.active ?? 0,
      pending: counts.pending ?? 0,
      suspended: counts.suspended ?? 0,
    };
  }, [members]);

  // ── Invite ──
  const handleInvite = useCallback(async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter a valid email.', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === email)) {
      toast({ title: 'Already invited', description: 'That email is already on the team.', variant: 'destructive' });
      return;
    }

    setInviting(true);
    try {
      const created = await insertTeamMember({ email, role: inviteRole });
      setMembers((prev) => [created, ...prev]);

      await insertAuditLog({
        action: 'team.member.invite',
        entity_type: 'team_member',
        entity_id: created.id,
        before_state: undefined,
        after_state: { email, role: inviteRole, status: 'pending' } as Record<string, unknown>,
      });
      await insertActivityLog({
        module: 'team',
        action: 'Invited team member',
        entity_type: 'team_member',
        entity_id: created.id,
        details: { email, role: inviteRole },
        level: 'info',
      });

      toast({
        title: 'Invitation sent',
        description: `${email} has been invited as ${inviteRole}.`,
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (e) {
      toast({
        title: 'Invite failed',
        description: e instanceof Error ? e.message : 'Could not send invite.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteRole, members, toast]);

  // ── Change Role ──
  const handleChangeRole = useCallback(
    async (member: TeamMemberRow, newRole: Role) => {
      if (newRole === member.role) return;
      setActionLoadingId(member.id);
      const before = { role: member.role } as Record<string, unknown>;
      try {
        const updated = await updateTeamMember(member.id, { role: newRole });
        setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));

        await insertAuditLog({
          action: 'team.member.role_change',
          entity_type: 'team_member',
          entity_id: member.id,
          before_state: before,
          after_state: { role: newRole } as Record<string, unknown>,
        });
        await insertActivityLog({
          module: 'team',
          action: `Changed role to ${newRole}`,
          entity_type: 'team_member',
          entity_id: member.id,
          details: { from: member.role, to: newRole },
          level: 'info',
        });

        toast({
          title: 'Role updated',
          description: `${member.email} is now ${newRole}.`,
        });
      } catch (e) {
        toast({
          title: 'Role change failed',
          description: e instanceof Error ? e.message : 'Could not update role.',
          variant: 'destructive',
        });
      } finally {
        setActionLoadingId(null);
      }
    },
    [toast],
  );

  // ── Change Status ──
  const handleChangeStatus = useCallback(
    async (member: TeamMemberRow, newStatus: Status) => {
      if (newStatus === member.status) return;
      setActionLoadingId(member.id);
      const before = { status: member.status } as Record<string, unknown>;
      try {
        const updated = await updateTeamMember(member.id, { status: newStatus });
        setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));

        await insertAuditLog({
          action: `team.member.${newStatus === 'suspended' ? 'suspend' : 'activate'}`,
          entity_type: 'team_member',
          entity_id: member.id,
          before_state: before,
          after_state: { status: newStatus } as Record<string, unknown>,
        });
        await insertActivityLog({
          module: 'team',
          action: newStatus === 'suspended' ? 'Suspended member' : 'Activated member',
          entity_type: 'team_member',
          entity_id: member.id,
          details: { from: member.status, to: newStatus },
          level: newStatus === 'suspended' ? 'warning' : 'success',
        });

        toast({
          title: 'Status updated',
          description: `${member.email} is now ${newStatus}.`,
        });
      } catch (e) {
        toast({
          title: 'Status change failed',
          description: e instanceof Error ? e.message : 'Could not update status.',
          variant: 'destructive',
        });
      } finally {
        setActionLoadingId(null);
      }
    },
    [toast],
  );

  // ── Remove ──
  const handleRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const target = removeTarget;
    try {
      await deleteTeamMember(target.id);
      setMembers((prev) => prev.filter((m) => m.id !== target.id));

      await insertAuditLog({
        action: 'team.member.remove',
        entity_type: 'team_member',
        entity_id: target.id,
        before_state: {
          email: target.email,
          role: target.role,
          status: target.status,
        } as Record<string, unknown>,
        after_state: undefined,
      });
      await insertActivityLog({
        module: 'team',
        action: 'Removed team member',
        entity_type: 'team_member',
        entity_id: target.id,
        details: { email: target.email },
        level: 'warning',
      });

      toast({
        title: 'Member removed',
        description: `${target.email} has been removed from the team.`,
      });
      setRemoveTarget(null);
    } catch (e) {
      toast({
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Could not remove member.',
        variant: 'destructive',
      });
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, toast]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Invite teammates, manage roles, and control access to your workspace."
        actions={
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={stats.total}
          icon={Users}
          color="text-primary"
          bg="bg-primary/10"
          delay={0}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          delay={0.05}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          color="text-amber-400"
          bg="bg-amber-500/10"
          delay={0.1}
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          icon={Ban}
          color="text-red-400"
          bg="bg-red-500/10"
          delay={0.15}
        />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading team members..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadMembers} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Invite your first teammate to start collaborating."
          action={
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          }
        />
      ) : (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table (md+) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Invited</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const isRowLoading = actionLoadingId === m.id;
                    return (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{m.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className={cn('capitalize', ROLE_BADGE[m.role])}
                          >
                            {m.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className={cn('capitalize', STATUS_BADGE[m.status])}
                          >
                            {m.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(m.invited_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={cn(
                              'flex items-center justify-end gap-2',
                              isRowLoading && 'pointer-events-none opacity-50',
                            )}
                          >
                            <Select
                              value={m.role}
                              onValueChange={(v) => handleChangeRole(m, v as Role)}
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r} className="capitalize">
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={m.status}
                              onValueChange={(v) =>
                                handleChangeStatus(m, v as Status)
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">active</SelectItem>
                                <SelectItem value="suspended">suspended</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setRemoveTarget(m)}
                              aria-label="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card grid (mobile) */}
            <div className="space-y-3 p-4 md:hidden">
              {members.map((m, idx) => {
                const isRowLoading = actionLoadingId === m.id;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      'rounded-lg border border-border/40 p-4',
                      isRowLoading && 'opacity-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{m.email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveTarget(m)}
                        aria-label="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('capitalize', ROLE_BADGE[m.role])}
                      >
                        {m.role}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', STATUS_BADGE[m.status])}
                      >
                        {m.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.invited_at)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleChangeRole(m, v as Role)}
                        disabled={isRowLoading}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="capitalize">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={m.status}
                        onValueChange={(v) => handleChangeStatus(m, v as Status)}
                        disabled={isRowLoading}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="suspended">suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join your workspace. They will start with a
              pending status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInvite();
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as Role)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      <span className="flex items-center gap-2 capitalize">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        {r}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              {inviting ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove Team Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">
                {removeTarget?.email}
              </span>{' '}
              from the team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
              className="gap-2"
            >
              {removing ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
