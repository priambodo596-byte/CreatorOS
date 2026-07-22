import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-user-token, apikey",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GOOGLE_CLIENT_ID =
  "480542004649-rof1gdtrdlc0i39dr2jvivk1lubraquf.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 403 || res.status === 429) {
        const body = await res.json().catch(() => ({}));
        if (body.error?.errors?.[0]?.reason === "quotaExceeded" || res.status === 429) {
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt + 1) * 1000;
            console.log(`[sync] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
      }
      return res;
    } catch (err) {
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[sync] Network error, retrying in ${delay}ms: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  const tokens = await res.json();
  return tokens.access_token;
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

async function supabaseUpsert(table: string, rows: unknown[], onConflict: string) {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: `return=minimal,resolution=merge-duplicate,upsert=${onConflict}`,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[sync] Upsert to ${table} failed: ${err}`);
  }
}

async function supabaseRpc(fn: string, params: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return res;
}

async function syncChannel(
  token: string,
  userId: string,
  channelId: string,
): Promise<{ uploadsPlaylistId: string; channelData: Record<string, unknown> }> {
  const res = await fetchWithRetry(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails,status&mine=true",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) throw new Error("No channel found");

  const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads || "";
  const channelRow = {
    user_id: userId,
    channel_id: ch.id || channelId,
    title: ch.snippet?.title || "",
    description: ch.snippet?.description || "",
    custom_url: ch.snippet?.customUrl || "",
    country: ch.snippet?.country || "",
    published_at: ch.snippet?.publishedAt || null,
    subscriber_count: Number(ch.statistics?.subscriberCount || 0),
    view_count: Number(ch.statistics?.viewCount || 0),
    video_count: Number(ch.statistics?.videoCount || 0),
    thumbnail_url: ch.snippet?.thumbnails?.default?.url || "",
    banner_url: ch.brandingSettings?.image?.bannerExternalUrl || "",
    keywords: ch.brandingSettings?.channel?.keywords
      ? String(ch.brandingSettings.channel.keywords).split(/\s*,\s*/).filter(Boolean)
      : [],
    topic_categories: ch.topicDetails?.topicCategories || [],
    uploads_playlist_id: uploadsPlaylistId,
    synced_at: new Date().toISOString(),
  };

  await supabaseUpsert("youtube_channels", [channelRow], "user_id,channel_id");
  return { uploadsPlaylistId, channelData: channelRow };
}

async function syncAllVideos(
  token: string,
  userId: string,
  channelId: string,
  uploadsPlaylistId: string,
): Promise<string[]> {
  const allVideoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet,status&playlistId=${uploadsPlaylistId}&maxResults=50`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (data.error) {
      console.error(`[sync] playlistItems error: ${JSON.stringify(data.error)}`);
      break;
    }

    for (const item of data.items || []) {
      const vid = item.contentDetails?.videoId;
      if (vid) allVideoIds.push(vid);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`[sync] Found ${allVideoIds.length} videos, fetching details...`);

  const videoRows: unknown[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const ids = batch.join(",");
    const res = await fetchWithRetry(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status,liveStreamingDetails,topicDetails&id=${ids}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();

    if (data.error) {
      console.error(`[sync] videos.list error: ${JSON.stringify(data.error)}`);
      continue;
    }

    for (const v of data.items || []) {
      const duration = v.contentDetails?.duration || "";
      const durationSec = parseDurationSeconds(duration);
      const isShort = durationSec > 0 && durationSec <= 60;
      const liveStatus = v.liveStreamingDetails
        ? (v.liveStreamingDetails.actualEndTime ? "completed" : "live")
        : "none";

      videoRows.push({
        user_id: userId,
        channel_id: channelId,
        video_id: v.id,
        title: v.snippet?.title || "",
        description: v.snippet?.description || "",
        category_id: v.snippet?.categoryId || "",
        tags: v.snippet?.tags || [],
        published_at: v.snippet?.publishedAt || null,
        duration,
        thumbnail_url: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
        view_count: Number(v.statistics?.viewCount || 0),
        like_count: Number(v.statistics?.likeCount || 0),
        favorite_count: Number(v.statistics?.favoriteCount || 0),
        comment_count: Number(v.statistics?.commentCount || 0),
        privacy_status: v.status?.privacyStatus || "public",
        license: v.status?.license || "",
        caption_status: v.contentDetails?.caption || "",
        made_for_kids: v.status?.madeForKids || false,
        is_short: isShort,
        live_status: liveStatus,
        default_language: v.snippet?.defaultLanguage || "",
        default_audio_language: v.snippet?.defaultAudioLanguage || "",
        synced_at: new Date().toISOString(),
      });
    }
  }

  await supabaseUpsert("youtube_videos", videoRows, "user_id,video_id");
  console.log(`[sync] Upserted ${videoRows.length} video records`);
  return allVideoIds;
}

async function syncPlaylists(
  token: string,
  userId: string,
  channelId: string,
): Promise<number> {
  const allPlaylists: unknown[] = [];
  let pageToken: string | undefined;

  do {
    let url = "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50";
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) {
      console.error(`[sync] playlists error: ${JSON.stringify(data.error)}`);
      break;
    }

    for (const p of data.items || []) {
      allPlaylists.push({
        user_id: userId,
        channel_id: channelId,
        playlist_id: p.id,
        title: p.snippet?.title || "",
        description: p.snippet?.description || "",
        item_count: Number(p.contentDetails?.itemCount || 0),
        published_at: p.snippet?.publishedAt || null,
        thumbnail_url: p.snippet?.thumbnails?.medium?.url || "",
        synced_at: new Date().toISOString(),
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  await supabaseUpsert("youtube_playlists", allPlaylists, "user_id,playlist_id");
  console.log(`[sync] Upserted ${allPlaylists.length} playlists`);
  return allPlaylists.length;
}

async function syncComments(
  token: string,
  userId: string,
  channelId: string,
  videoIds: string[],
): Promise<number> {
  let totalComments = 0;
  const batchSize = 5;

  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);

    for (const videoId of batch) {
      let pageToken: string | undefined;
      let videoComments = 0;
      const commentRows: unknown[] = [];

      do {
        let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&order=time`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        try {
          const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();

          if (data.error) {
            if (data.error.code === 403 && data.error.errors?.[0]?.reason === "commentsDisabled") {
              break;
            }
            console.error(`[sync] commentThreads error for ${videoId}: ${JSON.stringify(data.error)}`);
            break;
          }

          for (const c of data.items || []) {
            const snip = c.snippet?.topLevelComment?.snippet;
            commentRows.push({
              user_id: userId,
              channel_id: channelId,
              video_id: videoId,
              comment_id: c.id,
              author: snip?.authorDisplayName || "",
              author_channel_id: snip?.authorChannelId?.value || "",
              text: snip?.textDisplay || "",
              like_count: Number(snip?.likeCount || 0),
              reply_count: Number(c.snippet?.totalReplyCount || 0),
              published_at: snip?.publishedAt || null,
              updated_at: snip?.updatedAt || null,
              synced_at: new Date().toISOString(),
            });
          }

          videoComments += (data.items || []).length;
          pageToken = data.nextPageToken;
        } catch (err) {
          console.error(`[sync] Comment fetch failed for ${videoId}: ${err.message}`);
          break;
        }
      } while (pageToken);

      if (commentRows.length > 0) {
        await supabaseUpsert("youtube_comments", commentRows, "user_id,comment_id");
      }
      totalComments += videoComments;
    }
  }

  console.log(`[sync] Synced ${totalComments} comments`);
  return totalComments;
}

async function syncAnalytics(
  token: string,
  userId: string,
  channelId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const metrics = "views,estimatedMinutesWatched,averageViewDuration,impressions,impressionsClickThroughRate,subscribersGained,subscribersLost,likes,comments,shares,estimatedRevenue";
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&start-date=${startDate}&end-date=${endDate}&metrics=${metrics}&dimensions=day&sort=day`;

  try {
    const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (data.error) {
      console.error(`[sync] Analytics error: ${JSON.stringify(data.error)}`);
      return;
    }

    if (!data.rows || data.rows.length === 0) {
      console.log("[sync] No analytics rows returned");
      return;
    }

    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || [];
    const analyticsRows = data.rows.map((row: (string | number)[]) => {
      const obj: Record<string, string | number> = {};
      headers.forEach((h: string, idx: number) => { obj[h] = row[idx]; });
      return {
        user_id: userId,
        channel_id: channelId,
        date: String(obj.day),
        views: Number(obj.views || 0),
        estimated_minutes_watched: Number(obj.estimatedMinutesWatched || 0),
        average_view_duration: Number(obj.averageViewDuration || 0),
        impressions: Number(obj.impressions || 0),
        impressions_ctr: Number(obj.impressionsClickThroughRate || 0),
        subscribers_gained: Number(obj.subscribersGained || 0),
        subscribers_lost: Number(obj.subscribersLost || 0),
        likes: Number(obj.likes || 0),
        comments: Number(obj.comments || 0),
        shares: Number(obj.shares || 0),
        estimated_revenue: Number(obj.estimatedRevenue || 0),
        fetched_at: new Date().toISOString(),
      };
    });

    await supabaseUpsert("youtube_analytics_daily", analyticsRows, "user_id,channel_id,date");
    console.log(`[sync] Upserted ${analyticsRows.length} daily analytics rows`);
  } catch (err) {
    console.error(`[sync] Analytics sync failed: ${err.message}`);
  }
}

async function getConnection(userId: string): Promise<{ accessToken: string; refreshToken: string; channelId: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/youtube_connections?user_id=eq.${userId}&select=access_token,refresh_token,token_expires_at,channel_id`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error("No YouTube connection found");
  }
  const conn = data[0];
  return {
    accessToken: conn.access_token,
    refreshToken: conn.refresh_token,
    channelId: conn.channel_id || "unknown",
  };
}

async function updateConnectionToken(userId: string, newToken: string, expiresIn: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/youtube_connections?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      access_token: newToken,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const userId: string = payload.userId;
    const shouldSyncComments: boolean = payload.syncComments !== false;
    const shouldSyncAnalytics: boolean = payload.syncAnalytics !== false;
    const analyticsStartDate: string = payload.analyticsStartDate || "2000-01-01";
    const analyticsEndDate: string = payload.analyticsEndDate || new Date().toISOString().split("T")[0];

    if (!userId) {
      return json({ error: "Missing userId" }, 400);
    }

    const conn = await getConnection(userId);
    let token = conn.accessToken;

    const testRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (testRes.status === 401 && conn.refreshToken) {
      console.log("[sync] Access token expired, refreshing...");
      token = await refreshAccessToken(conn.refreshToken);
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: conn.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const tokens = await tokenRes.json();
      await updateConnectionToken(userId, tokens.access_token, tokens.expires_in);
    }

    const syncLogRes = await fetch(`${SUPABASE_URL}/rest/v1/youtube_sync_logs`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        sync_type: "full",
        status: "running",
        started_at: new Date().toISOString(),
      }),
    });
    const syncLogData = await syncLogRes.json();
    const syncLogId = syncLogData?.[0]?.id;

    const { uploadsPlaylistId, channelData } = await syncChannel(token, userId, conn.channelId);
    const videoIds = await syncAllVideos(token, userId, conn.channelId, uploadsPlaylistId);
    const playlistCount = await syncPlaylists(token, userId, conn.channelId);

    let commentCount = 0;
    if (shouldSyncComments && videoIds.length > 0) {
      commentCount = await syncComments(token, userId, conn.channelId, videoIds);
    }

    if (shouldSyncAnalytics) {
      await syncAnalytics(token, userId, conn.channelId, analyticsStartDate, analyticsEndDate);
    }

    await fetch(`${SUPABASE_URL}/rest/v1/youtube_sync_logs?id=eq.${syncLogId}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "completed",
        videos_synced: videoIds.length,
        comments_synced: commentCount,
        playlists_synced: playlistCount,
        completed_at: new Date().toISOString(),
      }),
    });

    return json({
      success: true,
      channel: {
        title: channelData.title,
        channelId: channelData.channel_id,
        subscriberCount: channelData.subscriber_count,
        viewCount: channelData.view_count,
        videoCount: channelData.video_count,
      },
      stats: {
        videosSynced: videoIds.length,
        commentsSynced: commentCount,
        playlistsSynced: playlistCount,
      },
    });
  } catch (err) {
    console.error(`[sync] Fatal error: ${err.message}`);
    return json({ error: err.message }, 500);
  }
});
