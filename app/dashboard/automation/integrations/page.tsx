"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Loader2,
  Plug,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Youtube,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/shared";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-client";
import {
  disconnectYouTube,
  getAuthUrl,
  getSyncLogs,
  getSyncedChannel,
  getSyncedShorts,
  getSyncedVideos,
  triggerFullSync,
  exchangeCode,
} from "@/lib/youtube";

type IntegrationTab =
  | "youtube"
  | "google"
  | "ai"
  | "storage"
  | "social"
  | "automation"
  | "notifications"
  | "developer"
  | "webhooks";

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProviderUnavailable({ title }: { title: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={
        "Backend endpoint belum terhubung untuk modul ini. Implementasi sudah disiapkan di UI, namun belum ada service layer yang bisa dipanggil dari frontend."
      }
      action={
        <Button variant="outline" asChild>
          <Link href="/dashboard/automation">Back to Automation</Link>
        </Button>
      }
    />
  );
}

export default function IntegrationsCenterPage() {
  const { toast } = useToast();

  const [tab, setTab] = useState<IntegrationTab>("youtube");

  // YouTube state
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytConnected, setYtConnected] = useState(false);
  const [ytChannel, setYtChannel] =
    useState<Awaited<ReturnType<typeof getSyncedChannel>>>(null);
  const [ytVideos, setYtVideos] = useState<
    Awaited<ReturnType<typeof getSyncedVideos>>
  >([]);
  const [ytShorts, setYtShorts] = useState<
    Awaited<ReturnType<typeof getSyncedShorts>>
  >([]);
  const [ytLogs, setYtLogs] = useState<Awaited<ReturnType<typeof getSyncLogs>>>(
    []
  );

  const [syncing, setSyncing] = useState(false);
  const [syncComments, setSyncComments] = useState(true);
  const [syncAnalytics, setSyncAnalytics] = useState(true);
  const [analyticsStartDate, setAnalyticsStartDate] = useState<string>("");
  const [analyticsEndDate, setAnalyticsEndDate] = useState<string>("");

  const [authLoading, setAuthLoading] = useState(false);

  const refreshYouTube = async () => {
    setYtError(null);
    setYtLoading(true);
    try {
      const [ch, videos, shorts, logs] = await Promise.all([
        getSyncedChannel(),
        getSyncedVideos(8, 0),
        getSyncedShorts(6),
        getSyncLogs(5),
      ]);
      setYtChannel(ch);
      setYtVideos(videos);
      setYtShorts(shorts);
      setYtLogs(logs);
      setYtConnected(Boolean(ch));
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to load YouTube integration status.");
      setYtConnected(false);
      setYtChannel(null);
      setYtVideos([]);
      setYtShorts([]);
      setYtLogs([]);
    } finally {
      setYtLoading(false);
    }
  };

  useEffect(() => {
    // Load YouTube integration status on mount (no dummy data)
    refreshYouTube();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OAuth callback handling via query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("callback");
    const code = params.get("code");
    const state = params.get("state");

    // state isn't used by backend client exchangeCode, but included in query anyway.
    if (callback === "1" && code && state) {
      (async () => {
        setAuthLoading(true);
        try {
          const { data } = await supabase.auth.getSession();
          const userId = data.session?.user?.id;
          if (!userId) {
            throw new Error("No active session. Please sign in again.");
          }

          await exchangeCode(code, userId);
          toast({
            title: "YouTube connected",
            description: "Connection saved. Sync can be started now.",
          });

          // Clean URL query params (best-effort)
          const url = new URL(window.location.href);
          url.searchParams.delete("callback");
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.toString());

          await refreshYouTube();
        } catch (e: any) {
          toast({
            title: "YouTube connect failed",
            description: e?.message ?? "Unknown error",
            variant: "destructive",
          });
        } finally {
          setAuthLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setAuthLoading(true);
    try {
      const { authUrl } = await getAuthUrl();
      // Redirect to Google OAuth (real backend edge function)
      window.location.href = authUrl;
    } catch (e: any) {
      toast({
        title: "Connect failed",
        description: e?.message ?? "Unable to start Google OAuth.",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setYtLoading(true);
      await disconnectYouTube();
      toast({ title: "YouTube disconnected" });
      await refreshYouTube();
    } catch (e: any) {
      toast({
        title: "Disconnect failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setYtLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      setYtError(null);

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) throw new Error("No active session.");

      await triggerFullSync(userId, {
        syncComments,
        syncAnalytics,
        analyticsStartDate: analyticsStartDate || undefined,
        analyticsEndDate: analyticsEndDate || undefined,
      });

      toast({
        title: "Sync started",
        description: "Full sync has been queued. Refreshing status…",
      });

      // Best-effort refresh
      await refreshYouTube();
    } catch (e: any) {
      toast({
        title: "Sync failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
      setYtError(e?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const ytHealth = useMemo(() => {
    if (ytLoading) return { label: "Checking…", tone: "bg-muted" };
    if (ytError)
      return { label: "Error", tone: "bg-destructive/10 text-destructive" };
    if (!ytConnected) return { label: "Disconnected", tone: "bg-muted/30" };
    return { label: "Connected", tone: "bg-success/10 text-success" };
  }, [ytConnected, ytError, ytLoading]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Integrations Center"
        description="Connect, manage, monitor, and configure third-party services used throughout CreatorOS AI."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshYouTube}
              disabled={ytLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh YouTube
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as IntegrationTab)}>
        <TabsList className="glass flex flex-wrap gap-2 h-auto">
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="google">Google Account</TabsTrigger>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="developer">Developer API</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* YouTube */}
        {tab === "youtube" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="glass p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Youtube className="h-5 w-5 text-destructive" />
                      <h2 className="font-display text-lg font-semibold">
                        YouTube
                      </h2>
                      <Badge variant="secondary" className={ytHealth.tone}>
                        {ytHealth.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage YouTube connection & run data sync using real
                      backend edge functions.
                    </p>
                  </div>
                </div>

                {ytLoading && (
                  <LoadingState message="Loading YouTube integration…" />
                )}
                {!ytLoading && ytError && (
                  <ErrorState message={ytError} onRetry={refreshYouTube} />
                )}

                {!ytLoading && !ytError && !ytConnected && (
                  <EmptyState
                    icon={Globe}
                    title="YouTube not connected"
                    description="Connect your YouTube account to enable channel sync, uploads, analytics, and reporting."
                    action={
                      <Button onClick={handleConnect} disabled={authLoading}>
                        <Youtube className="mr-2 h-4 w-4" />
                        {authLoading ? (
                          <span className="inline-flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                            Starting OAuth…
                          </span>
                        ) : (
                          "Connect Channel"
                        )}
                      </Button>
                    }
                  />
                )}

                {!ytLoading && !ytError && ytConnected && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {ytChannel?.thumbnail_url ? (
                        <img
                          src={ytChannel.thumbnail_url}
                          alt={ytChannel.title || "YouTube Channel"}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Youtube className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold">
                          {ytChannel?.title || "Unknown Channel"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last sync:{" "}
                          {formatDateTime(ytChannel?.synced_at ?? null)}
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSyncNow}
                          disabled={syncing}
                        >
                          {syncing ? (
                            <span className="inline-flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              Syncing…
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <Activity className="mr-2 h-4 w-4" /> Sync Now
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDisconnect}
                          disabled={ytLoading}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          Subscribers
                        </p>
                        <p className="mt-1 font-display text-lg font-semibold">
                          {ytChannel?.subscriber_count?.toLocaleString?.() ??
                            "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                        <p className="text-xs text-muted-foreground">Views</p>
                        <p className="mt-1 font-display text-lg font-semibold">
                          {ytChannel?.view_count?.toLocaleString?.() ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sync Options
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Sync Analytics
                          </p>
                          <Select
                            value={syncAnalytics ? "yes" : "no"}
                            onValueChange={(v) => setSyncAnalytics(v === "yes")}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Sync Comments
                          </p>
                          <Select
                            value={syncComments ? "yes" : "no"}
                            onValueChange={(v) => setSyncComments(v === "yes")}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Analytics Start Date
                          </p>
                          <Input
                            type="date"
                            value={analyticsStartDate}
                            onChange={(e) =>
                              setAnalyticsStartDate(e.target.value)
                            }
                            disabled={!syncAnalytics}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Analytics End Date
                          </p>
                          <Input
                            type="date"
                            value={analyticsEndDate}
                            onChange={(e) =>
                              setAnalyticsEndDate(e.target.value)
                            }
                            disabled={!syncAnalytics}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={handleSyncNow} disabled={syncing}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {syncing ? "Syncing…" : "Sync Now"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="glass p-5">
                <h3 className="font-display text-sm font-semibold">
                  Recent Sync Logs
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shows last YouTube sync runs persisted in database.
                </p>

                {ytLoading && <LoadingState message="Loading logs…" />}
                {!ytLoading && ytError && (
                  <ErrorState message={ytError} onRetry={refreshYouTube} />
                )}

                {!ytLoading && !ytError && ytLogs.length === 0 && (
                  <EmptyState
                    icon={Clock}
                    title="No sync logs yet"
                    description="Start a sync to generate logs."
                  />
                )}

                {!ytLoading && !ytError && ytLogs.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {ytLogs.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-lg border border-border/50 bg-background/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {l.sync_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started: {formatDateTime(l.started_at)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              l.status === "completed" ? "default" : "secondary"
                            }
                            className={
                              l.status === "completed"
                                ? "bg-success/15 text-success"
                                : l.status === "failed"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-warning/15 text-warning"
                            }
                          >
                            {l.status}
                          </Badge>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">
                              Videos:
                            </span>{" "}
                            {l.videos_synced ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Playlists:
                            </span>{" "}
                            {l.playlists_synced ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Comments:
                            </span>{" "}
                            {l.comments_synced ?? "—"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Completed:
                            </span>{" "}
                            {formatDateTime(l.completed_at)}
                          </div>
                        </div>

                        {l.error_message && (
                          <div className="mt-2 text-xs text-destructive">
                            {l.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="glass p-5">
                <h3 className="font-display text-sm font-semibold">
                  Synced Videos
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Latest synced items from database.
                </p>

                {!ytLoading && ytConnected && ytVideos.length === 0 && (
                  <EmptyState
                    icon={Youtube}
                    title="No videos synced"
                    description="Run Sync Now to populate youtube_videos table."
                  />
                )}

                {!ytLoading && ytConnected && ytVideos.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {ytVideos.map((v) => (
                      <div
                        key={v.video_id}
                        className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 p-3"
                      >
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt={v.title}
                            className="h-10 w-14 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-14 items-center justify-center rounded bg-muted/30 text-muted-foreground">
                            <Youtube className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {v.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Views: {v.view_count?.toLocaleString?.() ?? "—"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {v.privacy_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="glass p-5">
                <h3 className="font-display text-sm font-semibold">
                  Synced Shorts
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Short-form videos (is_short=true).
                </p>

                {!ytLoading && ytConnected && ytShorts.length === 0 && (
                  <EmptyState
                    icon={Plug}
                    title="No shorts synced"
                    description="Run Sync Now to populate youtube_videos where is_short is true."
                  />
                )}

                {!ytLoading && ytConnected && ytShorts.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {ytShorts.map((v) => (
                      <div
                        key={v.video_id}
                        className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 p-3"
                      >
                        <div className="h-10 w-14">
                          {v.thumbnail_url ? (
                            <img
                              src={v.thumbnail_url}
                              alt={v.title}
                              className="h-full w-full rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded bg-muted/30 text-muted-foreground">
                              <Youtube className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {v.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {v.view_count?.toLocaleString?.() ?? "—"} views
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {v.live_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Google */}
        {tab === "google" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Google Account" />
          </div>
        )}

        {/* AI Providers */}
        {tab === "ai" && (
          <div className="space-y-6">
            <ProviderUnavailable title="AI Providers" />
          </div>
        )}

        {/* Storage */}
        {tab === "storage" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Storage" />
          </div>
        )}

        {/* Social */}
        {tab === "social" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Social Media" />
          </div>
        )}

        {/* Automation */}
        {tab === "automation" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Automation" />
          </div>
        )}

        {/* Notifications */}
        {tab === "notifications" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Notifications" />
          </div>
        )}

        {/* Developer API */}
        {tab === "developer" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Developer API" />
          </div>
        )}

        {/* Webhooks */}
        {tab === "webhooks" && (
          <div className="space-y-6">
            <ProviderUnavailable title="Webhooks" />
          </div>
        )}
      </Tabs>
    </div>
  );
}
