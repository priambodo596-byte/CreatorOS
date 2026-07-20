'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Plus,
  Loader2,
  Calendar,
  Flag,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '@/components/dashboard/shared';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  due_date: string | null;
  project_id: string | null;
  created_at: string;
}

const COLUMNS = [
  { id: 'todo', label: 'Todo', color: 'bg-muted/20' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-primary/15' },
  { id: 'review', label: 'Review', color: 'bg-warning/15' },
  { id: 'done', label: 'Done', color: 'bg-success/15' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-info/15 text-info',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-destructive/15 text-destructive',
  urgent: 'bg-destructive/20 text-destructive',
};

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', status: 'todo' });
  const [creating, setCreating] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setTasks(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    setCreating(true);
    try {
      const { data, error: err } = await supabase
        .from('tasks')
        .insert({ title: newTask.title, description: newTask.description, priority: newTask.priority, status: newTask.status })
        .select()
        .single();
      if (err) throw err;
      setTasks((prev) => [data, ...prev]);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
      setCreateOpen(false);
      toast({ title: 'Task created', description: `"${data.title}" added.` });
    } catch (err) {
      toast({ title: 'Failed to create task', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const prev = tasks;
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const { error: err } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (err) throw err;
    } catch {
      setTasks(prev);
      toast({ title: 'Failed to update task', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      const { error: err } = await supabase.from('tasks').delete().eq('id', id);
      if (err) throw err;
      toast({ title: 'Task deleted' });
    } catch {
      setTasks(prev);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDrop = (status: string) => {
    if (draggedId) handleStatusChange(draggedId, status);
    setDraggedId(null);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Tasks"
        description="Track your work with a Linear-style kanban board."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={newTask.title} onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))} placeholder="Task title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" value={newTask.description} onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the task..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newTask.status} onValueChange={(v) => setNewTask((p) => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !newTask.title.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <LoadingState message="Loading tasks..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTasks} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Create your first task to start tracking your work."
          action={
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Task
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.color}`} />
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                  </div>
                </div>
                {colTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                  >
                    <Card className="glass glass-hover cursor-grab p-3 active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(task.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[task.priority] || ''}`}>
                          <Flag className="mr-1 h-2.5 w-2.5" />{task.priority}
                        </Badge>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                    Drop tasks here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
