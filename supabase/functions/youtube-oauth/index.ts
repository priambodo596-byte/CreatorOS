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

const REDIRECT_URI = Deno.env.get("YOUTUBE_REDIRECT_URI") || "https://creatoros-ai-youtube-t82s.bolt.host";

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

    let payload: Record<string, unknown> = {};
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      try {
        payload = await req.json();
        if (!action && typeof payload.action === "string") {
          action = payload.action;
        }
      } catch {
        // Body isn't JSON
      }
    }

    if (!action) action = "auth-url";

    if (action === "auth-url") {
      const creds = getOAuthCredentials();
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: creds.clientId,
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

      const creds = getOAuthCredentials();
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error("[youtube-oauth] Token exchange failed:", {
          httpStatus: tokenRes.status,
          responseBody: err,
          client_id_prefix: creds.clientId.slice(0, 8) + "...",
        });
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
          POST: "POST" as unknown,
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

      const creds = getOAuthCredentials();
      console.log("[youtube-oauth] Refresh diagnostics:", {
        client_id_prefix: creds.clientId.slice(0, 8) + "...",
        client_secret_length: creds.clientSecret.length,
        has_refresh_token: !!refreshToken,
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error("[youtube-oauth] Token refresh failed:", {
          httpStatus: tokenRes.status,
          responseBody: err,
          client_id_prefix: creds.clientId.slice(0, 8) + "...",
        });

        let userMessage: string;
        if (tokenRes.status === 401 && err.includes("invalid_client")) {
          userMessage =
            "Google rejected the OAuth credentials (invalid_client). The Client Secret may be wrong, the OAuth Client may have been recreated, or the refresh token was issued for a different OAuth Client. Verify YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET match a single Google OAuth Client, then re-connect your YouTube account.";
        } else if (tokenRes.status === 400 && err.includes("invalid_grant")) {
          userMessage =
            "The refresh token is no longer valid. Re-connect your YouTube account to obtain a new refresh token.";
        } else {
          userMessage = `Token refresh failed (HTTP ${tokenRes.status}): ${err}`;
        }

        return json({ error: userMessage }, 400);
      }

      const tokens = await tokenRes.json();
      return json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[youtube-oauth] Error:", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
