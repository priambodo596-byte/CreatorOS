'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  History,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Brain,
  TrendingUp,
  Image as ImageIcon,
  FileText,
  Users,
  Video,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  fetchAgents,
  insertAgent,
  updateAgent,
  deleteAgent,
  fetchAgentRuns,
  insertAgentRun,
  updateAgentRun,
  deleteAgentRun,
  insertActivityLog,
  type AIAgentRow,
  type AgentRunRow,
} from '@/lib/automation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type AgentType =
  | 'research'
  | 'script_generation'
  | 'competitor_analysis'
  | 'thumbnail_generation'
  | 'seo_optimization'
  | 'shorts_generation'
  | 'video_publishing'
  | 'analytics_analysis'
  | 'improvement_recommendation';

type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

const AGENT_TYPES: { value: AgentType; label: string; icon: typeof Bot; color: string; bg: string }[] = [
  { value: 'research', label: 'Research', icon: Search, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'script_generation', label: 'Script Generation', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { value: 'competitor_analysis', label: 'Competitor Analysis', icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { value: 'thumbnail_generation', label: 'Thumbnail Generation', icon: ImageIcon, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { value: 'seo_optimization', label: 'SEO Optimization', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
  { value: 'shorts_generation', label: 'Shorts Generation', icon: Video, color: 'text-red-500', bg: 'bg-red-500/10' },
  { value: 'video_publishing', label: 'Video Publishing', icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { value: 'analytics_analysis', label: 'Analytics Analysis', icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { value: 'improvement_recommendation', label: 'Improvement Recommendation', icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
];

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; dot: string }> = {
  idle: { label: 'Idle', color: 'text-muted-foreground', bg: 'bg-muted/20', dot: 'bg-muted-foreground' },
  running: { label: 'Running', color: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  paused: { label: 'Paused', color: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  stopped: { label: 'Stopped', color: 'text-muted-foreground', bg: 'bg-muted/20', dot: 'bg-muted-foreground' },
  error: { label: 'Error', color: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
};

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground', icon: Clock },
  running: { label: 'Running', color: 'text-blue-500', icon: Loader2 },
  completed: { label: 'Completed', color: 'text-success', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-destructive', icon: AlertCircle },
  stopped: { label: 'Stopped', color: 'text-muted-foreground', icon: Square },
};

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'every 1h', label: 'Every 1 hour' },
  { value: 'every 6h', label: 'Every 6 hours' },
  { value: 'every 24h', label: 'Every 24 hours' },
  { value: 'every 7d', label: 'Every 7 days' },
];

function getAgentTypeMeta(type: string) {
  return AGENT_TYPES.find((t) => t.value === type) ?? AGENT_TYPES[0];
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AutomationAgentPage() {
  const { toast } = useToast();

  const [agents, setAgents] = useState<AIAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'research' as AgentType,
    description: '',
    schedule: 'manual',
  });
  const [creating, setCreating] = useState(false);

  // History dialog state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAgent, setHistoryAgent] = useState<AIAgentRow | null>(null);
  const [historyRuns, setHistoryRuns] = useState<AgentRunRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Active simulation intervals — keyed by agent id
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // ── Load agents ──────────────────────────────────────────────────────────
  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    return () => {
      // cleanup all intervals on unmount
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, [loadAgents]);

  // ── Create agent ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter an agent name.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const agent = await insertAgent({
        name: createForm.name.trim(),
        type: createForm.type,
        description: createForm.description.trim(),
        schedule: createForm.schedule,
      });
      setAgents((prev) => [agent, ...prev]);
      await insertActivityLog({
        module: 'automation',
        action: 'agent_created',
        entity_type: 'ai_agent',
        entity_id: agent.id,
        details: { name: agent.name, type: agent.type },
        level: 'info',
      });
      toast({ title: 'Agent created', description: `"${agent.name}" is ready.` });
      setCreateOpen(false);
      setCreateForm({ name: '', type: 'research', description: '', schedule: 'manual' });
    } catch (e: any) {
      toast({ title: 'Failed to create agent', description: e?.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ── Delete agent ─────────────────────────────────────────────────────────
  const handleDelete = async (agent: AIAgentRow) => {
    // stop any running simulation
    if (intervalsRef.current[agent.id]) {
      clearInterval(intervalsRef.current[agent.id]);
      delete intervalsRef.current[agent.id];
    }
    try {
      await deleteAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      await insertActivityLog({
        module: 'automation',
        action: 'agent_deleted',
        entity_type: 'ai_agent',
        entity_id: agent.id,
        details: { name: agent.name },
        level: 'warning',
      });
      toast({ title: 'Agent deleted', description: `"${agent.name}" was removed.` });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  // ── Start agent ──────────────────────────────────────────────────────────
  const handleStart = async (agent: AIAgentRow) => {
    if (agent.status === 'running') return;
    const task = `${getAgentTypeMeta(agent.type).label} execution`;
    const startedAt = new Date().toISOString();
    try {
      // update agent to running
      const updated = await updateAgent(agent.id, {
        status: 'running',
        current_task: task,
        progress: 0,
      });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));

      // insert agent run
      const run = await insertAgentRun({
        agent_id: agent.id,
        status: 'running',
        task,
        started_at: startedAt,
      });

      toast({ title: 'Agent started', description: `"${agent.name}" is now running.` });

      // simulate progress
      const runId = run.id;
      const startTime = Date.now();
      intervalsRef.current[agent.id] = setInterval(async () => {
        setAgents((prev) =>
          prev.map((a) => {
            if (a.id !== agent.id) return a;
            const next = Math.min(a.progress + 10, 100);
            return { ...a, progress: next };
          }),
        );

        // check if we hit 100 — read latest from state via a closure-safe approach
        const currentAgent = agentsRef.current.find((a) => a.id === agent.id);
        const currentProgress = currentAgent ? Math.min(currentAgent.progress + 10, 100) : 100;

        if (currentProgress >= 100) {
          // clear interval
          if (intervalsRef.current[agent.id]) {
            clearInterval(intervalsRef.current[agent.id]);
            delete intervalsRef.current[agent.id];
          }
          const completedAt = new Date().toISOString();
          const durationMs = Date.now() - startTime;
          try {
            await updateAgentRun(runId, {
              status: 'completed',
              progress: 100,
              completed_at: completedAt,
              duration_ms: durationMs,
              logs: [
                { time: startedAt, level: 'info', message: 'Execution started' },
                { time: completedAt, level: 'success', message: 'Execution completed successfully' },
              ],
            });
            const idleAgent = await updateAgent(agent.id, {
              status: 'idle',
              current_task: null,
              progress: 0,
              last_run_at: completedAt,
            });
            setAgents((prev) => prev.map((a) => (a.id === agent.id ? idleAgent : a)));
            await insertActivityLog({
              module: 'automation',
              action: 'agent_run_completed',
              entity_type: 'ai_agent',
              entity_id: agent.id,
              details: { run_id: runId, duration_ms: durationMs, task },
              level: 'success',
            });
            toast({ title: 'Agent finished', description: `"${agent.name}" completed in ${formatDuration(durationMs)}.` });
          } catch (e: any) {
            // mark error
            const errAgent = await updateAgent(agent.id, {
              status: 'error',
              current_task: null,
              progress: 0,
            });
            setAgents((prev) => prev.map((a) => (a.id === agent.id ? errAgent : a)));
            toast({ title: 'Agent error', description: e?.message, variant: 'destructive' });
          }
        }
      }, 500);
    } catch (e: any) {
      toast({ title: 'Failed to start agent', description: e?.message, variant: 'destructive' });
    }
  };

  // keep a ref to agents so the interval callback can read the latest
  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // ── Pause agent ──────────────────────────────────────────────────────────
  const handlePause = async (agent: AIAgentRow) => {
    if (intervalsRef.current[agent.id]) {
      clearInterval(intervalsRef.current[agent.id]);
      delete intervalsRef.current[agent.id];
    }
    try {
      const updated = await updateAgent(agent.id, { status: 'paused' });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      toast({ title: 'Agent paused', description: `"${agent.name}" is paused.` });
    } catch (e: any) {
      toast({ title: 'Pause failed', description: e?.message, variant: 'destructive' });
    }
  };

  // ── Resume agent ─────────────────────────────────────────────────────────
  const handleResume = async (agent: AIAgentRow) => {
    try {
      const updated = await updateAgent(agent.id, { status: 'running' });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      toast({ title: 'Agent resumed', description: `"${agent.name}" is running again.` });
      // Re-simulate progress from current position
      const startTime = Date.now();
      intervalsRef.current[agent.id] = setInterval(async () => {
        setAgents((prev) =>
          prev.map((a) => (a.id === agent.id ? { ...a, progress: Math.min(a.progress + 10, 100) } : a)),
        );
        const currentAgent = agentsRef.current.find((a) => a.id === agent.id);
        const currentProgress = currentAgent ? Math.min(currentAgent.progress + 10, 100) : 100;
        if (currentProgress >= 100) {
          if (intervalsRef.current[agent.id]) {
            clearInterval(intervalsRef.current[agent.id]);
            delete intervalsRef.current[agent.id];
          }
          const completedAt = new Date().toISOString();
          const durationMs = Date.now() - startTime;
          try {
            const idleAgent = await updateAgent(agent.id, {
              status: 'idle',
              current_task: null,
              progress: 0,
              last_run_at: completedAt,
            });
            setAgents((prev) => prev.map((a) => (a.id === agent.id ? idleAgent : a)));
            await insertActivityLog({
              module: 'automation',
              action: 'agent_run_completed',
              entity_type: 'ai_agent',
              entity_id: agent.id,
              details: { duration_ms: durationMs },
              level: 'success',
            });
            toast({ title: 'Agent finished', description: `"${agent.name}" completed.` });
          } catch (e: any) {
            toast({ title: 'Agent error', description: e?.message, variant: 'destructive' });
          }
        }
      }, 500);
    } catch (e: any) {
      toast({ title: 'Resume failed', description: e?.message, variant: 'destructive' });
    }
  };

  // ── Stop agent ───────────────────────────────────────────────────────────
  const handleStop = async (agent: AIAgentRow) => {
    if (intervalsRef.current[agent.id]) {
      clearInterval(intervalsRef.current[agent.id]);
      delete intervalsRef.current[agent.id];
    }
    try {
      const updated = await updateAgent(agent.id, {
        status: 'stopped',
        current_task: null,
        progress: 0,
      });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      await insertActivityLog({
        module: 'automation',
        action: 'agent_stopped',
        entity_type: 'ai_agent',
        entity_id: agent.id,
        details: { name: agent.name },
        level: 'warning',
      });
      toast({ title: 'Agent stopped', description: `"${agent.name}" was stopped.` });
    } catch (e: any) {
      toast({ title: 'Stop failed', description: e?.message, variant: 'destructive' });
    }
  };

  // ── View history ─────────────────────────────────────────────────────────
  const handleViewHistory = async (agent: AIAgentRow) => {
    setHistoryAgent(agent);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const runs = await fetchAgentRuns(agent.id, 50);
      setHistoryRuns(runs);
    } catch (e: any) {
      toast({ title: 'Failed to load history', description: e?.message, variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteRun = async (run: AgentRunRow) => {
    try {
      await deleteAgentRun(run.id);
      setHistoryRuns((prev) => prev.filter((r) => r.id !== run.id));
      toast({ title: 'Run deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total: agents.length,
    running: agents.filter((a) => a.status === 'running').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    error: agents.filter((a) => a.status === 'error').length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="AI Agents"
        description="Create, manage, and monitor autonomous AI agents for your content pipeline."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Agents" value={stats.total} icon={Bot} color="text-primary" bg="bg-primary/10" delay={0} />
        <StatCard label="Running" value={stats.running} icon={Play} color="text-blue-500" bg="bg-blue-500/10" delay={0.05} />
        <StatCard label="Idle" value={stats.idle} icon={Clock} color="text-muted-foreground" bg="bg-muted/20" delay={0.1} />
        <StatCard label="Errors" value={stats.error} icon={AlertCircle} color="text-destructive" bg="bg-destructive/10" delay={0.15} />
      </div>

      {/* Loading / Error / Empty / Grid */}
      {loading ? (
        <LoadingState message="Loading agents..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAgents} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI agent to automate research, content generation, analytics, and more."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent, idx) => {
            const typeMeta = getAgentTypeMeta(agent.type);
            const statusCfg = STATUS_CONFIG[agent.status];
            const TypeIcon = typeMeta.icon;
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="glass glass-hover flex flex-col p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', typeMeta.bg)}>
                        <TypeIcon className={cn('h-5 w-5', typeMeta.color)} />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-semibold leading-tight">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground">{typeMeta.label}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('gap-1.5 text-xs', statusCfg.color, statusCfg.bg)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot, agent.status === 'running' && 'animate-pulse')} />
                      {statusCfg.label}
                    </Badge>
                  </div>

                  {/* Description */}
                  {agent.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                  )}

                  {/* Current task */}
                  {agent.current_task && (
                    <div className="mt-3 rounded-lg border border-border/30 bg-muted/20 p-2.5">
                      <p className="text-xs font-medium text-foreground">{agent.current_task}</p>
                    </div>
                  )}

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{agent.progress}%</span>
                    </div>
                    <Progress value={agent.progress} className="h-2" />
                  </div>

                  {/* Schedule + times */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Schedule</span>
                      <span className="font-medium">{agent.schedule ?? 'manual'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last run</span>
                      <span className="font-medium">{formatRelativeTime(agent.last_run_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Next run</span>
                      <span className="font-medium">{formatRelativeTime(agent.next_run_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/30 pt-4">
                    {agent.status !== 'running' && agent.status !== 'paused' && (
                      <Button size="sm" variant="default" onClick={() => handleStart(agent)}>
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Start
                      </Button>
                    )}
                    {agent.status === 'running' && (
                      <Button size="sm" variant="outline" onClick={() => handlePause(agent)}>
                        <Pause className="mr-1 h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {agent.status === 'paused' && (
                      <Button size="sm" variant="default" onClick={() => handleResume(agent)}>
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                    {(agent.status === 'running' || agent.status === 'paused') && (
                      <Button size="sm" variant="outline" onClick={() => handleStop(agent)}>
                        <Square className="mr-1 h-3.5 w-3.5" />
                        Stop
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleViewHistory(agent)}>
                      <History className="mr-1 h-3.5 w-3.5" />
                      History
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => handleDelete(agent)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure a new AI agent to automate a specific task in your content pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g. Daily Research Agent"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm((p) => ({ ...p, type: v as AgentType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent type" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-4 w-4', t.color)} />
                          {t.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-desc">Description</Label>
              <Textarea
                id="agent-desc"
                placeholder="What does this agent do?"
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={createForm.schedule}
                onValueChange={(v) => setCreateForm((p) => ({ ...p, schedule: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Run History — {historyAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Timeline of recent execution runs for this agent.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[450px]">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyRuns.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No runs yet for this agent.</div>
            ) : (
              <div className="space-y-3 p-1">
                {historyRuns.map((run) => {
                  const cfg = RUN_STATUS_CONFIG[run.status] ?? RUN_STATUS_CONFIG.pending;
                  const RunIcon = cfg.icon;
                  return (
                    <div key={run.id} className="rounded-lg border border-border/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RunIcon className={cn('h-4 w-4', cfg.color, run.status === 'running' && 'animate-spin')} />
                          <div>
                            <p className="text-sm font-medium">{run.task ?? 'Untitled task'}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(run.started_at)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-xs', cfg.color)}>
                          {cfg.label}
                        </Badge>
                      </div>

                      {/* Duration */}
                      {run.duration_ms != null && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Duration: {formatDuration(run.duration_ms)}
                        </div>
                      )}

                      {/* Progress */}
                      {run.status === 'running' && (
                        <div className="mt-2">
                          <Progress value={run.progress} className="h-1.5" />
                        </div>
                      )}

                      {/* Error message */}
                      {run.error_message && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{run.error_message}</span>
                        </div>
                      )}

                      {/* Logs */}
                      {run.logs && run.logs.length > 0 && (
                        <div className="mt-2 space-y-1 rounded-md bg-muted/30 p-2">
                          {run.logs.map((log, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="text-muted-foreground">{new Date(log.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className={cn(
                                'font-medium',
                                log.level === 'error' && 'text-destructive',
                                log.level === 'success' && 'text-success',
                                log.level === 'warning' && 'text-yellow-500',
                                log.level === 'info' && 'text-muted-foreground',
                              )}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delete run */}
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteRun(run)}>
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
