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
const REDIRECT_URI = "https://creatoros-ai-youtube-t82s.bolt.host";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";

    // For POST requests, the action may also be in the body
    let payload: Record<string, unknown> = {};
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      try {
        payload = await req.json();
        if (!action && typeof payload.action === "string") {
          action = payload.action;
        }
      } catch {
        // Body isn't JSON — that's fine for GET-style endpoints
      }
    }

    if (!action) action = "auth-url";

    if (action === "auth-url") {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state,
      });
      const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
      return json({ authUrl, state });
    }

    if (action === "callback") {
      const code: string | undefined = payload.code as string;
      const userId: string | undefined = payload.userId as string;

      if (!code || !userId) {
        return json({ error: "Missing code or userId" }, 400);
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return json({ error: `Token exchange failed: ${err}` }, 400);
      }

      const tokens = await tokenRes.json();

      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );

      let channelInfo: {
        id?: string;
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      } = {};
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        channelInfo = channelData.items?.[0] || {};
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/youtube_connections?user_id=eq.${userId}`,
        {
          method: "GET",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      const existing = await upsertRes.json();
      const exists = Array.isArray(existing) && existing.length > 0;

      const body = {
        user_id: userId,
        channel_id: channelInfo.id || "unknown",
        channel_title: channelInfo.snippet?.title || "Unknown Channel",
        channel_thumbnail: channelInfo.snippet?.thumbnails?.default?.url || "",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || existing[0]?.refresh_token || "",
        token_expires_at: new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000,
        ).toISOString(),
        scope: tokens.scope || "",
        updated_at: new Date().toISOString(),
      };

      if (exists) {
        await fetch(
          `${supabaseUrl}/rest/v1/youtube_connections?user_id=eq.${userId}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(body),
          },
        );
      } else {
        await fetch(`${supabaseUrl}/rest/v1/youtube_connections`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            ...body,
            connected_at: new Date().toISOString(),
          }),
        });
      }

      return json({
        success: true,
        channel: {
          id: channelInfo.id,
          title: channelInfo.snippet?.title,
          thumbnail: channelInfo.snippet?.thumbnails?.default?.url,
        },
      });
    }

    if (action === "refresh") {
      const refreshToken: string | undefined = payload.refreshToken as string;

      if (!refreshToken) {
        return json({ error: "Missing refreshToken" }, 400);
      }

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

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return json({ error: `Token refresh failed: ${err}` }, 400);
      }

      const tokens = await tokenRes.json();
      return json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
