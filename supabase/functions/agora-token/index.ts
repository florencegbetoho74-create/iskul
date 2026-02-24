// Supabase Edge Function: generate Agora RTC token
// @ts-ignore - resolved by Deno runtime in Supabase Edge Functions
import { RtcRole, RtcTokenBuilder } from "npm:agora-access-token";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const APP_ID = Deno.env.get("AGORA_APP_ID") || "";
  const APP_CERT = Deno.env.get("AGORA_APP_CERTIFICATE") || "";
  const EXPIRE_SEC = Number(Deno.env.get("AGORA_TOKEN_EXPIRE_SEC") || 3600);

  if (!APP_ID || !APP_CERT) {
    return json({ error: "AGORA_APP_ID/AGORA_APP_CERTIFICATE manquant." }, 500);
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps invalide." }, 400);
  }

  const channelName =
    (typeof payload?.channelName === "string" && payload.channelName) ||
    (typeof payload?.liveId === "string" && payload.liveId) ||
    "";
  const uid = Math.max(1, Math.floor(Number(payload?.uid || 0)));
  const role: "host" | "attendee" = payload?.role === "host" ? "host" : "attendee";

  if (!channelName || !uid) {
    return json({ error: "channelName ou uid manquant." }, 400);
  }

  const agoraRole = role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireAt = Math.floor(Date.now() / 1000) + Math.max(300, EXPIRE_SEC);
  const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERT, channelName, uid, agoraRole, expireAt);

  return json({ token, channelName, uid });
});
