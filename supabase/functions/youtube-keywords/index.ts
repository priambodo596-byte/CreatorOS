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

interface SearchResultItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
  };
}

interface VideoDetailsItem {
  id: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  snippet?: {
    tags?: string[];
    categoryId?: string;
    title?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
  };
}

interface SuggestionOutput {
  keyword: string;
  searchVolume: number;
  competition: number;
  difficulty: number;
  trend: "up" | "down" | "stable";
  avgViews: number;
  topVideoTitle: string;
  topVideoId: string;
  relatedKeywords: string[];
}

/**
 * Generate keyword variations/suggestions from a seed keyword.
 * These are derived algorithmically (not from a suggestions API) to produce
 * real, data-backed suggestions without relying on autocomplete endpoints.
 */
function generateKeywordVariations(seed: string): string[] {
  const variations = new Set<string>();
  const base = seed.trim().toLowerCase();

  // Direct seed
  variations.add(base);

  // Common modifiers
  const modifiers = [
    "how to", "best", "top", "tutorial", "guide", "tips", "2025", "2026",
    "for beginners", "explained", "review", "vs", "ideas", "examples",
    "free", "easy", "advanced", "step by step", "for youtube",
  ];

  for (const mod of modifiers) {
    variations.add(`${mod} ${base}`);
    variations.add(`${base} ${mod}`);
  }

  // Question forms
  const questions = ["what is", "why", "when to use", "how does"];
  for (const q of questions) {
    variations.add(`${q} ${base}`);
  }

  return Array.from(variations).slice(0, 15);
}

/**
 * Determine trend direction by comparing recent vs older video view counts.
 */
function determineTrend(
  recentAvgViews: number,
  olderAvgViews: number,
): "up" | "down" | "stable" {
  if (olderAvgViews === 0) return recentAvgViews > 0 ? "up" : "stable";
  const ratio = recentAvgViews / olderAvgViews;
  if (ratio > 1.15) return "up";
  if (ratio < 0.85) return "down";
  return "stable";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const keyword: string = (payload.keyword || "").trim();
    const region: string = payload.region || "US";
    const accessToken: string | undefined = payload.accessToken;

    if (!accessToken && !YOUTUBE_API_KEY) {
      return json(
        { error: "No authentication method available. Provide an accessToken or configure YOUTUBE_API_KEY." },
        500,
      );
    }

    if (!keyword) {
      return json({
        keyword: "",
        suggestions: [],
        fetchedAt: new Date().toISOString(),
      });
    }

    // Step 1: Search YouTube for the seed keyword to get competition count + top videos
    const searchParams = buildParams({
      part: "snippet",
      q: keyword,
      type: "video",
      maxResults: "10",
      order: "relevance",
      regionCode: region,
      relevanceLanguage: "en",
    }, accessToken);

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
      { headers: buildHeaders(accessToken) },
    );

    if (!searchRes.ok) {
      const errBody = await searchRes.text();
      return json(
        { error: `YouTube search API error (${searchRes.status}): ${errBody}` },
        searchRes.status,
      );
    }

    const searchData = await searchRes.json();
    const searchItems: SearchResultItem[] = searchData.items || [];
    const totalResults: number = searchData.pageInfo?.totalResults || 0;

    // Get video IDs for detailed stats
    const videoIds = searchItems
      .map((i) => i.id?.videoId)
      .filter(Boolean) as string[];

    let topVideoTitle = "";
    let topVideoId = "";
    let topVideoViews = 0;
    let allTags: string[] = [];

    if (videoIds.length > 0) {
      // Step 2: Fetch video details for view counts + tags
      const detailsParams = buildParams({
        part: "statistics,snippet",
        id: videoIds.join(","),
      }, accessToken);

      const detailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
        { headers: buildHeaders(accessToken) },
      );

      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        const detailItems: VideoDetailsItem[] = detailsData.items || [];

        const viewCounts = detailItems.map((d) =>
          parseInt(d.statistics?.viewCount || "0", 10)
        );

        // Find top video
        let topIdx = 0;
        for (let i = 1; i < viewCounts.length; i++) {
          if (viewCounts[i] > viewCounts[topIdx]) topIdx = i;
        }

        topVideoTitle = detailItems[topIdx]?.snippet?.title || "";
        topVideoId = detailItems[topIdx]?.id || "";
        topVideoViews = viewCounts[topIdx] || 0;

        // Collect tags for related keywords
        for (const d of detailItems) {
          if (d.snippet?.tags) {
            allTags = allTags.concat(d.snippet.tags);
          }
        }
      }
    }

    // Step 3: Generate keyword variations and fetch data for each
    const variations = generateKeywordVariations(keyword);
    const suggestions: SuggestionOutput[] = [];

    for (const variant of variations) {
      // Search for each variant
      const variantParams = buildParams({
        part: "snippet",
        q: variant,
        type: "video",
        maxResults: "5",
        order: "viewCount",
        regionCode: region,
        relevanceLanguage: "en",
      }, accessToken);

      const variantRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${variantParams.toString()}`,
        { headers: buildHeaders(accessToken) },
      );

      if (!variantRes.ok) continue;

      const variantData = await variantRes.json();
      const variantItems: SearchResultItem[] = variantData.items || [];
      const variantCompetition: number = variantData.pageInfo?.totalResults || 0;

      const variantVideoIds = variantItems
        .map((i) => i.id?.videoId)
        .filter(Boolean) as string[];

      if (variantVideoIds.length === 0) {
        // Still add with zero data
        suggestions.push({
          keyword: variant,
          searchVolume: 0,
          competition: variantCompetition,
          difficulty: Math.min(100, Math.round(Math.log10(variantCompetition + 1) * 20)),
          trend: "stable",
          avgViews: 0,
          topVideoTitle: "",
          topVideoId: "",
          relatedKeywords: [],
        });
        continue;
      }

      // Get view counts for this variant's videos
      const vDetailsParams = buildParams({
        part: "statistics",
        id: variantVideoIds.join(","),
      }, accessToken);

      const vDetailsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${vDetailsParams.toString()}`,
        { headers: buildHeaders(accessToken) },
      );

      let variantViews: number[] = [];
      let variantTopTitle = "";
      let variantTopId = "";
      let variantTopViews = 0;

      if (vDetailsRes.ok) {
        const vDetailsData = await vDetailsRes.json();
        const vDetailItems = vDetailsData.items || [];
        variantViews = vDetailItems.map((d: { statistics?: { viewCount?: string } }) =>
          parseInt(d.statistics?.viewCount || "0", 10)
        );

        let topIdx = 0;
        for (let i = 1; i < variantViews.length; i++) {
          if (variantViews[i] > variantViews[topIdx]) topIdx = i;
        }
        variantTopTitle = vDetailItems[topIdx]?.snippet?.title || "";
        variantTopId = vDetailItems[topIdx]?.id || "";
        variantTopViews = variantViews[topIdx] || 0;
      }

      const avgViews = variantViews.length > 0
        ? Math.round(variantViews.reduce((a: number, b: number) => a + b, 0) / variantViews.length)
        : 0;

      // Search volume is estimated from aggregate view counts of top results
      const searchVolume = variantViews.reduce((a: number, b: number) => a + b, 0);

      // Difficulty: based on competition (result count) and average views
      // Higher competition + higher views = harder to rank
      const competitionFactor = Math.min(60, Math.round(Math.log10(variantCompetition + 1) * 15));
      const viewsFactor = Math.min(40, Math.round(Math.log10(avgViews + 1) * 10));
      const difficulty = Math.min(100, competitionFactor + viewsFactor);

      // Trend: compare recent vs older videos in results
      const now = Date.now();
      const recentViews: number[] = [];
      const olderViews: number[] = [];
      variantItems.forEach((item, idx) => {
        const publishedAt = new Date(item.snippet?.publishedAt || new Date()).getTime();
        const ageDays = (now - publishedAt) / (1000 * 60 * 60 * 24);
        const views = variantViews[idx] || 0;
        if (ageDays < 90) recentViews.push(views);
        else olderViews.push(views);
      });
      const recentAvg = recentViews.length > 0
        ? recentViews.reduce((a, b) => a + b, 0) / recentViews.length
        : 0;
      const olderAvg = olderViews.length > 0
        ? olderViews.reduce((a, b) => a + b, 0) / olderViews.length
        : recentAvg;
      const trend = determineTrend(recentAvg, olderAvg);

      // Related keywords from tags (deduplicated, filtered)
      const related = Array.from(new Set(allTags))
        .filter((t) => t.toLowerCase().includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(t.toLowerCase()))
        .slice(0, 5);

      suggestions.push({
        keyword: variant,
        searchVolume,
        competition: variantCompetition,
        difficulty,
        trend,
        avgViews,
        topVideoTitle: variantTopTitle,
        topVideoId: variantTopId,
        relatedKeywords: related,
      });
    }

    // Sort suggestions by search volume descending
    suggestions.sort((a, b) => b.searchVolume - a.searchVolume);

    return json({
      keyword,
      suggestions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
