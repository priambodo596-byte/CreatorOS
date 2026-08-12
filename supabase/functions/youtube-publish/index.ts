import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DraftRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  language: string | null;
  tags: string[] | null;
  hashtags: string[] | null;
  thumbnail_url: string | null;
  video_storage_path: string | null;
  video_url: string | null;
  original_youtube_url: string | null;
  download_status: string | null;
  platform: string | null;
  visibility: string | null;
  scheduled: boolean | null;
  scheduled_at: string | null;
  status: string;
}

interface ConnectionRow {
  channel_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  source: string;
}

function getOAuthCredentials(): OAuthCredentials {
  const ytClientId = Deno.env.get("YOUTUBE_CLIENT_ID");
  const ytClientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET");
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (ytClientId && ytClientSecret) {
    return { clientId: ytClientId, clientSecret: ytClientSecret, source: "YOUTUBE_* env" };
  }

  if (googleClientId && googleClientSecret) {
    return { clientId: googleClientId, clientSecret: googleClientSecret, source: "GOOGLE_* env" };
  }

  throw new Error(
    "YouTube OAuth credentials not configured. Set YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET (or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) as Supabase Edge Function secrets.",
  );
}

function maskId(id: string): string {
  if (id.length <= 12) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

async function refreshAccessToken(connection: ConnectionRow): Promise<string> {
  const creds = getOAuthCredentials();

  console.log("[youtube-publish] Token refresh diagnostics:", {
    client_id: maskId(creds.clientId),
    credential_source: creds.source,
    client_secret_length: creds.clientSecret.length,
    has_refresh_token: !!connection.refresh_token,
    refresh_token_length: connection.refresh_token?.length ?? 0,
    channel_id: connection.channel_id,
    token_expires_at: connection.token_expires_at || "null",
    now: new Date().toISOString(),
  });

  if (!connection.refresh_token) {
    throw new Error(
      "No refresh token stored for this YouTube connection. Re-connect your YouTube account to obtain a new refresh token.",
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[youtube-publish] Google token refresh failed:", {
      httpStatus: tokenRes.status,
      responseBody: errBody,
      client_id: maskId(creds.clientId),
      credential_source: creds.source,
      channel_id: connection.channel_id,
    });

    let userMessage: string;
    if (tokenRes.status === 401 && errBody.includes("invalid_client")) {
      userMessage =
        "Google rejected the OAuth credentials (invalid_client). The Client Secret may be wrong, the OAuth Client may have been deleted or recreated in Google Cloud Console, or the refresh token was issued for a different OAuth Client. Re-connect your YouTube account after verifying YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET match a single Google OAuth Client.";
    } else if (tokenRes.status === 400 && errBody.includes("invalid_grant")) {
      userMessage =
        "The refresh token is no longer valid (invalid_grant). The user may have revoked access or the token expired. Re-connect your YouTube account to obtain a new refresh token.";
    } else {
      userMessage = `Token refresh failed (HTTP ${tokenRes.status}): ${errBody}`;
    }

    throw new Error(userMessage);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

const YOUTUBE_URL_PATTERNS = [
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  "www.youtube.com",
  "music.youtube.com",
];

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return YOUTUBE_URL_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`));
  } catch {
    return false;
  }
}

async function fetchVideoFile(supabase: ReturnType<typeof createClient>, draft: DraftRow): Promise<ArrayBuffer> {
  // Try the `videos` bucket first (new Upload Center), fall back to `clips` (legacy)
  const buckets = ["videos", "clips"];

  console.log("[youtube-publish] fetchVideoFile diagnostics:", {
    draft_id: draft.id,
    video_storage_path: draft.video_storage_path || "null",
    video_url: draft.video_url ? draft.video_url.slice(0, 80) + "..." : "null",
    buckets,
    file_source: draft.video_storage_path ? "supabase_storage" : "none",
  });

  if (!draft.video_storage_path) {
    if (draft.video_url && isYouTubeUrl(draft.video_url)) {
      throw new Error(
        "video_url contains a YouTube watch URL, not a video file. Click 'Download from YouTube' first to download the video to Supabase Storage, then publish.",
      );
    }
    if (draft.original_youtube_url) {
      throw new Error(
        "Video file belum diupload ke Supabase Storage. Click 'Download from YouTube' first to download the video, then publish.",
      );
    }
    throw new Error("Video file belum diupload ke Supabase Storage. Upload the video file from the Upload Center before publishing.");
  }

  let videoData: ArrayBuffer | null = null;
  let usedBucket = "";
  let mimeType = "unknown";
  let lastError: string | null = null;

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(draft.video_storage_path);

    if (error || !data) {
      console.warn(`[youtube-publish] Storage download from bucket '${bucket}' failed:`, {
        error: error?.message || "no data returned",
      });
      lastError = error?.message || "no data";
      continue;
    }

    videoData = await data.arrayBuffer();
    mimeType = data.type || "unknown";
    usedBucket = bucket;
    break;
  }

  if (!videoData) {
    console.error("[youtube-publish] Storage download failed from all buckets:", {
      path: draft.video_storage_path,
      lastError,
    });
    throw new Error(`Failed to download video from Supabase Storage: ${lastError || "no data"}`);
  }

  const fileSize = videoData.byteLength;

  console.log("[youtube-publish] Video file retrieved:", {
    bucket: usedBucket,
    path: draft.video_storage_path,
    mime_type: mimeType,
    file_size_bytes: fileSize,
    file_size_mb: (fileSize / (1024 * 1024)).toFixed(2),
    source: "supabase_storage",
    download_url: `${SUPABASE_URL}/storage/v1/object/public/${usedBucket}/${draft.video_storage_path}`,
  });

  if (fileSize === 0) {
    throw new Error("The video file in Supabase Storage is empty (0 bytes). Re-upload the video file.");
  }

  if (fileSize > 128 * 1024 * 1024 * 1024) {
    throw new Error(`Video file is too large (${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB). YouTube allows videos up to 128 GB.`);
  }

  return videoData;
}

async function uploadToYouTube(
  accessToken: string,
  videoBuffer: ArrayBuffer,
  draft: DraftRow,
): Promise<string> {
  const metadata: Record<string, unknown> = {
    snippet: {
      title: draft.title,
      description: draft.description || "",
      categoryId: "28",
      tags: [...(draft.tags || []), ...(draft.hashtags || [])],
      defaultLanguage: draft.language || "English",
    },
    status: {
      privacyStatus: draft.visibility || "public",
      selfDeclaredMadeForKids: false,
    },
  };

  if (draft.scheduled && draft.scheduled_at) {
    const publishAt = new Date(draft.scheduled_at).toISOString();
    (metadata.status as Record<string, unknown>).publishAt = publishAt;
  }

  const boundary = "-------" + Math.random().toString(36).slice(2);
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n" +
    delimiter +
    "Content-Type: video/*\r\n" +
    "Content-Transfer-Encoding: binary\r\n\r\n";

  const footer = closeDelimiter;

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(metadataPart);
  const footerBytes = encoder.encode(footer);
  const bodyBytes = new Uint8Array(headerBytes.length + videoBuffer.byteLength + footerBytes.length);
  bodyBytes.set(headerBytes, 0);
  bodyBytes.set(new Uint8Array(videoBuffer), headerBytes.length);
  bodyBytes.set(footerBytes, headerBytes.length + videoBuffer.byteLength);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(bodyBytes.length),
      },
      body: bodyBytes,
    },
  );

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    const errMsg = uploadData?.error?.message || JSON.stringify(uploadData);
    console.error("[youtube-publish] YouTube upload failed:", {
      httpStatus: uploadRes.status,
      responseBody: JSON.stringify(uploadData),
    });
    throw new Error(`YouTube upload failed (${uploadRes.status}): ${errMsg}`);
  }

  return uploadData.id as string;
}

async function setThumbnail(
  accessToken: string,
  youtubeVideoId: string,
  thumbnailUrl: string,
): Promise<void> {
  try {
    const thumbRes = await fetch(thumbnailUrl);
    if (!thumbRes.ok) return;
    const thumbBuffer = await thumbRes.arrayBuffer();

    const formData = new FormData();
    formData.append("videoId", youtubeVideoId);
    formData.append("image", new Blob([thumbBuffer], { type: "image/jpeg" }));

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/thumbnails/set",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    if (!res.ok) {
      console.warn("[youtube-publish] Thumbnail upload failed:", res.status);
    }
  } catch (err) {
    console.warn("[youtube-publish] Thumbnail upload error:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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
      throw new Error("Draft not found");
    }

    // 2. Mark as publishing
    await supabase
      .from("publishing_drafts")
      .update({ status: "publishing", publish_error: null })
      .eq("id", draftId);

    // 2a. Sync uploaded_videos status to PUBLISHING if linked
    if (draft.video_storage_path) {
      await supabase
        .from("uploaded_videos")
        .update({ status: "PUBLISHING", error_message: null })
        .eq("storage_path", draft.video_storage_path);
    }

    // 3. Get the user's YouTube connection
    const { data: connection, error: connErr } = await supabase
      .from("youtube_connections")
      .select("channel_id, access_token, refresh_token, token_expires_at")
      .eq("user_id", draft.user_id)
      .maybeSingle();

    if (connErr || !connection) {
      throw new Error("No YouTube connection found. Please connect your YouTube account first.");
    }

    // 4. Refresh access token
    let accessToken = connection.access_token;
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
    const needsRefresh = !expiresAt || expiresAt.getTime() < Date.now() + 60_000;

    if (needsRefresh) {
      accessToken = await refreshAccessToken(connection as ConnectionRow);

      // Persist the new token
      await supabase
        .from("youtube_connections")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", draft.user_id)
        .eq("channel_id", connection.channel_id);
    }

    // 5. Fetch the video file
    const videoBuffer = await fetchVideoFile(supabase, draft as DraftRow);

    // 6. Upload to YouTube
    const youtubeVideoId = await uploadToYouTube(accessToken, videoBuffer, draft as DraftRow);

    // 7. Set thumbnail if available
    if (draft.thumbnail_url) {
      await setThumbnail(accessToken, youtubeVideoId, draft.thumbnail_url);
    }

    // 8. Mark as published
    await supabase
      .from("publishing_drafts")
      .update({
        status: "published",
        youtube_video_id: youtubeVideoId,
        publish_error: null,
      })
      .eq("id", draftId);

    // 8a. Sync uploaded_videos status to PUBLISHED if linked
    if (draft.video_storage_path) {
      await supabase
        .from("uploaded_videos")
        .update({ status: "PUBLISHED", error_message: null })
        .eq("storage_path", draft.video_storage_path);
    }

    return new Response(
      JSON.stringify({ success: true, videoId: youtubeVideoId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[youtube-publish] Publish flow error:", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Try to mark the draft as failed
    try {
      const { draftId } = await req.clone().json();
      if (draftId) {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await supabase
          .from("publishing_drafts")
          .update({ status: "failed", publish_error: message })
          .eq("id", draftId);

        // Sync uploaded_videos status to FAILED if linked
        const { data: failedDraft } = await supabase
          .from("publishing_drafts")
          .select("video_storage_path")
          .eq("id", draftId)
          .maybeSingle();
        if (failedDraft?.video_storage_path) {
          await supabase
            .from("uploaded_videos")
            .update({ status: "FAILED", error_message: message })
            .eq("storage_path", failedDraft.video_storage_path);
        }
      }
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
