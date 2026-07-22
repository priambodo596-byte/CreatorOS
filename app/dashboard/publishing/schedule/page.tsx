'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  Youtube,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarClock,
  ListVideo,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  SearchInput,
  formatNumber,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { getSyncedVideos, triggerFullSync, type SyncedVideo } from '@/lib/youtube';
import { supabase } from '@/lib/supabase-client';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  video_id: string | null;
  status: string;
  created_at: string;
}

export default function SchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [videos, setVideos] = useState<SyncedVideo[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [videosData, eventsData] = await Promise.all([
        getSyncedVideos(50),
        supabase
          .from('calendar_events')
          .select('*')
          .order('scheduled_at', { ascending: true })
          .then(({ data, error: e }) => {
            if (e) throw e;
            return (data || []) as CalendarEvent[];
          }),
      ]);
      setVideos(videosData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await triggerFullSync(user.id, { syncComments: false, syncAnalytics: false });
      toast({ title: 'Sync complete', description: 'Your scheduled videos are up to date' });
      await loadData();
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Filter videos that are scheduled or have privacy_status indicating scheduled
  const scheduledVideos = videos.filter(
    (v) =>
      v.privacy_status === 'scheduled' ||
      v.privacy_status === 'private' ||
      v.live_status === 'upcoming',
  );

  const filteredVideos = scheduledVideos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()),
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'published':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Scheduled
          </Badge>
        );
      case 'private':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Private
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Draft
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="View and manage your scheduled YouTube videos and calendar events"
        actions={
          <Button onClick={handleSync} disabled={syncing || !user}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync with YouTube
              </>
            )}
          </Button>
        }
      />

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Search scheduled content..." />

      {loading ? (
        <Card className="glass p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading scheduled content...</span>
          </div>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : scheduledVideos.length === 0 && events.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled content"
          description="Your scheduled YouTube videos and calendar events will appear here."
          action={
            <Button onClick={handleSync} disabled={syncing}>
              <Youtube className="mr-2 h-4 w-4" />
              Sync Now
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="videos">
          <TabsList>
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4" />
              YouTube Videos ({filteredVideos.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar Events ({filteredEvents.length})
            </TabsTrigger>
          </TabsList>

          {/* YouTube Videos tab */}
          <TabsContent value="videos">
            {filteredVideos.length === 0 ? (
              <EmptyState
                icon={ListVideo}
                title={search ? 'No matching videos' : 'No scheduled videos'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Videos with privacy_status "scheduled" or "private" will appear here.'
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredVideos.map((video, i) => (
                    <motion.div
                      key={video.video_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="glass glass-hover p-4">
                        <div className="flex items-start gap-4">
                          {/* Thumbnail */}
                          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {video.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={video.thumbnail_url}
                                alt={video.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Youtube className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-medium" title={video.title}>
                              {video.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Published: {new Date(video.published_at).toLocaleDateString()}
                              </span>
                              <span>{formatNumber(video.view_count)} views</span>
                              <span>{video.is_short ? 'Short' : 'Video'}</span>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {getStatusBadge(video.privacy_status)}
                            {video.live_status === 'upcoming' && (
                              <Badge variant="outline" className="text-xs">
                                <CalendarClock className="mr-1 h-3 w-3" />
                                Upcoming
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* Calendar Events tab */}
          <TabsContent value="events">
            {filteredEvents.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={search ? 'No matching events' : 'No calendar events'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'Calendar events from your Supabase calendar_events table will appear here.'
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredEvents.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="glass glass-hover p-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <CalendarClock className="h-5 w-5 text-primary" />
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-medium" title={event.title}>
                              {event.title}
                            </h3>
                            {event.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {event.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(event.scheduled_at).toLocaleString()}
                              </span>
                              {event.video_id && (
                                <span className="flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  Linked video
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {getStatusBadge(event.status)}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
