'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Plus,
  Trash2,
  Play,
  Pause,
  Settings2,
  Loader2,
  Zap,
  Youtube,
  FileText,
  Brain,
  Mic,
  Image as ImageIcon,
  Calendar,
  Mail,
  GripVertical,
  ArrowRight,
  Copy,
  Save,
  Search,
  Clock,
  History,
  Download,
  Upload,
  Send,
  Database,
  GitBranch,
  Repeat,
  Webhook,
  Globe,
  MessageSquare,
  Hash,
  Bell,
  Subtitles,
  TrendingUp,
  CloudUpload,
  Film,
  Clapperboard,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '@/components/dashboard/shared';
import { cn } from '@/lib/utils';
import {
  fetchWorkflows,
  insertWorkflow,
  updateWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  fetchExecutions,
  insertExecution,
  updateExecution,
  fetchVersions,
  insertVersion,
  deleteVersion,
  insertActivityLog,
  type WorkflowRow,
  type WorkflowExecutionRow,
  type WorkflowVersionRow,
} from '@/lib/automation';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType =
  | 'trigger'
  | 'research_topic'
  | 'generate_script'
  | 'generate_storyboard'
  | 'generate_thumbnail'
  | 'generate_voiceover'
  | 'generate_video'
  | 'generate_subtitle'
  | 'seo_optimizer'
  | 'upload_supabase'
  | 'upload_youtube'
  | 'schedule_publish'
  | 'send_notification'
  | 'save_to_database'
  | 'delay'
  | 'condition'
  | 'loop'
  | 'webhook'
  | 'http_request'
  | 'email'
  | 'slack'
  | 'discord'
  | 'telegram';

interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, string>;
}

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NodeCatalogEntry {
  type: NodeType;
  label: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  description: string;
  category: 'trigger' | 'content' | 'media' | 'distribution' | 'logic' | 'notification';
}

// ─── Node Catalog ─────────────────────────────────────────────────────────────

const NODE_CATALOG: NodeCatalogEntry[] = [
  // Trigger
  {
    type: 'trigger',
    label: 'Trigger',
    icon: Zap,
    color: 'text-warning',
    bg: 'bg-warning/10',
    description: 'Start the workflow on a schedule or event',
    category: 'trigger',
  },
  // Content generation
  {
    type: 'research_topic',
    label: 'Research Topic',
    icon: Search,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Research trending topics and keywords',
    category: 'content',
  },
  {
    type: 'generate_script',
    label: 'Generate Script',
    icon: FileText,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Generate a video script with AI',
    category: 'content',
  },
  {
    type: 'generate_storyboard',
    label: 'Generate Storyboard',
    icon: Clapperboard,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Create scene-by-scene storyboard from script',
    category: 'content',
  },
  {
    type: 'seo_optimizer',
    label: 'SEO Optimizer',
    icon: TrendingUp,
    color: 'text-success',
    bg: 'bg-success/10',
    description: 'Optimize title, description, and tags for SEO',
    category: 'content',
  },
  // Media generation
  {
    type: 'generate_thumbnail',
    label: 'Generate Thumbnail',
    icon: ImageIcon,
    color: 'text-success',
    bg: 'bg-success/10',
    description: 'Generate a thumbnail image with AI',
    category: 'media',
  },
  {
    type: 'generate_voiceover',
    label: 'Generate Voice Over',
    icon: Mic,
    color: 'text-info',
    bg: 'bg-info/10',
    description: 'Generate voiceover audio with ElevenLabs',
    category: 'media',
  },
  {
    type: 'generate_video',
    label: 'Generate Video',
    icon: Film,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Assemble or generate the final video',
    category: 'media',
  },
  {
    type: 'generate_subtitle',
    label: 'Generate Subtitle',
    icon: Subtitles,
    color: 'text-info',
    bg: 'bg-info/10',
    description: 'Generate subtitles / captions from audio',
    category: 'media',
  },
  // Distribution
  {
    type: 'upload_supabase',
    label: 'Upload to Supabase',
    icon: Database,
    color: 'text-success',
    bg: 'bg-success/10',
    description: 'Upload asset to Supabase Storage',
    category: 'distribution',
  },
  {
    type: 'upload_youtube',
    label: 'Upload to YouTube',
    icon: Youtube,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    description: 'Upload video to YouTube channel',
    category: 'distribution',
  },
  {
    type: 'schedule_publish',
    label: 'Schedule Publish',
    icon: Calendar,
    color: 'text-warning',
    bg: 'bg-warning/10',
    description: 'Schedule content for publishing at a set time',
    category: 'distribution',
  },
  // Logic / control flow
  {
    type: 'delay',
    label: 'Delay',
    icon: Timer,
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    description: 'Wait for a specified duration before continuing',
    category: 'logic',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    description: 'Branch based on a condition',
    category: 'logic',
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: Repeat,
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    description: 'Iterate over a collection of items',
    category: 'logic',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Trigger or receive via a webhook endpoint',
    category: 'logic',
  },
  {
    type: 'http_request',
    label: 'HTTP Request',
    icon: Globe,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Make an arbitrary HTTP request',
    category: 'logic',
  },
  // Data
  {
    type: 'save_to_database',
    label: 'Save to Database',
    icon: Database,
    color: 'text-success',
    bg: 'bg-success/10',
    description: 'Persist workflow output to the database',
    category: 'distribution',
  },
  // Notifications
  {
    type: 'send_notification',
    label: 'Send Notification',
    icon: Bell,
    color: 'text-warning',
    bg: 'bg-warning/10',
    description: 'Send a push / in-app notification',
    category: 'notification',
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Send a notification email',
    category: 'notification',
  },
  {
    type: 'slack',
    label: 'Slack',
    icon: Hash,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Post a message to a Slack channel',
    category: 'notification',
  },
  {
    type: 'discord',
    label: 'Discord',
    icon: MessageSquare,
    color: 'text-info',
    bg: 'bg-info/10',
    description: 'Post a message to a Discord channel',
    category: 'notification',
  },
  {
    type: 'telegram',
    label: 'Telegram',
    icon: Send,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Send a message via Telegram bot',
    category: 'notification',
  },
];

const NODE_CATEGORIES: { label: string; value: NodeCatalogEntry['category'] }[] = [
  { label: 'Content', value: 'content' },
  { label: 'Media', value: 'media' },
  { label: 'Distribution', value: 'distribution' },
  { label: 'Logic', value: 'logic' },
  { label: 'Notification', value: 'notification' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNodeTypeMeta(type: NodeType): NodeCatalogEntry {
  return NODE_CATALOG.find((n) => n.type === type) ?? NODE_CATALOG[0];
}

function genNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dbToWorkflow(row: WorkflowRow): WorkflowDef {
  const triggerNode: WorkflowNode =
    row.trigger && typeof row.trigger === 'object' && 'id' in (row.trigger as Record<string, unknown>)
      ? (row.trigger as WorkflowNode)
      : { id: genNodeId(), type: 'trigger', label: 'Start', config: { schedule: 'every 24h' } };
  const actionNodes: WorkflowNode[] = Array.isArray(row.actions) ? (row.actions as WorkflowNode[]) : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    nodes: [triggerNode, ...actionNodes],
    active: row.enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function workflowToDb(wf: WorkflowDef) {
  const [triggerNode, ...actionNodes] = wf.nodes;
  return {
    name: wf.name,
    description: wf.description,
    trigger: (triggerNode as unknown as Record<string, unknown>) ?? {},
    actions: actionNodes,
    enabled: wf.active,
    updated_at: new Date().toISOString(),
  };
}

function getConfigFields(type: NodeType): { key: string; label: string; placeholder: string }[] {
  switch (type) {
    case 'trigger':
      return [
        { key: 'schedule', label: 'Schedule', placeholder: 'every 24h' },
        { key: 'event', label: 'Event', placeholder: 'on_new_video' },
      ];
    case 'research_topic':
      return [
        { key: 'topic', label: 'Topic', placeholder: 'AI in 2026' },
        { key: 'source', label: 'Source', placeholder: 'trends' },
      ];
    case 'generate_script':
      return [
        { key: 'topic', label: 'Topic', placeholder: 'AI in 2026' },
        { key: 'length', label: 'Length', placeholder: '10 min' },
        { key: 'tone', label: 'Tone', placeholder: 'informative' },
      ];
    case 'generate_storyboard':
      return [
        { key: 'scenes', label: 'Scenes', placeholder: '8' },
        { key: 'style', label: 'Style', placeholder: 'cinematic' },
      ];
    case 'generate_thumbnail':
      return [
        { key: 'style', label: 'Style', placeholder: 'cinematic' },
        { key: 'size', label: 'Size', placeholder: '1280x720' },
      ];
    case 'generate_voiceover':
      return [
        { key: 'voice', label: 'Voice', placeholder: 'Rachel' },
        { key: 'stability', label: 'Stability', placeholder: '0.5' },
      ];
    case 'generate_video':
      return [
        { key: 'resolution', label: 'Resolution', placeholder: '1920x1080' },
        { key: 'format', label: 'Format', placeholder: 'mp4' },
      ];
    case 'generate_subtitle':
      return [
        { key: 'language', label: 'Language', placeholder: 'en' },
        { key: 'format', label: 'Format', placeholder: 'srt' },
      ];
    case 'seo_optimizer':
      return [
        { key: 'target', label: 'Target', placeholder: 'title,description,tags' },
        { key: 'keywords', label: 'Keywords', placeholder: 'AI, automation' },
      ];
    case 'upload_supabase':
      return [
        { key: 'bucket', label: 'Bucket', placeholder: 'creatoros-assets' },
        { key: 'path', label: 'Path', placeholder: 'videos/' },
      ];
    case 'upload_youtube':
      return [
        { key: 'privacy', label: 'Privacy', placeholder: 'private' },
        { key: 'title', label: 'Title', placeholder: 'My Video' },
      ];
    case 'schedule_publish':
      return [
        { key: 'platform', label: 'Platform', placeholder: 'youtube' },
        { key: 'time', label: 'Time', placeholder: '2025-01-01T10:00' },
      ];
    case 'send_notification':
      return [
        { key: 'channel', label: 'Channel', placeholder: 'in-app' },
        { key: 'message', label: 'Message', placeholder: 'Workflow complete' },
      ];
    case 'save_to_database':
      return [
        { key: 'table', label: 'Table', placeholder: 'videos' },
        { key: 'mode', label: 'Mode', placeholder: 'upsert' },
      ];
    case 'delay':
      return [{ key: 'duration', label: 'Duration', placeholder: '30s' }];
    case 'condition':
      return [
        { key: 'field', label: 'Field', placeholder: 'views' },
        { key: 'operator', label: 'Operator', placeholder: '>' },
        { key: 'value', label: 'Value', placeholder: '1000' },
      ];
    case 'loop':
      return [
        { key: 'items', label: 'Items', placeholder: 'videos[]' },
        { key: 'limit', label: 'Limit', placeholder: '10' },
      ];
    case 'webhook':
      return [
        { key: 'url', label: 'URL', placeholder: 'https://...' },
        { key: 'method', label: 'Method', placeholder: 'POST' },
      ];
    case 'http_request':
      return [
        { key: 'url', label: 'URL', placeholder: 'https://api.example.com' },
        { key: 'method', label: 'Method', placeholder: 'GET' },
        { key: 'headers', label: 'Headers', placeholder: 'Authorization: Bearer ...' },
      ];
    case 'email':
      return [
        { key: 'to', label: 'To', placeholder: 'user@example.com' },
        { key: 'subject', label: 'Subject', placeholder: 'Workflow complete' },
      ];
    case 'slack':
      return [
        { key: 'channel', label: 'Channel', placeholder: '#general' },
        { key: 'message', label: 'Message', placeholder: 'Done!' },
      ];
    case 'discord':
      return [
        { key: 'channel', label: 'Channel ID', placeholder: '123456789' },
        { key: 'message', label: 'Message', placeholder: 'Done!' },
      ];
    case 'telegram':
      return [
        { key: 'chat_id', label: 'Chat ID', placeholder: '@channel' },
        { key: 'message', label: 'Message', placeholder: 'Done!' },
      ];
    default:
      return [];
  }
}

// ─── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  index,
  total,
  onRemove,
  onEdit,
}: {
  node: WorkflowNode;
  index: number;
  total: number;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const meta = getNodeTypeMeta(node.type);
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      <Card className="glass glass-hover group p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/50" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                  <Badge variant="outline" className={cn('text-xs', meta.color, meta.bg)}>
                    {meta.label}
                  </Badge>
                </div>
                <h3 className="mt-1 font-display text-sm font-semibold">{node.label}</h3>
                {Object.keys(node.config).length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {Object.entries(node.config)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={onRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      {index < total - 1 && (
        <div className="flex justify-center py-1">
          <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground/40" />
        </div>
      )}
    </motion.div>
  );
}

// ─── NodeEditorDialog ──────────────────────────────────────────────────────────

function NodeEditorDialog({
  open,
  node,
  onClose,
  onSave,
}: {
  open: boolean;
  node: WorkflowNode | null;
  onClose: () => void;
  onSave: (label: string, config: Record<string, string>) => void;
}) {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setConfig(node.config);
    }
  }, [node]);

  if (!node) return null;
  const meta = getNodeTypeMeta(node.type);
  const configFields = getConfigFields(node.type);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon className={cn('h-5 w-5', meta.color)} />
            Configure {meta.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Node Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a label for this node"
            />
          </div>
          {configFields.length > 0 && (
            <div className="space-y-3">
              {configFields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {field.label}
                  </label>
                  <Input
                    value={config[field.key] ?? ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(label, config)}>
            <Save className="mr-2 h-4 w-4" />Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Version History Dialog ────────────────────────────────────────────────────

function VersionHistoryDialog({
  open,
  versions,
  loading,
  onClose,
  onRestore,
}: {
  open: boolean;
  versions: WorkflowVersionRow[];
  loading: boolean;
  onClose: () => void;
  onRestore: (version: WorkflowVersionRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Version History
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading versions…</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="py-8 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {versions.map((v) => (
              <Card key={v.id} className="glass p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        v{v.version_number}
                      </Badge>
                      <span className="text-sm font-medium">{v.name}</span>
                    </div>
                    {v.change_note && (
                      <p className="mt-1 text-xs text-muted-foreground">{v.change_note}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onRestore(v)}>
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Restore
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Execution History Dialog ──────────────────────────────────────────────────

function ExecutionHistoryDialog({
  open,
  executions,
  loading,
  onClose,
}: {
  open: boolean;
  executions: WorkflowExecutionRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-warning" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/15 text-success';
      case 'failed':
        return 'bg-destructive/15 text-destructive';
      case 'running':
        return 'bg-primary/15 text-primary';
      case 'cancelled':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-warning/15 text-warning';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Execution History
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading executions…</span>
          </div>
        ) : executions.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No executions yet. Run the workflow to see history.</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {executions.map((ex) => (
              <Card key={ex.id} className="glass p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {statusIcon(ex.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', statusColor(ex.status))}>
                          {ex.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ex.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {ex.duration_ms != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Duration: {(ex.duration_ms / 1000).toFixed(1)}s
                        </p>
                      )}
                      {ex.error_message && (
                        <p className="mt-1 text-xs text-destructive">{ex.error_message}</p>
                      )}
                      {ex.node_results && ex.node_results.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {ex.node_results.map((nr, i) => (
                            <div key={i} className="rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                              <span className="font-medium">{String((nr as Record<string, unknown>).node ?? `Node ${i + 1}`)}</span>
                              {': '}
                              <span>{String((nr as Record<string, unknown>).result ?? 'ok')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowBuilderPage() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingNode, setEditingNode] = useState<WorkflowDef | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draggedType, setDraggedType] = useState<NodeType | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [execDialogOpen, setExecDialogOpen] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecutionRow[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkflows();
      const mapped = data.map(dbToWorkflow);
      setWorkflows(mapped);
      if (mapped.length > 0 && !selectedId) {
        setSelectedId(mapped[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const selected = workflows.find((w) => w.id === selectedId) ?? null;

  // ── Persist workflow + create version snapshot ──────────────────────────────
  const persistWorkflow = useCallback(
    async (wf: WorkflowDef, changeNote?: string) => {
      setSaving(true);
      try {
        await updateWorkflow(wf.id, workflowToDb(wf));

        // Create a version snapshot
        const [triggerNode, ...actionNodes] = wf.nodes;
        const existingVersions = await fetchVersions(wf.id);
        const nextVersionNumber =
          existingVersions.length > 0
            ? Math.max(...existingVersions.map((v) => v.version_number)) + 1
            : 1;
        await insertVersion({
          workflow_id: wf.id,
          version_number: nextVersionNumber,
          name: wf.name,
          description: wf.description,
          trigger: (triggerNode as unknown as Record<string, unknown>) ?? {},
          actions: actionNodes,
          change_note: changeNote ?? `Saved v${nextVersionNumber}`,
        });

        await insertActivityLog({
          module: 'automation',
          action: 'workflow_saved',
          entity_type: 'workflow',
          entity_id: wf.id,
          details: { name: wf.name, version: nextVersionNumber },
          level: 'info',
        });

        toast({ title: 'Workflow saved', description: `"${wf.name}" has been saved (v${nextVersionNumber}).` });
      } catch (e) {
        toast({
          title: 'Save failed',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreateWorkflow = async () => {
    if (!newName.trim()) {
      toast({ title: 'Name required', description: 'Enter a workflow name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const triggerNode: WorkflowNode = {
        id: genNodeId(),
        type: 'trigger',
        label: 'Start',
        config: { schedule: 'every 24h' },
      };
      const data = await insertWorkflow({
        name: newName.trim(),
        description: newDesc.trim(),
        trigger: triggerNode,
        actions: [],
        enabled: false,
      });
      const wf = dbToWorkflow(data);
      setWorkflows((prev) => [wf, ...prev]);
      setSelectedId(wf.id);
      setShowNewDialog(false);
      setNewName('');
      setNewDesc('');
      toast({ title: 'Workflow created', description: `"${wf.name}" is ready to build.` });
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteWorkflow = async (id: string) => {
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast({ title: 'Workflow deleted' });
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // ── Duplicate ────────────────────────────────────────────────────────────────
  const handleDuplicate = async (id: string) => {
    setSaving(true);
    try {
      const data = await duplicateWorkflow(id);
      const copy = dbToWorkflow(data);
      setWorkflows((prev) => [copy, ...prev]);
      toast({ title: 'Workflow duplicated' });
    } catch (e) {
      toast({
        title: 'Duplicate failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────────
  const handleToggleActive = async (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const newActive = !wf.active;
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, active: newActive } : w)));
    try {
      await updateWorkflow(id, { enabled: newActive });
      toast({
        title: newActive ? 'Workflow activated' : 'Workflow paused',
        description: `"${wf.name}" is now ${newActive ? 'active' : 'paused'}.`,
      });
    } catch (e) {
      // Revert on failure
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, active: !newActive } : w)));
      toast({
        title: 'Toggle failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // ── Add / Remove / Edit nodes ────────────────────────────────────────────────
  const handleAddNode = async (type: NodeType, workflowId: string) => {
    const meta = getNodeTypeMeta(type);
    const newNode: WorkflowNode = { id: genNodeId(), type, label: meta.label, config: {} };
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;
    const updatedWf = { ...wf, nodes: [...wf.nodes, newNode], updatedAt: new Date().toISOString() };
    setWorkflows((prev) => prev.map((w) => (w.id === workflowId ? updatedWf : w)));
    try {
      await updateWorkflow(workflowId, workflowToDb(updatedWf));
    } catch (e) {
      toast({
        title: 'Failed to add node',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveNode = async (nodeId: string, workflowId: string) => {
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;
    const updatedWf = {
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows((prev) => prev.map((w) => (w.id === workflowId ? updatedWf : w)));
    try {
      await updateWorkflow(workflowId, workflowToDb(updatedWf));
    } catch (e) {
      toast({
        title: 'Failed to remove node',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleEditNode = (node: WorkflowNode, workflow: WorkflowDef) => {
    setEditingNode({ ...workflow, nodes: [node] });
    setEditorOpen(true);
  };

  const handleSaveNode = async (label: string, config: Record<string, string>) => {
    if (!editingNode || !selectedId) return;
    const nodeToEdit = editingNode.nodes[0];
    const wf = workflows.find((w) => w.id === selectedId);
    if (!wf) return;
    const updatedWf = {
      ...wf,
      nodes: wf.nodes.map((n) => (n.id === nodeToEdit.id ? { ...n, label, config } : n)),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows((prev) => prev.map((w) => (w.id === selectedId ? updatedWf : w)));
    setEditorOpen(false);
    setEditingNode(null);
    try {
      await updateWorkflow(selectedId, workflowToDb(updatedWf));
      toast({ title: 'Node updated' });
    } catch (e) {
      toast({
        title: 'Failed to save node',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // ── Drag and drop ────────────────────────────────────────────────────────────
  const handleDragStart = (type: NodeType) => setDraggedType(type);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedType && selectedId) {
      handleAddNode(draggedType, selectedId);
      setDraggedType(null);
    }
  };

  // ── Run Now ──────────────────────────────────────────────────────────────────
  const handleRunNow = async (wf: WorkflowDef) => {
    setRunning(wf.id);
    try {
      const startedAt = new Date().toISOString();
      const execution = await insertExecution({
        workflow_id: wf.id,
        status: 'running',
        trigger_data: { source: 'manual', workflow_name: wf.name },
        started_at: startedAt,
      });

      toast({ title: 'Workflow running', description: `"${wf.name}" execution started.` });

      // Simulate processing each node
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await delay(2000 + Math.random() * 1000);

      const nodeResults = wf.nodes.map((n, i) => ({
        node: n.label,
        type: n.type,
        step: i + 1,
        result: 'success',
        duration_ms: Math.round(200 + Math.random() * 800),
      }));

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      await updateExecution(execution.id, {
        status: 'completed',
        node_results: nodeResults,
        completed_at: completedAt,
        duration_ms: durationMs,
      });

      await insertActivityLog({
        module: 'automation',
        action: 'workflow_executed',
        entity_type: 'workflow',
        entity_id: wf.id,
        details: { execution_id: execution.id, status: 'completed', duration_ms: durationMs },
        level: 'success',
      });

      toast({
        title: 'Workflow completed',
        description: `"${wf.name}" ran ${wf.nodes.length} steps in ${(durationMs / 1000).toFixed(1)}s.`,
      });
    } catch (e) {
      toast({
        title: 'Run failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(null);
    }
  };

  // ── Version history ──────────────────────────────────────────────────────────
  const handleOpenVersions = async (workflowId: string) => {
    setVersionDialogOpen(true);
    setVersionsLoading(true);
    try {
      const data = await fetchVersions(workflowId);
      setVersions(data);
    } catch (e) {
      toast({
        title: 'Failed to load versions',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (version: WorkflowVersionRow) => {
    if (!selectedId) return;
    try {
      const triggerNode: WorkflowNode =
        version.trigger && 'id' in (version.trigger as Record<string, unknown>)
          ? (version.trigger as WorkflowNode)
          : { id: genNodeId(), type: 'trigger', label: 'Start', config: {} };
      const actionNodes: WorkflowNode[] = Array.isArray(version.actions)
        ? (version.actions as WorkflowNode[])
        : [];
      const restoredWf: WorkflowDef = {
        id: selectedId,
        name: version.name,
        description: version.description,
        nodes: [triggerNode, ...actionNodes],
        active: selected?.active ?? false,
        createdAt: selected?.createdAt ?? version.created_at,
        updatedAt: new Date().toISOString(),
      };
      setWorkflows((prev) => prev.map((w) => (w.id === selectedId ? restoredWf : w)));
      await updateWorkflow(selectedId, workflowToDb(restoredWf));

      // Save a new version capturing the restore
      const existingVersions = await fetchVersions(selectedId);
      const nextVersionNumber =
        existingVersions.length > 0
          ? Math.max(...existingVersions.map((v) => v.version_number)) + 1
          : 1;
      await insertVersion({
        workflow_id: selectedId,
        version_number: nextVersionNumber,
        name: restoredWf.name,
        description: restoredWf.description,
        trigger: (triggerNode as unknown as Record<string, unknown>) ?? {},
        actions: actionNodes,
        change_note: `Restored from v${version.version_number}`,
      });

      await insertActivityLog({
        module: 'automation',
        action: 'workflow_restored',
        entity_type: 'workflow',
        entity_id: selectedId,
        details: { restored_from_version: version.version_number },
        level: 'info',
      });

      setVersionDialogOpen(false);
      toast({
        title: 'Version restored',
        description: `Restored v${version.version_number} and saved as v${nextVersionNumber}.`,
      });
    } catch (e) {
      toast({
        title: 'Restore failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // ── Execution history ────────────────────────────────────────────────────────
  const handleOpenExecutions = async (workflowId: string) => {
    setExecDialogOpen(true);
    setExecutionsLoading(true);
    try {
      const data = await fetchExecutions(workflowId);
      setExecutions(data);
    } catch (e) {
      toast({
        title: 'Failed to load executions',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setExecutionsLoading(false);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = (wf: WorkflowDef) => {
    const exportData = {
      type: 'creatoros_workflow',
      version: 1,
      exported_at: new Date().toISOString(),
      workflow: {
        name: wf.name,
        description: wf.description,
        active: wf.active,
        nodes: wf.nodes,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = wf.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    link.download = `${safeName || 'workflow'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Workflow exported', description: `Downloaded "${wf.name}.json"` });
  };

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const wfData = parsed.workflow ?? parsed;
      if (!wfData || !wfData.name || !Array.isArray(wfData.nodes)) {
        toast({ title: 'Invalid file', description: 'JSON must contain a name and nodes array.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      const [triggerNode, ...actionNodes] = wfData.nodes as WorkflowNode[];
      const data = await insertWorkflow({
        name: `${wfData.name} (imported)`,
        description: wfData.description ?? '',
        trigger: triggerNode ?? {},
        actions: actionNodes,
        enabled: false,
      });
      const wf = dbToWorkflow(data);
      setWorkflows((prev) => [wf, ...prev]);
      setSelectedId(wf.id);
      toast({ title: 'Workflow imported', description: `"${wf.name}" has been added.` });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Invalid JSON file',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      // Reset the input so the same file can be re-imported
      if (importRef.current) importRef.current.value = '';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Workflow Builder" description="Automate your content pipeline." />
        <LoadingState message="Loading workflows…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Workflow Builder" description="Automate your content pipeline." />
        <ErrorState message={error} onRetry={loadWorkflows} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Workflow Builder"
        description="Design automated content pipelines with drag-and-drop nodes."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} disabled={saving}>
              <Upload className="mr-2 h-4 w-4" />Import
            </Button>
            <Button size="sm" onClick={() => setShowNewDialog(true)} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" />New Workflow
            </Button>
          </div>
        }
      />

      {workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Create your first automation workflow to streamline your content pipeline. Drag nodes from the palette to build a sequence."
          action={
            <Button size="sm" onClick={() => setShowNewDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Create Workflow
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* ── Workflow list ── */}
          <div className="space-y-2">
            {workflows.map((wf) => (
              <motion.div key={wf.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Card
                  className={cn(
                    'glass cursor-pointer p-4 transition-all',
                    selectedId === wf.id ? 'border-primary/50 ring-1 ring-primary/30' : 'glass-hover',
                  )}
                  onClick={() => setSelectedId(wf.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-semibold">{wf.name}</h3>
                        {wf.active && (
                          <Badge className="bg-success/15 text-success text-xs">Active</Badge>
                        )}
                      </div>
                      {wf.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{wf.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{wf.nodes.length} steps</span>
                        <span>·</span>
                        <span>
                          {new Date(wf.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkflow(wf.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(wf.id);
                      }}
                    >
                      {wf.active ? (
                        <>
                          <Pause className="mr-1 h-3 w-3" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="mr-1 h-3 w-3" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(wf.id);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ── Builder canvas ── */}
          {selected ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[200px_1fr]">
              {/* Node palette */}
              <Card className="glass h-fit p-4">
                <h3 className="mb-3 font-display text-sm font-semibold">Node Palette</h3>
                <p className="mb-3 text-xs text-muted-foreground">Drag nodes to the canvas or click to add.</p>
                <div className="space-y-3">
                  {NODE_CATEGORIES.map((cat) => (
                    <div key={cat.value}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {cat.label}
                      </p>
                      <div className="space-y-1.5">
                        {NODE_CATALOG.filter((n) => n.category === cat.value).map((node) => {
                          const Icon = node.icon;
                          return (
                            <div
                              key={node.type}
                              draggable
                              onDragStart={() => handleDragStart(node.type)}
                              onClick={() => handleAddNode(node.type, selected.id)}
                              className="flex cursor-grab items-center gap-2 rounded-lg border border-border/30 p-2 transition-all hover:border-primary/30 hover:bg-muted/30 active:cursor-grabbing"
                            >
                              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', node.bg)}>
                                <Icon className={cn('h-4 w-4', node.color)} />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-medium">{node.label}</p>
                                <p className="line-clamp-1 text-[10px] text-muted-foreground">{node.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Canvas */}
              <div
                ref={dropZoneRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="min-h-[400px] rounded-xl border-2 border-dashed border-border/30 p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{selected.name}</h2>
                    {selected.description && (
                      <p className="text-sm text-muted-foreground">{selected.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selected.nodes.length} steps
                  </Badge>
                </div>

                {/* Action toolbar */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleRunNow(selected)}
                    disabled={running === selected.id || selected.nodes.length === 0}
                  >
                    {running === selected.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running…
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => persistWorkflow(selected)}
                    disabled={saving || selected.nodes.length === 0}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenVersions(selected.id)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    Versions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenExecutions(selected.id)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    History
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport(selected)}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {selected.nodes.map((node, i) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      index={i}
                      total={selected.nodes.length}
                      onRemove={() => handleRemoveNode(node.id, selected.id)}
                      onEdit={() => handleEditNode(node, selected)}
                    />
                  ))}
                </AnimatePresence>

                {selected.nodes.length === 0 && (
                  <div className="flex h-64 items-center justify-center text-center">
                    <div>
                      <Workflow className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Drag nodes here to build your workflow</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Card className="glass flex h-64 items-center justify-center p-5">
              <div className="text-center">
                <Workflow className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Select a workflow from the left to start building</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── New workflow dialog ── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Workflow Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Auto Publish Pipeline"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkflow()}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Description (optional)
              </label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What does this workflow do?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkflow} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Node editor dialog ── */}
      <NodeEditorDialog
        open={editorOpen}
        node={editingNode?.nodes[0] ?? null}
        onClose={() => {
          setEditorOpen(false);
          setEditingNode(null);
        }}
        onSave={handleSaveNode}
      />

      {/* ── Version history dialog ── */}
      <VersionHistoryDialog
        open={versionDialogOpen}
        versions={versions}
        loading={versionsLoading}
        onClose={() => setVersionDialogOpen(false)}
        onRestore={handleRestoreVersion}
      />

      {/* ── Execution history dialog ── */}
      <ExecutionHistoryDialog
        open={execDialogOpen}
        executions={executions}
        loading={executionsLoading}
        onClose={() => setExecDialogOpen(false)}
      />
    </div>
  );
}
