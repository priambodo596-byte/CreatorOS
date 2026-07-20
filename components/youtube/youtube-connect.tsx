'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Youtube, Check, Loader2, Unlink, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth-context';
import {
  getAuthUrl,
  getConnection,
  disconnectYouTube,
  type YouTubeConnection,
} from '@/lib/youtube';
import { toast } from 'sonner';

const PENDING_KEY = 'youtube-oauth-pending';

export function YouTubeConnect() {
  const [connection, setConnection] = useState<YouTubeConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const conn = await getConnection();
      setConnection(conn);
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending === 'true') {
      sessionStorage.removeItem(PENDING_KEY);
      const justConnected = sessionStorage.getItem('youtube-oauth-success');
      if (justConnected === 'true') {
        sessionStorage.removeItem('youtube-oauth-success');
        toast.success('YouTube channel connected!');
      }
      refresh();
    }
  }, [refresh]);

  const handleConnect = async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }
    setConnecting(true);
    try {
      const { authUrl } = await getAuthUrl();
      sessionStorage.setItem(PENDING_KEY, 'true');
      window.location.href = authUrl;
    } catch {
      setConnecting(false);
      toast.error('Failed to start YouTube connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectYouTube();
      setConnection(null);
      toast.success('YouTube channel disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <Card className="glass p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Checking YouTube connection...</span>
        </div>
      </Card>
    );
  }

  if (connection) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={connection.channel_thumbnail} alt={connection.channel_title} />
                <AvatarFallback>
                  <Youtube className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-semibold">{connection.channel_title}</h3>
                  <Badge className="bg-success/15 text-success">
                    <Check className="mr-1 h-3 w-3" />Connected
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(connection.connected_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                <Unlink className="mr-1.5 h-3.5 w-3.5" />Disconnect
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-destructive/20 to-warning/20">
            <Youtube className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">Connect YouTube Channel</h3>
            <p className="text-sm text-muted-foreground">
              Connect your channel to fetch real analytics, video data, and audience insights.
            </p>
          </div>
          <Button
            onClick={handleConnect}
            disabled={connecting || !user}
            className="bg-gradient-to-r from-destructive to-warning text-white"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Redirecting...
              </>
            ) : (
              <>
                <Youtube className="mr-2 h-4 w-4" />Connect YouTube
              </>
            )}
          </Button>
        </div>
        {!user && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning">
            <AlertCircle className="h-4 w-4" />
            You must be signed in to connect your YouTube channel.
          </div>
        )}
      </Card>
    </motion.div>
  );
}
