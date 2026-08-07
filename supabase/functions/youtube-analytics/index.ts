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

function errorResponse(code: string, message: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ success: false, code, message, ...extra }, status);
}

function getOAuthCredentials() {
  const ytClientId = Deno.env.get("YOUTUBE_CLIENT_ID");
  const ytClientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET");
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (ytClientId && ytClientSecret) {
    return { clientId: ytClientId, clientSecret: ytClientSecret };
  }
  if (googleClientId && googleClientSecret) {
    return { clientId: googleClientId, clientSecret: googleClientSecret };
  }
  throw new Error(
    "YouTube OAuth credentials not configured. Set YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET (or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) as Supabase Edge Function secrets.",
  );
}

interface ConnectionRow {
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scope: string;
  channel_id: string;
}

async function getConnection(userId: string): Promise<ConnectionRow | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log("[youtube-analytics] Looking up connection for user:", userId);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/youtube_connections?user_id=eq.${userId}&select=access_token,refresh_token,token_expires_at,scope,channel_id`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    console.error("[youtube-analytics] DB query failed:", res.status, await res.text());
    return null;
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("[youtube-analytics] No connection found for user");
    return null;
  }
  console.log("[youtube-analytics] Connection found. Channel ID:", rows[0].channel_id);
  console.log("[youtube-analytics] Token exists:", Boolean(rows[0].access_token));
  console.log("[youtube-analytics] Refresh token exists:", Boolean(rows[0].refresh_token));
  console.log("[youtube-analytics] Token expires at:", rows[0].token_expires_at);
  console.log("[youtube-analytics] Scope:", rows[0].scope);
  return rows[0] as ConnectionRow;
}

async function updateTokens(userId: string, accessToken: string, expiresInSeconds: number) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/youtube_connections?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!res.ok) {
    console.error("[youtube-analytics] Failed to update token in DB:", res.status);
  } else {
    console.log("[youtube-analytics] Token updated in DB successfully");
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const creds = getOAuthCredentials();
  console.log("[youtube-analytics] Refreshing access token...", {
    client_id_prefix: creds.clientId.slice(0, 8) + "...",
    client_secret_length: creds.clientSecret.length,
    has_refresh_token: !!refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[youtube-analytics] Token refresh failed:", {
      httpStatus: res.status,
      responseBody: errText,
      client_id_prefix: creds.clientId.slice(0, 8) + "...",
    });
    if (res.status === 401 && errText.includes("invalid_client")) {
      throw new Error("Google rejected the OAuth credentials (invalid_client). Verify YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET match a single Google OAuth Client, then re-connect your YouTube account.");
    }
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  const tokens = await res.json();
  console.log("[youtube-analytics] Token refreshed successfully, expires in", tokens.expires_in, "seconds");
  return { access_token: tokens.access_token, expires_in: tokens.expires_in };
}

async function getValidToken(userId: string): Promise<{ token: string; error: Response | null }> {
  const conn = await getConnection(userId);
  if (!conn) {
    return {
      token: "",
      error: errorResponse("YOUTUBE_CONNECTION_NOT_FOUND", "YouTube account is not connected. Please connect your YouTube account first.", 404),
    };
  }

  const hasAnalyticsScope = conn.scope?.includes("yt-analytics.readonly");
  if (!hasAnalyticsScope) {
    return {
      token: "",
      error: errorResponse("ANALYTICS_PERMISSION_MISSING", "YouTube Analytics permission is required. Please reconnect your YouTube account to grant analytics access.", 403),
    };
  }

  const isExpired = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime() < Date.now() + 60000
    : true;

  if (!isExpired) {
    console.log("[youtube-analytics] Using existing access token (not expired)");
    return { token: conn.access_token, error: null };
  }

  console.log("[youtube-analytics] Access token is expired, attempting refresh");

  if (!conn.refresh_token) {
    return {
      token: "",
      error: errorResponse("YOUTUBE_REAUTH_REQUIRED", "YouTube authorization has expired and no refresh token is available. Please reconnect your account.", 401),
    };
  }

  try {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    await updateTokens(userId, refreshed.access_token, refreshed.expires_in);
    return { token: refreshed.access_token, error: null };
  } catch (err) {
    return {
      token: "",
      error: errorResponse("YOUTUBE_REAUTH_REQUIRED", `Failed to refresh YouTube token: ${err.message}. Please reconnect your account.`, 401),
    };
  }
}

async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    console.log("[youtube-analytics] No Authorization header");
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.log("[youtube-analytics] Invalid JWT format (parts:", parts.length, ")");
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub || null;
    if (userId) {
      console.log("[youtube-analytics] User authenticated:", userId);
    }
    return userId;
  } catch (err) {
    console.error("[youtube-analytics] JWT decode failed:", err.message);
    return null;
  }
}

function buildAnalyticsUrl(params: {
  startDate: string;
  endDate: string;
  metrics: string;
  dimensions: string;
  sort?: string;
  maxResults?: number;
}): string {
  const qs = new URLSearchParams();
  qs.set("ids", "channel==MINE");
  qs.set("start-date", params.startDate);
  qs.set("end-date", params.endDate);
  qs.set("metrics", params.metrics);
  qs.set("dimensions", params.dimensions);
  if (params.sort) qs.set("sort", params.sort);
  if (params.maxResults) qs.set("maxResults", String(params.maxResults));
  return `https://youtubeanalytics.googleapis.com/v2/reports?${qs.toString()}`;
}

function getDateRange(params: { startDate?: string; endDate?: string }): { startDate: string; endDate: string } {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return {
    startDate: params.startDate || thirtyDaysAgo,
    endDate: params.endDate || today,
  };
}

async function fetchYouTubeAnalytics(url: string, token: string): Promise<Response> {
  console.log("[youtube-analytics] Fetching:", url.replace(/access_token=[^&]+/, 'access_token=REDACTED'));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error("[youtube-analytics] YouTube API error:", {
      status: res.status,
      response: errBody,
    });
  }
  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log("[youtube-analytics] Request received");

  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return errorResponse("AUTHORIZATION_HEADER_MISSING", "Authentication required. Please sign in.", 401);
    }

    let payload: { action?: string; params?: Record<string, unknown> };
    try {
      payload = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST_BODY", "Request body must be valid JSON.", 400);
    }

    const action: string = payload.action || "";
    if (!action) {
      return errorResponse("MISSING_ACTION", "Request body must include an 'action' field.", 400);
    }

    console.log("[youtube-analytics] Action:", action);

    const { token, error } = await getValidToken(userId);
    if (error) return error;

    const params = payload.params || {};

    // ─── channel-stats ─────────────────────────────────────────────────────
    if (action === "channel-stats") {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&mine=true",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!res.ok) {
        console.error("[youtube-analytics] channel-stats error:", res.status, JSON.stringify(data));
        return errorResponse("YOUTUBE_API_ERROR", data.error?.message || "YouTube API error", res.status, { youtubeError: data.error });
      }
      return json(data);
    }

    // ─── analytics (Views & Subscribers chart) ────────────────────────────
    if (action === "analytics") {
      const { startDate, endDate } = getDateRange({
        startDate: params.startDate as string | undefined,
        endDate: params.endDate as string | undefined,
      });
      const metricsStr = (params.metrics as string) ||
        "views,estimatedMinutesWatched,averageViewDuration,impressions,impressionsClickThroughRate,subscribersGained,subscribersLost,likes,comments,shares";

      console.log("[youtube-analytics] Date range:", { startDate, endDate });

      if (new Date(startDate) > new Date(endDate)) {
        return errorResponse("INVALID_DATE_RANGE", `Start date (${startDate}) cannot be after end date (${endDate}).`, 400);
      }

      const url = buildAnalyticsUrl({
        startDate,
        endDate,
        metrics: metricsStr,
        dimensions: "day",
        sort: "day",
      });

      const res = await fetchYouTubeAnalytics(url, token);
      const data = await res.json();
      if (!res.ok) {
        return errorResponse("YOUTUBE_ANALYTICS_ERROR", data.error?.message || "YouTube Analytics API error", res.status, { youtubeError: data.error });
      }
      return json(data);
    }

    // ─── videos ────────────────────────────────────────────────────────────
    if (action === "videos") {
      const maxResults = (params.maxResults as number) || 10;
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&forMine=true&type=video&maxResults=${maxResults}&order=date`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const searchData = await searchRes.json();
      if (!searchRes.ok) {
        console.error("[youtube-analytics] videos search error:", searchRes.status, JSON.stringify(searchData));
        return errorResponse("YOUTUBE_API_ERROR", searchData.error?.message || "YouTube API error", searchRes.status, { youtubeError: searchData.error });
      }
      const videoIds = searchData.items
        ?.map((i: { id?: { videoId?: string } }) => i.id?.videoId)
        .filter(Boolean).join(",");

      if (!videoIds) return json({ items: [] });

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const detailsData = await detailsRes.json();
      if (!detailsRes.ok) {
        console.error("[youtube-analytics] videos details error:", detailsRes.status, JSON.stringify(detailsData));
        return errorResponse("YOUTUBE_API_ERROR", detailsData.error?.message || "YouTube API error", detailsRes.status, { youtubeError: detailsData.error });
      }
      return json(detailsData);
    }

    // ─── traffic-sources ──────────────────────────────────────────────────
    if (action === "traffic-sources") {
      const { startDate, endDate } = getDateRange({});
      const url = buildAnalyticsUrl({
        startDate,
        endDate,
        metrics: "views",
        dimensions: "insightTrafficSourceType",
        sort: "-views",
      });

      const res = await fetchYouTubeAnalytics(url, token);
      const data = await res.json();
      if (!res.ok) {
        return errorResponse("YOUTUBE_ANALYTICS_ERROR", data.error?.message || "YouTube Analytics API error", res.status, { youtubeError: data.error });
      }
      return json(data);
    }

    // ─── top-countries ─────────────────────────────────────────────────────
    if (action === "top-countries") {
      const { startDate, endDate } = getDateRange({});
      const url = buildAnalyticsUrl({
        startDate,
        endDate,
        metrics: "views",
        dimensions: "country",
        sort: "-views",
        maxResults: 10,
      });

      const res = await fetchYouTubeAnalytics(url, token);
      const data = await res.json();
      if (!res.ok) {
        return errorResponse("YOUTUBE_ANALYTICS_ERROR", data.error?.message || "YouTube Analytics API error", res.status, { youtubeError: data.error });
      }
      return json(data);
    }

    // ─── demographics ──────────────────────────────────────────────────────
    if (action === "demographics") {
      const url = buildAnalyticsUrl({
        startDate: "2025-01-01",
        endDate: new Date().toISOString().split("T")[0],
        metrics: "viewerPercentage",
        dimensions: "ageGroup,gender",
      });

      const res = await fetchYouTubeAnalytics(url, token);
      const data = await res.json();
      if (!res.ok) {
        return errorResponse("YOUTUBE_ANALYTICS_ERROR", data.error?.message || "YouTube Analytics API error", res.status, { youtubeError: data.error });
      }
      return json(data);
    }

    return errorResponse("UNKNOWN_ACTION", `Unknown action: "${action}". Supported: channel-stats, analytics, videos, traffic-sources, top-countries, demographics`, 400);
  } catch (err) {
    console.error("[youtube-analytics] Unhandled error:", err.message);
    return errorResponse("INTERNAL_ERROR", err.message, 500);
  }
});
