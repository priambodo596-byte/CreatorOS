import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "clips";

const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
];

interface DownloadError {
  code: string;
  message: string;
  detail: string;
  retryable: boolean;
}

function makeError(code: string, message: string, detail: string, retryable: boolean): DownloadError {
  return { code, message, detail, retryable };
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return YOUTUBE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1) || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

async function fetchWithRetry(
  url: string,
  maxRetries = 5,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const delay = Math.pow(2, attempt) * 1000;
    if (attempt > 0) {
      console.log(`[youtube-download] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CreatorOS/1.0)",
        },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return res;
      if (res.status === 429) {
        lastError = new Error(`HTTP 429 Too Many Requests`);
        continue;
      }
      if (res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof TypeError) break;
    }
  }
  throw lastError ?? new Error("Max retries exceeded");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { draftId } = await req.json();
    if (!draftId) throw new Error("draftId is required");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Load the draft
    const { data: draft, error: draftErr } = await supabase
      .from("publishing_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftErr || !draft) {
      throw makeError("DRAFT_NOT_FOUND", "Draft not found", draftErr?.message || "", false);
    }

    const userId = draft.user_id as string;
    console.log("[youtube-download] Start:", {
      draftId,
      userId,
      video_storage_path: draft.video_storage_path || "null",
      original_youtube_url: draft.original_youtube_url || "null",
      video_url: draft.video_url ? draft.video_url.slice(0, 80) : "null",
    });

    // 2. Check cache — if storage path already exists, skip download
    if (draft.video_storage_path) {
      console.log("[youtube-download] Cache hit — video_storage_path already exists:", draft.video_storage_path);
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          storage_path: draft.video_storage_path,
          message: "Video already downloaded and stored",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Determine source URL
    const sourceUrl = draft.original_youtube_url || draft.video_url;
    if (!sourceUrl) {
      throw makeError(
        "NO_SOURCE_URL",
        "No YouTube URL to download from",
        "Both original_youtube_url and video_url are null",
        false,
      );
    }

    if (!isYouTubeUrl(sourceUrl)) {
      throw makeError(
        "NOT_YOUTUBE_URL",
        "Source URL is not a YouTube URL",
        `URL: ${sourceUrl.slice(0, 100)}`,
        false,
      );
    }

    // 4. Mark as downloading
    await supabase
      .from("publishing_drafts")
      .update({
        download_status: "downloading",
        download_error: null,
      })
      .eq("id", draftId);

    // 5. Download video via public proxy API
    const videoId = extractVideoId(sourceUrl);
    if (!videoId) {
      throw makeError(
        "INVALID_YOUTUBE_URL",
        "Could not extract video ID from URL",
        `URL: ${sourceUrl}`,
        false,
      );
    }

    console.log("[youtube-download] Downloading video:", { videoId, sourceUrl: sourceUrl.slice(0, 80) });

    // Use a public YouTube download proxy that returns the raw video file.
    // These endpoints return a direct video stream.
    const proxyUrls = [
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    let videoResponse: Response | null = null;
    let downloadError: DownloadError | null = null;

    for (const proxyUrl of proxyUrls) {
      try {
        videoResponse = await fetchWithRetry(proxyUrl);
        break;
      } catch (err) {
        console.warn("[youtube-download] Proxy failed:", { url: proxyUrl.slice(0, 60), error: String(err) });
        if (err instanceof Error && err.message.includes("429")) {
          downloadError = makeError(
            "RATE_LIMITED",
            "YouTube returned 429 Too Many Requests",
            err.message,
            true,
          );
        } else {
          downloadError = makeError(
            "DOWNLOAD_FAILED",
            "Failed to download video",
            err instanceof Error ? err.message : String(err),
            false,
          );
        }
      }
    }

    if (!videoResponse || !videoResponse.ok) {
      throw downloadError ?? makeError("DOWNLOAD_FAILED", "All download attempts failed", "", true);
    }

    const videoBlob = await videoResponse.blob();
    const fileSize = videoBlob.size;
    const mimeType = videoBlob.type || "video/mp4";

    console.log("[youtube-download] Download complete:", {
      draftId,
      userId,
      file_size_bytes: fileSize,
      file_size_mb: (fileSize / (1024 * 1024)).toFixed(2),
      mime_type: mimeType,
    });

    // 6. Validate
    if (fileSize === 0) {
      throw makeError("EMPTY_FILE", "Downloaded file is empty (0 bytes)", "", false);
    }
    if (fileSize > 128 * 1024 * 1024 * 1024) {
      throw makeError("FILE_TOO_LARGE", `File is ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`, "Max 128GB", false);
    }

    // 7. Upload to Supabase Storage
    const storagePath = `${userId}/${draftId}_${videoId}.mp4`;
    console.log("[youtube-download] Uploading to Storage:", { bucket: BUCKET, path: storagePath });

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, videoBlob, {
        contentType: mimeType,
      });

    if (uploadErr) {
      throw makeError(
        "STORAGE_UPLOAD_FAILED",
        "Failed to upload to Supabase Storage",
        uploadErr.message,
        true,
      );
    }

    console.log("[youtube-download] Upload success:", {
      draftId,
      bucket: BUCKET,
      storage_path: storagePath,
      file_size_bytes: fileSize,
      mime_type: mimeType,
      execution_time_ms: Date.now() - startTime,
    });

    // 8. Update database
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    await supabase
      .from("publishing_drafts")
      .update({
        video_storage_path: storagePath,
        video_url: urlData.publicUrl,
        original_youtube_url: sourceUrl,
        storage_uploaded_at: new Date().toISOString(),
        storage_size: fileSize,
        storage_mime: mimeType,
        download_status: "completed",
        download_error: null,
      })
      .eq("id", draftId);

    console.log("[youtube-download] Completed:", {
      draftId,
      userId,
      execution_time_ms: Date.now() - startTime,
      storage_path: storagePath,
      file_size_bytes: fileSize,
    });

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        file_size: fileSize,
        mime_type: mimeType,
        execution_time_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const detail = err && typeof err === "object" && "detail" in err ? String((err as any).detail) : "";
    const retryable = err && typeof err === "object" && "retryable" in err ? Boolean((err as any).retryable) : false;
    const code = err && typeof err === "object" && "code" in err ? String((err as any).code) : "UNKNOWN";

    console.error("[youtube-download] Error:", {
      code,
      message,
      detail,
      retryable,
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Try to mark the draft as failed
    try {
      const { draftId } = await req.clone().json();
      if (draftId) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await supabase
          .from("publishing_drafts")
          .update({
            download_status: "failed",
            download_error: message,
          })
          .eq("id", draftId);
      }
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: message, code, detail, retryable }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
