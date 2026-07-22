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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const accessToken: string | undefined = payload.accessToken;
    const refreshToken: string | undefined = payload.refreshToken;
    const action: string | undefined = payload.action;
    const params = payload.params || {};

    let token = accessToken;

    if (refreshToken) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (tokenRes.ok) {
        const tokens = await tokenRes.json();
        token = tokens.access_token;
      }
    }

    if (!token) {
      return json({ error: "No valid access token" }, 401);
    }

    if (action === "channel-stats") {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&mine=true",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return json(data);
    }

    if (action === "analytics") {
      const { startDate, endDate, metrics } = params;
      const endDateOrToday = endDate ||
        new Date().toISOString().split("T")[0];
      const startDateOr30DaysAgo = startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split(
          "T",
        )[0];
      const metricsStr = metrics ||
        "views,estimatedMinutesWatched,averageViewDuration,impressions,impressionsClickThroughRate,subscribersGained,subscribersLost,likes,comments,shares";

      const ytAnalyticsUrl =
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==MINE&start-date=${startDateOr30DaysAgo}&end-date=${endDateOrToday}&` +
        `metrics=${metricsStr}&dimensions=day&sort=day`;

      const res = await fetch(ytAnalyticsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return json(data);
    }

    if (action === "videos") {
      const maxResults = params.maxResults || 10;

      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&forMine=true&type=video&maxResults=${maxResults}&order=date`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const searchData = await searchRes.json();
      const videoIds = searchData.items
        ?.map((i: { id?: { videoId?: string } }) => i.id?.videoId)
        .filter(Boolean).join(",");

      if (!videoIds) {
        return json({ items: [] });
      }

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const detailsData = await detailsRes.json();
      return json(detailsData);
    }

    if (action === "demographics") {
      const res = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
          `ids=channel==MINE&start-date=2025-01-01&end-date=${new Date().toISOString().split("T")[0]}&` +
          `metrics=viewerPercentage&dimensions=ageGroup,gender`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return json(data);
    }

    if (action === "traffic-sources") {
      const res = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
          `ids=channel==MINE&start-date=${new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]}&` +
          `end-date=${new Date().toISOString().split("T")[0]}&` +
          `metrics=views&dimensions=insightTrafficSourceType&sort=-views`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return json(data);
    }

    if (action === "top-countries") {
      const res = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
          `ids=channel==MINE&start-date=${new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]}&` +
          `end-date=${new Date().toISOString().split("T")[0]}&` +
          `metrics=views&dimensions=country&sort=-views&maxResults=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
