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

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";

function buildHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function buildParams(base: Record<string, string>, accessToken?: string): URLSearchParams {
  const params = new URLSearchParams(base);
  if (!accessToken && YOUTUBE_API_KEY) {
    params.set("key", YOUTUBE_API_KEY);
  }
  return params;
}

interface ChannelItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    country?: string;
    publishedAt?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
    keywords?: string;
    topicDetails?: { topicCategories?: string[] };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
  brandingSettings?: {
    image?: { bannerExternalUrl?: string };
  };
}

interface VideoItem {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
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

/**
 * Extract a channel handle/ID from various input formats:
 * - https://www.youtube.com/@handle
 * - https://www.youtube.com/channel/UCxxxx
 * - https://www.youtube.com/c/CustomName
 * - https://www.youtube.com/user/UserName
 * - @handle
 * - UCxxxx (raw channel ID)
 */
function parseChannelInput(input: string): { type: "handle" | "id" | "search"; value: string } {
  const trimmed = input.trim();

  // Raw channel ID (starts with UC, 24 chars)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: "id", value: trimmed };
  }

  // URL patterns
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) return { type: "handle", value: "@" + handleMatch[1] };

  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) return { type: "id", value: channelIdMatch[1] };

  const customMatch = trimmed.match(/youtube\.com\/c\/([\w.-]+)/);
  if (customMatch) return { type: "search", value: customMatch[1] };

  const userMatch = trimmed.match(/youtube\.com\/user\/([\w.-]+)/);
  if (userMatch) return { type: "search", value: userMatch[1] };

  // @handle without URL
  if (trimmed.startsWith("@")) return { type: "handle", value: trimmed };

  // Default: treat as search query
  return { type: "search", value: trimmed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const channelInput: string = payload.channelInput || "";
    const accessToken: string | undefined = payload.accessToken;

    if (!accessToken && !YOUTUBE_API_KEY) {
      return json(
        { error: "No authentication method available. Provide an accessToken or configure YOUTUBE_API_KEY." },
        500,
      );
    }

    if (!channelInput.trim()) {
      return json({ error: "Channel URL or handle is required" }, 400);
    }

    const parsed = parseChannelInput(channelInput);

    // Step 1: Resolve channel ID
    let channelId = "";

    if (parsed.type === "id") {
      channelId = parsed.value;
    } else {
      // Use the 'forHandle' endpoint for @handles, or 'search' for custom names
      if (parsed.type === "handle") {
        const handleParams = buildParams({
          part: "id",
          handle: parsed.value,
        }, accessToken);
        const handleRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?${handleParams.toString()}`,
          { headers: buildHeaders(accessToken) },
        );
        if (handleRes.ok) {
          const handleData = await handleRes.json();
          channelId = handleData.items?.[0]?.id || "";
        }
      }

      // If handle lookup failed or type is search, try search API
      if (!channelId) {
        const searchParams = buildParams({
          part: "snippet",
          q: parsed.value,
          type: "channel",
          maxResults: "1",
        }, accessToken);
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
          { headers: buildHeaders(accessToken) },
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          channelId = searchData.items?.[0]?.snippet?.channelId ||
            searchData.items?.[0]?.id?.channelId || "";
        }
      }
    }

    if (!channelId) {
      return json({ error: "Channel not found. Check the URL or handle and try again." }, 404);
    }

    // Step 2: Fetch full channel details
    const channelParams = buildParams({
      part: "snippet,statistics,contentDetails,brandingSettings,topicDetails",
      id: channelId,
    }, accessToken);

    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
      { headers: buildHeaders(accessToken) },
    );

    if (!channelRes.ok) {
      const errBody = await channelRes.text();
      return json(
        { error: `YouTube Data API error (${channelRes.status}): ${errBody}` },
        channelRes.status,
      );
    }

    const channelData = await channelRes.json();
    const channelItem: ChannelItem = channelData.items?.[0];

    if (!channelItem) {
      return json({ error: "Channel not found." }, 404);
    }

    const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads || "";

    // Step 3: Fetch recent uploads (up to 50)
    let recentUploads: VideoItem[] = [];
    let allDurations: number[] = [];
    let mostViewedVideo = {
      videoId: "",
      title: "",
      thumbnail: "",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      publishedAt: "",
    };

    if (uploadsPlaylistId) {
      const playlistParams = buildParams({
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: "50",
      }, accessToken);

      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams.toString()}`,
        { headers: buildHeaders(accessToken) },
      );

      if (playlistRes.ok) {
        const playlistData = await playlistRes.json();
        const playlistItems = playlistData.items || [];
        const videoIds = playlistItems
          .map((i: { contentDetails?: { videoId?: string } }) => i.contentDetails?.videoId)
          .filter(Boolean) as string[];

        if (videoIds.length > 0) {
          // Fetch video details (statistics + contentDetails for duration)
          const detailsParams = buildParams({
            part: "snippet,statistics,contentDetails",
            id: videoIds.join(","),
          }, accessToken);

          const detailsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
            { headers: buildHeaders(accessToken) },
          );

          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            recentUploads = detailsData.items || [];

            // Calculate durations
            allDurations = recentUploads.map((v) =>
              parseDurationToSeconds(v.contentDetails?.duration || ""),
            );

            // Find most viewed
            let topIdx = 0;
            const viewCounts = recentUploads.map((v) =>
              parseInt(v.statistics?.viewCount || "0", 10),
            );
            for (let i = 1; i < viewCounts.length; i++) {
              if (viewCounts[i] > viewCounts[topIdx]) topIdx = i;
            }

            const top = recentUploads[topIdx];
            if (top) {
              mostViewedVideo = {
                videoId: top.id,
                title: top.snippet?.title || "",
                thumbnail: top.snippet?.thumbnails?.high?.url ||
                  top.snippet?.thumbnails?.medium?.url || "",
                viewCount: viewCounts[topIdx],
                likeCount: parseInt(top.statistics?.likeCount || "0", 10),
                commentCount: parseInt(top.statistics?.commentCount || "0", 10),
                publishedAt: top.snippet?.publishedAt || "",
              };
            }
          }
        }
      }
    }

    // Step 4: Calculate metrics
    const subscriberCount = parseInt(channelItem.statistics?.subscriberCount || "0", 10);
    const viewCount = parseInt(channelItem.statistics?.viewCount || "0", 10);
    const videoCount = parseInt(channelItem.statistics?.videoCount || "0", 10);

    const avgViewsPerVideo = videoCount > 0 ? Math.round(viewCount / videoCount) : 0;

    // Engagement rate from recent uploads
    const totalRecentViews = recentUploads.reduce(
      (s, v) => s + parseInt(v.statistics?.viewCount || "0", 10),
      0,
    );
    const totalRecentLikes = recentUploads.reduce(
      (s, v) => s + parseInt(v.statistics?.likeCount || "0", 10),
      0,
    );
    const totalRecentComments = recentUploads.reduce(
      (s, v) => s + parseInt(v.statistics?.commentCount || "0", 10),
      0,
    );
    const engagementRate = totalRecentViews > 0
      ? parseFloat(((totalRecentLikes + totalRecentComments) / totalRecentViews * 100).toFixed(2))
      : 0;

    // Upload frequency: videos per week from recent uploads
    let uploadFrequencyPerWeek = 0;
    if (recentUploads.length >= 2) {
      const dates = recentUploads
        .map((v) => new Date(v.snippet?.publishedAt || "").getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);
      if (dates.length >= 2) {
        const spanDays = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        if (spanDays > 0) {
          uploadFrequencyPerWeek = parseFloat(
            ((recentUploads.length / spanDays) * 7).toFixed(2),
          );
        }
      }
    }

    // Average duration
    const avgDurationSeconds = allDurations.length > 0
      ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
      : 0;

    // Parse keywords from brandingSettings or snippet
    const keywordsStr = channelItem.snippet?.keywords || "";
    const keywords = keywordsStr
      ? keywordsStr.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    const topicCategories = channelItem.snippet?.topicDetails?.topicCategories || [];

    // Build recent uploads output
    const recentUploadsOutput = recentUploads.slice(0, 10).map((v) => ({
      videoId: v.id,
      title: v.snippet?.title || "",
      thumbnail: v.snippet?.thumbnails?.medium?.url || "",
      publishedAt: v.snippet?.publishedAt || "",
      duration: v.contentDetails?.duration || "",
      viewCount: parseInt(v.statistics?.viewCount || "0", 10),
      likeCount: parseInt(v.statistics?.likeCount || "0", 10),
      commentCount: parseInt(v.statistics?.commentCount || "0", 10),
    }));

    const channel = {
      channelId: channelItem.id,
      title: channelItem.snippet?.title || "",
      description: channelItem.snippet?.description || "",
      customUrl: channelItem.snippet?.customUrl || "",
      country: channelItem.snippet?.country || "",
      publishedAt: channelItem.snippet?.publishedAt || "",
      thumbnailUrl: channelItem.snippet?.thumbnails?.high?.url ||
        channelItem.snippet?.thumbnails?.medium?.url ||
        channelItem.snippet?.thumbnails?.default?.url || "",
      bannerUrl: channelItem.brandingSettings?.image?.bannerExternalUrl || "",
      subscriberCount,
      viewCount,
      videoCount,
      keywords,
      topicCategories,
      uploadsPlaylistId,
      avgViewsPerVideo,
      engagementRate,
      uploadFrequencyPerWeek,
      avgDurationSeconds,
      mostViewedVideo,
      recentUploads: recentUploadsOutput,
    };

    return json({
      channel,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
