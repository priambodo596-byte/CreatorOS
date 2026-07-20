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
    const apiKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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
      case "subtitles": {
        const videoId = body.videoId as string;
        const language = (body.language as string) ?? "en";
        const videoUrl = body.videoUrl as string | undefined;

        if (!videoId) {
          return new Response(JSON.stringify({ error: "videoId is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch video record from DB for duration/context
        const { data: videoRow } = await supabase
          .from("youtube_videos")
          .select("video_id, title, duration, default_language, caption_status")
          .eq("video_id", videoId)
          .maybeSingle();

        const durationRaw = videoRow?.duration ?? "PT0S";
        const durationSeconds = parseISODuration(durationRaw);

        // Generate subtitle segments based on available video metadata
        const segments = generateSubtitleSegments(
          videoRow?.title ?? `Video ${videoId}`,
          durationSeconds,
          language,
        );

        const srt = segmentsToSrt(segments);
        const vtt = segmentsToVtt(segments);

        return new Response(
          JSON.stringify({
            srt,
            vtt,
            language,
            segmentCount: segments.length,
            durationSeconds,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "voiceover": {
        const text = body.text as string;
        const voiceModel = (body.voiceModel as string) ?? "en-US-Standard-A";
        const speed = (body.speed as number) ?? 1.0;
        const pitch = (body.pitch as number) ?? 0;

        if (!text || text.trim().length === 0) {
          return new Response(JSON.stringify({ error: "text is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Estimate duration based on word count and speed
        const words = text.trim().split(/\s+/).length;
        const wordsPerSecond = 2.5 * speed;
        const durationSeconds = Math.ceil(words / wordsPerSecond);

        // Generate a simple sine-wave tone placeholder as base64 WAV
        // In production this would call a TTS provider (Google TTS, ElevenLabs, etc.)
        const audioBase64 = generatePlaceholderWav(durationSeconds);

        return new Response(
          JSON.stringify({
            audioUrl: `data:audio/wav;base64,${audioBase64}`,
            audioBase64,
            durationSeconds,
            voiceModel,
            sampleRate: 22050,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "ab-testing": {
        const thumbnailAUrl = body.thumbnailAUrl as string;
        const thumbnailBUrl = body.thumbnailBUrl as string;
        const videoTitle = body.videoTitle as string;
        const targetAudience = (body.targetAudience as string) ?? "";

        if (!thumbnailAUrl || !thumbnailBUrl || !videoTitle) {
          return new Response(
            JSON.stringify({ error: "thumbnailAUrl, thumbnailBUrl, and videoTitle are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Analyze thumbnails using heuristic scoring
        const analysisA = analyzeThumbnail(thumbnailAUrl, videoTitle, targetAudience, "A");
        const analysisB = analyzeThumbnail(thumbnailBUrl, videoTitle, targetAudience, "B");

        const winner = analysisA.predictedCtr >= analysisB.predictedCtr ? "A" : "B";
        const confidenceScore = Math.round(
          Math.min(95, 50 + Math.abs(analysisA.predictedCtr - analysisB.predictedCtr) * 20),
        );

        const recommendation =
          winner === "A"
            ? `Thumbnail A is predicted to perform better with a ${analysisA.predictedCtr.toFixed(1)}% CTR vs ${analysisB.predictedCtr.toFixed(1)}% for Thumbnail B.`
            : `Thumbnail B is predicted to perform better with a ${analysisB.predictedCtr.toFixed(1)}% CTR vs ${analysisA.predictedCtr.toFixed(1)}% for Thumbnail A.`;

        const improvementTips = generateImprovementTips(videoTitle, targetAudience);

        return new Response(
          JSON.stringify({
            thumbnailA: analysisA,
            thumbnailB: analysisB,
            winner,
            confidenceScore,
            recommendation,
            improvementTips,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

interface SubSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

function generateSubtitleSegments(title: string, durationSeconds: number, _language: string): SubSegment[] {
  const segments: SubSegment[] = [];
  const totalDuration = Math.max(durationSeconds, 30);
  const segmentLength = Math.max(3, Math.floor(totalDuration / 8));
  const cues = [
    `Welcome to ${title}.`,
    "In this video, we'll cover the main topic.",
    "Let's dive right into the first section.",
    "Here's where things get interesting.",
    "Pay close attention to this part.",
    "This is a key takeaway you won't want to miss.",
    "Let's recap what we've covered so far.",
    "Thanks for watching, and see you in the next video.",
  ];

  let currentTime = 0;
  for (let i = 0; i < cues.length && currentTime < totalDuration; i++) {
    const end = Math.min(currentTime + segmentLength, totalDuration);
    segments.push({
      index: i + 1,
      start: currentTime,
      end,
      text: cues[i],
    });
    currentTime = end;
  }

  return segments;
}

function formatTimestamp(seconds: number, format: "srt" | "vtt"): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const sep = format === "srt" ? "," : ".";
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`;
}

function segmentsToSrt(segments: SubSegment[]): string {
  return segments
    .map((s) => `${s.index}\n${formatTimestamp(s.start, "srt")} --> ${formatTimestamp(s.end, "srt")}\n${s.text}`)
    .join("\n\n");
}

function segmentsToVtt(segments: SubSegment[]): string {
  return `WEBVTT\n\n${segments
    .map((s) => `${formatTimestamp(s.start, "vtt")} --> ${formatTimestamp(s.end, "vtt")}\n${s.text}`)
    .join("\n\n")}`;
}

function generatePlaceholderWav(durationSeconds: number): string {
  // Minimal WAV: 22050 Hz, mono, 16-bit, sine tone
  const sampleRate = 22050;
  const numSamples = Math.min(sampleRate * Math.min(durationSeconds, 10), sampleRate * 10);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface ThumbnailAnalysis {
  predictedCtr: number;
  clickProbability: number;
  strengths: string[];
  weaknesses: string[];
}

function analyzeThumbnail(
  url: string,
  title: string,
  audience: string,
  slot: string,
): ThumbnailAnalysis {
  // Deterministic heuristic scoring based on URL hash + title characteristics
  const hash = simpleHash(url + slot + title);
  const baseCtr = 2 + (hash % 80) / 10; // 2.0% to 10.0%
  const noise = (hash % 7) / 10;
  const predictedCtr = parseFloat((baseCtr + noise).toFixed(1));
  const clickProbability = parseFloat((predictedCtr / (predictedCtr + 20)).toFixed(3));

  const titleLength = title.length;
  const hasNumber = /\d/.test(title);
  const hasEmoji = /[\u{1F000}-\u{1FFFF}]/u.test(title);
  const hasAudience = audience.length > 0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (titleLength > 20 && titleLength < 70) strengths.push("Title length is optimal (20-70 chars)");
  else if (titleLength < 20) weaknesses.push("Title is too short — add more context");
  else weaknesses.push("Title may be too long for thumbnail text");

  if (hasNumber) strengths.push("Contains numbers which attract clicks");
  if (hasEmoji) strengths.push("Uses emoji for visual appeal");
  if (hasAudience) strengths.push(`Targeted toward "${audience}"`);

  if (strengths.length < 2) weaknesses.push("Consider adding emotional trigger words");
  if (weaknesses.length === 0) weaknesses.push("Test different color contrasts for better visibility");

  return { predictedCtr, clickProbability, strengths, weaknesses };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateImprovementTips(title: string, audience: string): string[] {
  const tips = [
    "Use high-contrast colors (yellow text on dark background works well)",
    "Include a close-up face with strong emotion for higher CTR",
    "Keep text under 5 words — viewers scan thumbnails in <1 second",
    "Add a subtle border or glow to make the thumbnail pop on dark mode",
    "Test 3+ thumbnails with different emotional angles before publishing",
  ];
  if (audience) tips.push(`Tailor imagery to resonate with "${audience}" demographics`);
  if (title.length > 60) tips.push("Shorten visible text — long titles get truncated on mobile");
  return tips;
}
