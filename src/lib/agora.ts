import { supabase, SUPABASE_READY } from "@/lib/supabase";

type Role = "host" | "attendee";

type AgoraTokenResponse = {
  token: string;
  channelName: string;
  uid: number;
};

function getEnv(key: string) {
  return (process.env as any)?.[key] as string | undefined;
}

function pickChannelName(data: any): string | null {
  return (
    (typeof data?.channelName === "string" && data.channelName) ||
    (typeof data?.channel_name === "string" && data.channel_name) ||
    (typeof data?.channel === "string" && data.channel) ||
    null
  );
}

function pickToken(data: any): string | null {
  return (typeof data?.token === "string" && data.token) || null;
}

function pickUid(data: any): number | null {
  const raw = data?.uid;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export async function fetchAgoraToken(input: {
  channelName?: string;
  liveId?: string;
  uid: number;
  role: Role;
}): Promise<AgoraTokenResponse> {
  const channelName = input.channelName || input.liveId;
  if (!channelName) throw new Error("channelName manquant.");
  if (!input?.uid) throw new Error("uid manquant.");

  const endpoint =
    getEnv("EXPO_PUBLIC_AGORA_TOKEN_URL") ||
    getEnv("NEXT_PUBLIC_AGORA_TOKEN_URL") ||
    "";

  if (endpoint) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, uid: input.uid, role: input.role }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Erreur token Agora.");
    }
    const data = await res.json().catch(() => ({}));
    const token = pickToken(data);
    const chan = pickChannelName(data) || channelName;
    const uid = pickUid(data) || input.uid;
    if (!token || !chan) throw new Error("Reponse token Agora invalide.");
    return { token, channelName: chan, uid };
  }

  const fnName = getEnv("EXPO_PUBLIC_AGORA_TOKEN_FUNCTION") || "agora-token";
  if (!SUPABASE_READY) {
    throw new Error("Supabase non configure et EXPO_PUBLIC_AGORA_TOKEN_URL absent.");
  }

  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { channelName, uid: input.uid, role: input.role },
  });
  if (error) throw error;
  const token = pickToken(data);
  const chan = pickChannelName(data) || channelName;
  const uid = pickUid(data) || input.uid;
  if (!token || !chan) throw new Error("Reponse token Agora invalide.");
  return { token, channelName: chan, uid };
}
