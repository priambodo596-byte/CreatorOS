'use client';

import { useState, useEffect, useRef } from 'react';
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
import { PageHeader, EmptyState, ErrorState } from '@/components/dashboard/shared';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

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

type NodeType =
  | 'trigger'
  | 'youtube'
  | 'script'
  | 'ai'
  | 'voiceover'
  | 'thumbnail'
  | 'schedule'
  | 'email'
  | 'condition';

const NODE_CATALOG: {
  type: NodeType;
  label: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  description: string;
}[] = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'text-warning', bg: 'bg-warning/10', description: 'Start the workflow on a schedule or event' },
  { type: 'youtube', label: 'YouTube Sync', icon: Youtube, color: 'text-destructive', bg: 'bg-destructive/10', description: 'Pull channel data and analytics from YouTube' },
  { type: 'script', label: 'Script Writer', icon: FileText, color: 'text-primary', bg: 'bg-primary/10', description: 'Generate a video script with AI' },
  { type: 'ai', label: 'AI Processor', icon: Brain, color: 'text-accent', bg: 'bg-accent/10', description: 'Process data with an AI model' },
  { type: 'voiceover', label: 'Voiceover', icon: Mic, color: 'text-info', bg: 'bg-info/10', description: 'Generate voiceover audio with ElevenLabs' },
  { type: 'thumbnail', label: 'Thumbnail Gen', icon: ImageIcon, color: 'text-success', bg: 'bg-success/10', description: 'Generate a thumbnail image with AI' },
  { type: 'schedule', label: 'Schedule Post', icon: Calendar, color: 'text-warning', bg: 'bg-warning/10', description: 'Schedule content for publishing' },
  { type: 'email', label: 'Send Email', icon: Mail, color: 'text-primary', bg: 'bg-primary/10', description: 'Send a notification email' },
  { type: 'condition', label: 'Condition', icon: ArrowRight, color: 'text-muted-foreground', bg: 'bg-muted/20', description: 'Branch based on a condition' },
];

function getNodeTypeMeta(type: NodeType) {
  return NODE_CATALOG.find((n) => n.type === type) ?? NODE_CATALOG[0];
}

function genNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dbToWorkflow(row: any): WorkflowDef {
  const triggerNode: WorkflowNode = row.trigger && Object.keys(row.trigger).length > 0
    ? row.trigger
    : { id: genNodeId(), type: 'trigger', label: 'Start', config: { schedule: 'every 24h' } };
  const actionNodes: WorkflowNode[] = Array.isArray(row.actions) ? row.actions : [];
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
    trigger: triggerNode || {},
    actions: actionNodes,
    enabled: wf.active,
    updated_at: new Date().toISOString(),
  };
}

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
                  <Badge variant="outline" className={cn('text-xs', meta.color, meta.bg)}>{meta.label}</Badge>
                </div>
                <h3 className="mt-1 font-display text-sm font-semibold">{node.label}</h3>
                {Object.keys(node.config).length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {Object.entries(node.config).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove}>
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

  const configFields: { key: string; label: string; placeholder: string }[] = (() => {
    switch (node.type) {
      case 'trigger': return [{ key: 'schedule', label: 'Schedule', placeholder: 'every 24h' }, { key: 'event', label: 'Event', placeholder: 'on_new_video' }];
      case 'youtube': return [{ key: 'action', label: 'Action', placeholder: 'sync_channel' }, { key: 'limit', label: 'Limit', placeholder: '50' }];
      case 'script': return [{ key: 'topic', label: 'Topic', placeholder: 'AI in 2026' }, { key: 'length', label: 'Length', placeholder: '10 min' }];
      case 'ai': return [{ key: 'model', label: 'Model', placeholder: 'gpt-4o' }, { key: 'prompt', label: 'Prompt', placeholder: 'Summarize analytics…' }];
      case 'voiceover': return [{ key: 'voice', label: 'Voice', placeholder: 'Rachel' }, { key: 'stability', label: 'Stability', placeholder: '0.5' }];
      case 'thumbnail': return [{ key: 'style', label: 'Style', placeholder: 'cinematic' }, { key: 'size', label: 'Size', placeholder: '1280x720' }];
      case 'schedule': return [{ key: 'platform', label: 'Platform', placeholder: 'youtube' }, { key: 'time', label: 'Time', placeholder: '2025-01-01T10:00' }];
      case 'email': return [{ key: 'to', label: 'To', placeholder: 'user@example.com' }, { key: 'subject', label: 'Subject', placeholder: 'Workflow complete' }];
      case 'condition': return [{ key: 'field', label: 'Field', placeholder: 'views' }, { key: 'operator', label: 'Operator', placeholder: '>' }, { key: 'value', label: 'Value', placeholder: '1000' }];
      default: return [];
    }
  })();

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
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Node Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Enter a label for this node" />
          </div>
          {configFields.length > 0 && (
            <div className="space-y-3">
              {configFields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{field.label}</label>
                  <Input
                    value={config[field.key] ?? ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(label, config)}>
            <Save className="mr-2 h-4 w-4" />Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const mapped = (data || []).map(dbToWorkflow);
    setWorkflows(mapped);
    if (mapped.length > 0 && !selectedId) {
      setSelectedId(mapped[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { loadWorkflows(); }, []);

  const selected = workflows.find((w) => w.id === selectedId) ?? null;

  const persistWorkflow = async (wf: WorkflowDef) => {
    const { error: err } = await supabase
      .from('workflows')
      .update(workflowToDb(wf))
      .eq('id', wf.id);
    if (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newName.trim()) {
      toast({ title: 'Name required', description: 'Enter a workflow name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const triggerNode: WorkflowNode = { id: genNodeId(), type: 'trigger', label: 'Start', config: { schedule: 'every 24h' } };
    const { data, error: err } = await supabase
      .from('workflows')
      .insert({ name: newName.trim(), description: newDesc.trim(), trigger: triggerNode, actions: [], enabled: false })
      .select()
      .single();
    setSaving(false);
    if (err || !data) {
      toast({ title: 'Create failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      return;
    }
    const wf = dbToWorkflow(data);
    setWorkflows((prev) => [wf, ...prev]);
    setSelectedId(wf.id);
    setShowNewDialog(false);
    setNewName('');
    setNewDesc('');
    toast({ title: 'Workflow created', description: `"${wf.name}" is ready to build.` });
  };

  const handleDeleteWorkflow = async (id: string) => {
    const { error: err } = await supabase.from('workflows').delete().eq('id', id);
    if (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
      return;
    }
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast({ title: 'Workflow deleted' });
  };

  const handleDuplicate = async (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    setSaving(true);
    const [triggerNode, ...actionNodes] = wf.nodes;
    const { data, error: err } = await supabase
      .from('workflows')
      .insert({ name: `${wf.name} (copy)`, description: wf.description, trigger: triggerNode || {}, actions: actionNodes, enabled: false })
      .select()
      .single();
    setSaving(false);
    if (err || !data) {
      toast({ title: 'Duplicate failed', description: err?.message, variant: 'destructive' });
      return;
    }
    const copy = dbToWorkflow(data);
    setWorkflows((prev) => [copy, ...prev]);
    toast({ title: 'Workflow duplicated' });
  };

  const handleToggleActive = async (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const newActive = !wf.active;
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, active: newActive } : w));
    await supabase.from('workflows').update({ enabled: newActive, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const handleAddNode = async (type: NodeType, workflowId: string) => {
    const meta = getNodeTypeMeta(type);
    const newNode: WorkflowNode = { id: genNodeId(), type, label: meta.label, config: {} };
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;
    const updatedWf = { ...wf, nodes: [...wf.nodes, newNode], updatedAt: new Date().toISOString() };
    setWorkflows((prev) => prev.map((w) => w.id === workflowId ? updatedWf : w));
    await persistWorkflow(updatedWf);
  };

  const handleRemoveNode = async (nodeId: string, workflowId: string) => {
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) return;
    const updatedWf = { ...wf, nodes: wf.nodes.filter((n) => n.id !== nodeId), updatedAt: new Date().toISOString() };
    setWorkflows((prev) => prev.map((w) => w.id === workflowId ? updatedWf : w));
    await persistWorkflow(updatedWf);
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
      nodes: wf.nodes.map((n) => n.id === nodeToEdit.id ? { ...n, label, config } : n),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows((prev) => prev.map((w) => w.id === selectedId ? updatedWf : w));
    setEditorOpen(false);
    setEditingNode(null);
    await persistWorkflow(updatedWf);
    toast({ title: 'Node updated' });
  };

  const handleDragStart = (type: NodeType) => setDraggedType(type);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedType && selectedId) {
      handleAddNode(draggedType, selectedId);
      setDraggedType(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Workflow Builder" description="Automate your content pipeline." />
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading workflows…</span>
          </div>
        </Card>
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
          <Button size="sm" onClick={() => setShowNewDialog(true)} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />New Workflow
          </Button>
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
                        {wf.active && <Badge className="bg-success/15 text-success text-xs">Active</Badge>}
                      </div>
                      {wf.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{wf.description}</p>}
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{wf.nodes.length} steps</span>
                        <span>·</span>
                        <span>{new Date(wf.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={(e) => { e.stopPropagation(); handleToggleActive(wf.id); }}>
                      {wf.active ? (<><Pause className="mr-1 h-3 w-3" />Pause</>) : (<><Play className="mr-1 h-3 w-3" />Activate</>)}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleDuplicate(wf.id); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {selected ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[200px_1fr]">
              <Card className="glass h-fit p-4">
                <h3 className="mb-3 font-display text-sm font-semibold">Node Palette</h3>
                <p className="mb-3 text-xs text-muted-foreground">Drag nodes to the canvas or click to add.</p>
                <div className="space-y-2">
                  {NODE_CATALOG.filter((n) => n.type !== 'trigger').map((node) => {
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
              </Card>

              <div
                ref={dropZoneRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="min-h-[400px] rounded-xl border-2 border-dashed border-border/30 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{selected.name}</h2>
                    {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs">{selected.nodes.length} steps</Badge>
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

                {selected.nodes.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await persistWorkflow(selected);
                        toast({ title: 'Workflow saved', description: `"${selected.name}" has been saved.` });
                      }}
                    >
                      <Save className="mr-2 h-4 w-4" />Save Workflow
                    </Button>
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

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Workflow Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Auto Publish Pipeline" onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkflow()} />
            </div>
            <div>
              <label className="mb-1.5 block xs font-medium text-muted-foreground">Description (optional)</label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this workflow do?" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkflow} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NodeEditorDialog
        open={editorOpen}
        node={editingNode?.nodes[0] ?? null}
        onClose={() => { setEditorOpen(false); setEditingNode(null); }}
        onSave={handleSaveNode}
      />
    </div>
  );
}
