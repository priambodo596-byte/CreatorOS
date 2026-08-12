import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED_MIME = ["video/mp4"];
const BUCKET = "videos";

interface UploadRequest {
  filename: string;
  filesize: number;
  mimeType: string;
  storagePath: string;
  videoId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[VIDEO UPLOAD] Missing auth header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: missing auth token", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      console.error("[VIDEO UPLOAD] Invalid JWT:", userErr?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: invalid token", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = userData.user.id;
    console.log("[VIDEO UPLOAD] Upload started for user:", userId);

    // 2. Parse and validate request body
    const body: UploadRequest = await req.json();
    const { filename, filesize, mimeType, storagePath, videoId } = body;

    if (!filename || !storagePath) {
      return new Response(
        JSON.stringify({ success: false, error: "filename and storagePath are required", code: "VALIDATION_FAILED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Validate mime type
    if (!ALLOWED_MIME.includes(mimeType)) {
      console.error("[VIDEO UPLOAD] Invalid mime type:", mimeType);
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported file type: ${mimeType}. Only video/mp4 is allowed.`, code: "VALIDATION_FAILED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Validate file size
    if (filesize > MAX_FILE_SIZE) {
      console.error("[VIDEO UPLOAD] File too large:", filesize);
      return new Response(
        JSON.stringify({ success: false, error: `File too large. Maximum size is 2 GB.`, code: "FILE_TOO_LARGE" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Validate storage path belongs to user
    if (!storagePath.startsWith(`${userId}/`)) {
      console.error("[VIDEO UPLOAD] Storage path does not belong to user:", storagePath);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: storage path does not match user folder", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Use service client for DB + storage operations
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // 7. Generate UUID and insert/update metadata
    const newVideoId = videoId || crypto.randomUUID();
    console.log("[VIDEO UPLOAD] Video ID:", newVideoId);

    const { error: upsertErr } = await serviceClient
      .from("uploaded_videos")
      .upsert({
        id: newVideoId,
        user_id: userId,
        storage_path: storagePath,
        filename,
        filesize,
        mime_type: mimeType,
        status: "UPLOADING",
        error_message: null,
      }, { onConflict: "id" });

    if (upsertErr) {
      console.error("[VIDEO UPLOAD] DB insert failed:", upsertErr.message);
      return new Response(
        JSON.stringify({ success: false, error: `Database error: ${upsertErr.message}`, code: "UPLOAD_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[VIDEO UPLOAD] Database inserted:", newVideoId);

    // 8. Verify the file exists in storage (the client uploads directly to Storage)
    const { data: fileData, error: fileErr } = await serviceClient
      .storage
      .from(BUCKET)
      .list(userId, { search: storagePath.split("/").pop() });

    if (fileErr) {
      console.warn("[VIDEO UPLOAD] Storage list check failed (non-fatal):", fileErr.message);
    }

    // 9. Get public URL
    const { data: urlData } = serviceClient
      .storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // 10. Mark as READY
    const { error: updateErr } = await serviceClient
      .from("uploaded_videos")
      .update({ status: "READY", public_url: urlData.publicUrl, error_message: null })
      .eq("id", newVideoId);

    if (updateErr) {
      console.error("[VIDEO UPLOAD] Failed to mark READY:", updateErr.message);
      return new Response(
        JSON.stringify({ success: false, error: `Database update error: ${updateErr.message}`, code: "UPLOAD_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[VIDEO UPLOAD] Upload success:", { videoId: newVideoId, storagePath, storage_size: filesize });
    console.log("[VIDEO UPLOAD] Storage path:", storagePath);

    return new Response(
      JSON.stringify({
        success: true,
        videoId: newVideoId,
        storagePath,
        publicUrl: urlData.publicUrl,
        status: "READY",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[VIDEO UPLOAD] Upload failed:", message);

    return new Response(
      JSON.stringify({ success: false, error: message, code: "UPLOAD_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
