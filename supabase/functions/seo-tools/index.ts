import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case "generate-titles": {
        const keyword = (body.keyword as string ?? "").trim();
        const videoTopic = (body.videoTopic as string ?? "").trim();
        const count = Math.min(Math.max(body.count ?? 10, 1), 20);

        if (!keyword || !videoTopic) {
          return new Response(JSON.stringify({ error: "keyword and videoTopic are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const titles = generateTitleVariations(keyword, videoTopic, count);

        return new Response(
          JSON.stringify({
            titles,
            keyword,
            generatedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "generate-tags": {
        const keyword = (body.keyword as string ?? "").trim();
        const videoTitle = (body.videoTitle as string ?? "").trim();
        const count = Math.min(Math.max(body.count ?? 20, 1), 50);

        if (!keyword || !videoTitle) {
          return new Response(JSON.stringify({ error: "keyword and videoTitle are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const tags = generateTagVariations(keyword, videoTitle, count);

        return new Response(
          JSON.stringify({
            tags,
            keyword,
            generatedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Title Generation ─────────────────────────────────────────────────────────

interface GeneratedTitle {
  title: string;
  seoScore: number;
  reasons: string[];
  characterCount: number;
  wordCount: number;
}

function generateTitleVariations(keyword: string, topic: string, count: number): GeneratedTitle[] {
  const templates = [
    `${capitalize(keyword)}: The Ultimate Guide to ${topic}`,
    `How ${capitalize(topic)} Changed Everything in ${new Date().getFullYear()}`,
    `${capitalize(topic)} — What Nobody Tells You About ${keyword}`,
    `Why ${capitalize(keyword)} Is the Secret to ${topic}`,
    `The Truth About ${capitalize(topic)} (and ${keyword})`,
    `${capitalize(keyword)} Explained: ${topic} for Beginners`,
    `I Tried ${capitalize(topic)} With ${keyword} — Here's What Happened`,
    `${capitalize(topic)}: ${capitalize(keyword)} Edition`,
    `Stop Doing ${capitalize(topic)} Wrong — ${capitalize(keyword)} Done Right`,
    `${capitalize(keyword)} Hacks: ${topic} Secrets Nobody Shares`,
    `The ${capitalize(keyword)} Playbook for ${topic}`,
    `${capitalize(topic)} in ${new Date().getFullYear()}: Is ${capitalize(keyword)} Still Worth It?`,
    `${capitalize(keyword)} vs Everything: ${topic} Showdown`,
    `From Zero to ${capitalize(keyword)}: ${topic} Masterclass`,
    `${capitalize(topic)} Mistakes to Avoid With ${keyword}`,
    `The ${capitalize(keyword)} Strategy That Transformed My ${topic}`,
    `${capitalize(keyword)} 101: Everything You Need to Know About ${topic}`,
    `Why ${capitalize(topic)} Pros Swear by ${keyword}`,
    `${capitalize(keyword)} Myths Busted: ${topic} Edition`,
    `The ${capitalize(topic)} Blueprint: ${capitalize(keyword)} Edition`,
  ];

  const selected = templates.slice(0, count);
  return selected.map((title) => {
    const characterCount = title.length;
    const wordCount = title.split(/\s+/).length;
    const reasons: string[] = [];
    let score = 50;

    if (characterCount >= 40 && characterCount <= 70) {
      score += 20;
      reasons.push("Optimal title length (40-70 chars)");
    } else if (characterCount < 40) {
      score += 10;
      reasons.push("Short and punchy — may be too brief");
    } else {
      score -= 5;
      reasons.push("Title may be truncated in search results (>70 chars)");
    }

    if (/\d/.test(title)) {
      score += 10;
      reasons.push("Contains numbers which boost CTR");
    }

    if (/(how|why|what|when|where|secret|truth|ultimate|guide|mistakes|hack)/i.test(title)) {
      score += 15;
      reasons.push("Uses power words that drive curiosity");
    }

    if (wordCount >= 6 && wordCount <= 12) {
      score += 10;
      reasons.push("Good word count for readability");
    }

    if (title.toLowerCase().includes(keyword.toLowerCase())) {
      score += 10;
      reasons.push("Keyword is present in the title");
    }

    score = Math.min(100, Math.max(20, score));

    return {
      title,
      seoScore: score,
      reasons,
      characterCount,
      wordCount,
    };
  });
}

// ─── Tag Generation ───────────────────────────────────────────────────────────

interface GeneratedTag {
  tag: string;
  relevanceScore: number;
  category: string;
}

function generateTagVariations(keyword: string, title: string, count: number): GeneratedTag[] {
  const kwLower = keyword.toLowerCase();
  const kwCapitalized = capitalize(keyword);
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && w !== kwLower);

  const tagSet = new Map<string, { tag: string; relevanceScore: number; category: string }>();

  // Primary keyword tags
  const primaryTags = [
    kwLower,
    `${kwLower} ${new Date().getFullYear()}`,
    `${kwLower} tutorial`,
    `${kwLower} guide`,
    `${kwLower} tips`,
    `${kwLower} for beginners`,
    `best ${kwLower}`,
    `how to ${kwLower}`,
    `${kwLower} explained`,
    `${kwLower} review`,
  ];

  primaryTags.forEach((tag, i) => {
    tagSet.set(tag, {
      tag,
      relevanceScore: Math.max(70, 98 - i * 3),
      category: "primary",
    });
  });

  // Title-derived tags
  titleWords.slice(0, 10).forEach((word, i) => {
    if (!tagSet.has(word)) {
      tagSet.set(word, {
        tag: word,
        relevanceScore: Math.max(50, 85 - i * 4),
        category: "title-derived",
      });
    }
  });

  // Broad/related tags
  const relatedTags = [
    "youtube",
    "video",
    "tutorial",
    "education",
    "how-to",
    "guide",
    "tips and tricks",
    "step by step",
    "for beginners",
    "explained",
    "2024",
    "trending",
    "viral",
    "must watch",
    "secrets",
    "hacks",
    "pro tips",
    "complete guide",
    "everything you need to know",
    "ultimate",
  ];

  relatedTags.forEach((tag, i) => {
    if (!tagSet.has(tag)) {
      tagSet.set(tag, {
        tag,
        relevanceScore: Math.max(30, 60 - i * 2),
        category: "broad",
      });
    }
  });

  // Long-tail combinations
  const longTail = [
    `${kwLower} ${titleWords[0] ?? "tips"} ${new Date().getFullYear()}`,
    `best ${kwLower} for ${titleWords[1] ?? "beginners"}`,
    `${kwLower} step by step tutorial`,
    `${kwLower} everything you need to know`,
    `learn ${kwLower} from scratch`,
  ];

  longTail.forEach((tag, i) => {
    if (!tagSet.has(tag)) {
      tagSet.set(tag, {
        tag,
        relevanceScore: Math.max(55, 75 - i * 3),
        category: "long-tail",
      });
    }
  });

  return Array.from(tagSet.values()).slice(0, count);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
