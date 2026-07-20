'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Video,
  Calendar,
  Clock,
  TrendingUp,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-supabase-query';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState, LoadingState, formatNumber } from '@/components/dashboard/shared';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';

interface Project {
  id: string;
  name: string;
  description: string | null;
  channel_id: string | null;
  status: string;
  progress: number;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  last_published_at: string | null;
}

const STATUS_OPTIONS = ['planning', 'in_progress', 'review', 'published', 'archived'];
const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-muted/20 text-muted-foreground',
  in_progress: 'bg-primary/15 text-primary',
  review: 'bg-warning/15 text-warning',
  published: 'bg-success/15 text-success',
  archived: 'bg-muted/30 text-muted-foreground',
};

export default function ProjectsPage() {
  const { toast } = useToast();
  const sync = useYouTubeSync();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('projects').select('*');
      if (debouncedSearch) query = query.ilike('name', `%${debouncedSearch}%`);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      query = query.order(sortBy, { ascending: false });
      const { data, error: err } = await query;
      if (err) throw err;
      setProjects(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sortBy]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .insert({ name: newProject.name, description: newProject.description })
        .select()
        .single();
      if (err) throw err;
      setProjects((prev) => [data, ...prev]);
      setNewProject({ name: '', description: '' });
      setCreateOpen(false);
      toast({ title: 'Project created', description: `"${data.name}" is ready.` });
    } catch (err) {
      toast({ title: 'Failed to create project', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (p: Project) => {
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .insert({ name: `${p.name} (copy)`, description: p.description, channel_id: p.channel_id })
        .select()
        .single();
      if (err) throw err;
      setProjects((prev) => [data, ...prev]);
      toast({ title: 'Project duplicated', description: `"${data.name}" created.` });
    } catch (err) {
      toast({ title: 'Failed to duplicate', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleArchive = async (p: Project) => {
    try {
      const { error: err } = await supabase
        .from('projects')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', p.id);
      if (err) throw err;
      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: 'archived' } : x)));
      toast({ title: 'Project archived', description: `"${p.name}" archived.` });
    } catch (err) {
      toast({ title: 'Failed to archive', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error: err } = await supabase.from('projects').delete().eq('id', id);
      if (err) throw err;
      setProjects((prev) => prev.filter((x) => x.id !== id));
      setConfirmDelete(null);
      toast({ title: 'Project deleted' });
    } catch (err) {
      toast({ title: 'Failed to delete', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const stats = {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === 'in_progress').length,
    published: projects.filter((p) => p.status === 'published').length,
    archived: projects.filter((p) => p.status === 'archived').length,
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Projects"
        description="Manage your creator projects from ideation to publication."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                    placeholder="My Awesome Video"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    value={newProject.description}
                    onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the project..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !newProject.name.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Projects', value: stats.total, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'In Progress', value: stats.inProgress, icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Published', value: stats.published, icon: Video, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Archived', value: stats.archived, icon: Archive, color: 'text-muted-foreground', bg: 'bg-muted/20' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="glass glass-hover p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="mt-4 font-display text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Last Updated</SelectItem>
            <SelectItem value="created_at">Created Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading projects..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start managing your content pipeline."
          action={
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass glass-hover overflow-hidden p-0">
                {p.thumbnail_url ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img src={p.thumbnail_url} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
                    <FolderKanban className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm line-clamp-1">{p.name}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(p)}>
                          <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(p.id)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {p.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className={STATUS_COLORS[p.status] || ''}>
                      {p.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} className="h-1.5" />
                  </div>
                  {p.last_published_at && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Published {new Date(p.last_published_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This action cannot be undone. The project and all its tasks will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
