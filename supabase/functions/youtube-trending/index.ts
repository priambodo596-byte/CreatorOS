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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";

const GOOGLE_CLIENT_ID =
  "480542004649-rof1gdtrdlc0i39dr2jvivk1lubraquf.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

const YOUTUBE_CATEGORIES: Record<string, string> = {
  "1": "Film & Animation",
  "2": "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "19": "Travel & Events",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Tech",
  "29": "Nonprofits & Activism",
};

interface RawVideoItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
    categoryId?: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

function estimateAudience(viewCount: number): string {
  if (viewCount >= 10_000_000) return "10M+";
  if (viewCount >= 1_000_000) return "1M-10M";
  if (viewCount >= 100_000) return "100K-1M";
  if (viewCount >= 10_000) return "10K-100K";
  if (viewCount >= 1_000) return "1K-10K";
  return "< 1K";
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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
  return { access_token: tokens.access_token, expires_in: tokens.expires_in || 3600 };
}

async function getUserConnection(userId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/youtube_connections?user_id=eq.${userId}&select=access_token,refresh_token,token_expires_at`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return {
    accessToken: data[0].access_token,
    refreshToken: data[0].refresh_token,
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

async function fetchTrending(
  accessToken: string,
  region: string,
  category: string,
  maxResults: number,
): Promise<RawVideoItem[]> {
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    chart: "mostPopular",
    regionCode: region,
    maxResults: maxResults.toString(),
    hl: "en",
  });
  if (category !== "0" && category !== "All") {
    params.set("videoCategoryId", category);
  }

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (YOUTUBE_API_KEY) {
    params.set("key", YOUTUBE_API_KEY);
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    { headers },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`YouTube Data API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.items || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const region: string = payload.region || payload.country || "US";
    const category: string = payload.category || "0";
    const maxResults: number = Math.min(50, Math.max(1, payload.maxResults || 25));
    const userId: string | undefined = payload.userId;
    const accessToken: string | undefined = payload.accessToken;

    let token: string | undefined = accessToken;

    // If no explicit accessToken, try to fetch from user's YouTube connection
    if (!token && userId) {
      const conn = await getUserConnection(userId);
      if (conn) {
        token = conn.accessToken;
        // Check if token is expired and refresh if needed
        try {
          const testRes = await fetch(
            "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (testRes.status === 401 && conn.refreshToken) {
            console.log("[trending] Access token expired, refreshing...");
            const refreshed = await refreshAccessToken(conn.refreshToken);
            token = refreshed.access_token;
            await updateConnectionToken(userId, token, refreshed.expires_in);
          }
        } catch (refreshErr) {
          console.warn("[trending] Token refresh failed:", refreshErr.message);
        }
      }
    }

    if (!token && !YOUTUBE_API_KEY) {
      return json(
        {
          error: "No YouTube authentication available. Connect your YouTube account in Settings or configure YOUTUBE_API_KEY.",
          needsConnection: true,
        },
        401,
      );
    }

    const items = await fetchTrending(token || "", region, category, maxResults);

    if (items.length === 0) {
      return json({
        videos: [],
        fetchedAt: new Date().toISOString(),
        region,
        category,
      });
    }

    const now = Date.now();
    const videos = items.map((item) => {
      const viewCount = parseInt(item.statistics?.viewCount || "0", 10);
      const likeCount = parseInt(item.statistics?.likeCount || "0", 10);
      const commentCount = parseInt(item.statistics?.commentCount || "0", 10);
      const publishedAt = item.snippet?.publishedAt || new Date().toISOString();
      const ageDays = Math.max(
        1,
        (now - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      const viewsPerDay = viewCount / ageDays;
      const viewsPerHour = viewCount / (ageDays * 24);
      const durationSeconds = parseDurationToSeconds(item.contentDetails?.duration || "");
      const engagementRate = viewCount > 0
        ? ((likeCount + commentCount) / viewCount) * 100
        : 0;

      // Growth rate: views per day relative to total views (higher = newer/faster growing)
      const growthRate = viewCount > 0
        ? Math.round((viewsPerDay / viewCount) * 100 * 30) // 30-day projection
        : 0;

      // Virality score: weighted combination of engagement, velocity, and views
      const engagementScore = Math.min(40, (engagementRate / 5) * 40);
      const velocityScore = Math.min(30, (viewsPerDay / 10000) * 30);
      const durationScore =
        durationSeconds >= 180 && durationSeconds <= 600 ? 15 :
        durationSeconds >= 60 && durationSeconds < 180 ? 10 :
        durationSeconds > 600 ? 8 : 5;
      const viewsScore = Math.min(15, (viewCount / 1_000_000) * 15);
      const viralityScore = Math.round(engagementScore + velocityScore + durationScore + viewsScore);

      // Trend score: similar but weighted more toward recency and growth
      const recencyScore = Math.min(30, Math.max(5, 30 - ageDays * 0.5));
      const trendScore = Math.round(
        Math.min(40, (viewsPerDay / 5000) * 40) +
        recencyScore +
        Math.min(20, engagementScore / 2) +
        Math.min(10, (viewCount / 5_000_000) * 10),
      );

      const categoryId = item.snippet?.categoryId || "0";
      const language = item.snippet?.defaultLanguage || item.snippet?.defaultAudioLanguage || "en";

      return {
        id: item.id,
        video_id: item.id,
        title: item.snippet?.title || "",
        channel_title: item.snippet?.channelTitle || "",
        channel_id: item.snippet?.channelId || "",
        thumbnail_url: item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url || "",
        published_at: publishedAt,
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        duration: item.contentDetails?.duration || "",
        category_id: categoryId,
        category: YOUTUBE_CATEGORIES[categoryId] || "Unknown",
        country: region,
        language,
        growth_rate: growthRate,
        trend_score: Math.min(100, trendScore),
        virality_score: Math.min(100, viralityScore),
        estimated_audience: estimateAudience(viewCount),
        view_velocity: Math.round(viewsPerHour),
        cached_at: new Date().toISOString(),
      };
    });

    videos.sort((a, b) => b.trend_score - a.trend_score);

    return json({
      videos,
      fetchedAt: new Date().toISOString(),
      region,
      category,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
