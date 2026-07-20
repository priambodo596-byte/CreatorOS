'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Loader2,
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
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { useYouTubeSync } from '@/hooks/use-youtube-sync';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '@/components/dashboard/shared';

interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  scheduled_date: string;
  video_id: string | null;
  project_id: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  draft: 'bg-muted/30 text-muted-foreground border-muted/40',
  scheduled: 'bg-primary/15 text-primary border-primary/30',
  published: 'bg-success/15 text-success border-success/30',
};

type ViewMode = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const { toast } = useToast();
  const sync = useYouTubeSync();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [createOpen, setCreateOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', type: 'draft', scheduledDate: '' });
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('calendar_events')
        .select('*')
        .order('scheduled_date', { ascending: true });
      if (err) throw err;
      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Merge synced YouTube videos as calendar events
  const allEvents = useMemo(() => {
    const syncedVideoEvents: CalendarEvent[] = sync.videos.map((v) => ({
      id: `yt-${v.video_id}`,
      title: v.title,
      type: v.privacy_status === 'public' ? 'published' : 'draft',
      scheduled_date: v.published_at,
      video_id: v.video_id,
      project_id: null,
    }));
    return [...events, ...syncedVideoEvents];
  }, [events, sync.videos]);

  const handleCreate = async () => {
    if (!newEvent.title.trim() || !newEvent.scheduledDate) return;
    setCreating(true);
    try {
      const { data, error: err } = await supabase
        .from('calendar_events')
        .insert({
          title: newEvent.title,
          type: newEvent.type,
          scheduled_date: new Date(newEvent.scheduledDate).toISOString(),
        })
        .select()
        .single();
      if (err) throw err;
      setEvents((prev) => [...prev, data]);
      setNewEvent({ title: '', type: 'draft', scheduledDate: '' });
      setCreateOpen(false);
      toast({ title: 'Event created', description: `"${data.title}" scheduled.` });
    } catch (err) {
      toast({ title: 'Failed to create event', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    return allEvents.filter((e) => e.scheduled_date && new Date(e.scheduled_date).toDateString() === dateStr);
  };

  const navigateMonth = (dir: number) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear() &&
      day === today.getDate()
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Content Calendar"
        description="Plan and schedule your content across draft, scheduled, and published videos."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Content</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} placeholder="Video title or event" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newEvent.type} onValueChange={(v) => setNewEvent((p) => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={newEvent.scheduledDate} onChange={(e) => setNewEvent((p) => ({ ...p, scheduledDate: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !newEvent.title.trim() || !newEvent.scheduledDate}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-display text-lg font-semibold min-w-[140px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg glass p-1">
          {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
            <Button
              key={m}
              variant={viewMode === m ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(m)}
              className="capitalize"
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading calendar..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchEvents} />
      ) : viewMode === 'month' ? (
        <Card className="glass p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] rounded-lg bg-muted/10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className={`min-h-[80px] rounded-lg border p-1.5 transition-colors hover:bg-muted/20 ${
                    isToday(day) ? 'border-primary/50 bg-primary/5' : 'border-border/30'
                  }`}
                >
                  <span className={`text-xs ${isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium border ${TYPE_COLORS[e.type] || TYPE_COLORS.draft}`}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      ) : viewMode === 'week' ? (
        <Card className="glass p-4">
          <div className="grid grid-cols-7 gap-2">
            {getWeekDays().map((d, i) => {
              const dayEvents = allEvents.filter((e) => e.scheduled_date && new Date(e.scheduled_date).toDateString() === d.toDateString());
              return (
                <div key={i} className="min-h-[200px] rounded-lg border border-border/30 p-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {dayNames[d.getDay()]} {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((e) => (
                      <div key={e.id} className={`truncate rounded px-1.5 py-1 text-xs border ${TYPE_COLORS[e.type] || TYPE_COLORS.draft}`}>
                        {e.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="glass p-4">
          <div className="space-y-2">
            {allEvents
              .filter((e) => e.scheduled_date && new Date(e.scheduled_date).toDateString() === currentDate.toDateString())
              .map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg glass p-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant="secondary" className={TYPE_COLORS[e.type] || ''}>{e.type}</Badge>
                </div>
              ))}
            {allEvents.filter((e) => e.scheduled_date && new Date(e.scheduled_date).toDateString() === currentDate.toDateString()).length === 0 && (
              <EmptyState icon={CalendarDays} title="No events today" description="Schedule content for this day." />
            )}
          </div>
        </Card>
      )}

      {/* Summary */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Drafts', count: allEvents.filter((e) => e.type === 'draft').length, color: 'text-muted-foreground' },
            { label: 'Scheduled', count: allEvents.filter((e) => e.type === 'scheduled').length, color: 'text-primary' },
            { label: 'Published', count: allEvents.filter((e) => e.type === 'published').length, color: 'text-success' },
          ].map((s) => (
            <Card key={s.label} className="glass p-4 text-center">
              <p className={`font-display text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
