import { SUPABASE_READY, supabase } from "@/lib/supabase";

export type LiveParticipant = {
  userId: string;
  agoraUid: number | null;
  displayName: string;
  role: "host" | "attendee";
  joinedAtMs: number;
  leftAtMs: number | null;
  handRaisedAtMs: number | null;
  mutedByHost: boolean;
  isBanned: boolean;
  present: boolean;
};

export type LiveMessage = {
  id: string;
  userId: string;
  authorName: string;
  text: string;
  isHost: boolean;
  atMs: number;
};

export type AttendanceRow = {
  userId: string;
  displayName: string;
  role: "host" | "attendee";
  joinedAtMs: number;
  leftAtMs: number | null;
  totalMs: number;
  isBanned: boolean;
  stillPresent: boolean;
};

export type ModerationAction = "mute" | "unmute" | "lower_hand" | "kick";

function mapError(error: any, fallback: string): string {
  const message = String(error?.message || "");
  if (message.includes("live_not_found")) return "Cette seance n'existe plus.";
  if (message.includes("live_ended")) return "La séance est terminee.";
  if (message.includes("participant_banned")) return "Vous avez été exclu de cette séance.";
  if (message.includes("host_only")) return "Reserve a l'animateur.";
  if (message.includes("not_in_live")) return "Rejoignez la seance d'abord.";
  if (message.includes("cannot_moderate_self")) return "Vous ne pouvez pas vous moderer.";
  if (message.includes("participant_not_found")) return "Participant introuvable.";
  if (message.includes("empty_message")) return "Message vide.";
  if (message.includes("auth_required")) return "Connectez-vous d'abord.";
  return message || fallback;
}

function mapParticipant(row: any): LiveParticipant {
  const leftAtMs = row?.left_at_ms ?? null;
  return {
    userId: String(row?.user_id ?? ""),
    agoraUid: row?.agora_uid == null ? null : Number(row.agora_uid),
    displayName: String(row?.display_name ?? "Participant"),
    role: row?.role === "host" ? "host" : "attendee",
    joinedAtMs: Number(row?.joined_at_ms || 0),
    leftAtMs,
    handRaisedAtMs: row?.hand_raised_at_ms ?? null,
    mutedByHost: !!row?.muted_by_host,
    isBanned: !!row?.is_banned,
    present: leftAtMs === null && !row?.is_banned,
  };
}

function mapMessage(row: any): LiveMessage {
  return {
    id: String(row?.id ?? ""),
    userId: String(row?.user_id ?? ""),
    authorName: String(row?.author_name ?? "Participant"),
    text: String(row?.text ?? ""),
    isHost: !!row?.is_host,
    atMs: Number(row?.at_ms || 0),
  };
}

/**
 * Enregistre l'entree dans la salle et associe l'identifiant Agora au compte.
 * Sans cette association, la salle ne peut afficher que des nombres a la place
 * des noms.
 */
export async function joinLive(liveId: string, agoraUid?: number | null) {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("join_live", {
    p_live_id: liveId,
    p_agora_uid: agoraUid ?? null,
  });
  if (error) throw new Error(mapError(error, "Impossible de rejoindre la séance."));
  return {
    role: (data as any)?.role === "host" ? ("host" as const) : ("attendee" as const),
    joinedAtMs: Number((data as any)?.joinedAtMs || Date.now()),
  };
}

/** Maintient la presence a jour ; alimente la duree de la feuille de presence. */
export async function heartbeatLive(liveId: string): Promise<void> {
  if (!SUPABASE_READY) return;
  await supabase.rpc("heartbeat_live", { p_live_id: liveId });
}

export async function leaveLive(liveId: string): Promise<void> {
  if (!SUPABASE_READY) return;
  await supabase.rpc("leave_live", { p_live_id: liveId });
}

export async function setHandRaised(liveId: string, raised: boolean): Promise<void> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { error } = await supabase.rpc("set_hand_raised", {
    p_live_id: liveId,
    p_raised: raised,
  });
  if (error) throw new Error(mapError(error, "Action impossible."));
}

export async function moderateParticipant(
  liveId: string,
  userId: string,
  action: ModerationAction
): Promise<void> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { error } = await supabase.rpc("moderate_live_participant", {
    p_live_id: liveId,
    p_user_id: userId,
    p_action: action,
  });
  if (error) throw new Error(mapError(error, "Moderation impossible."));
}

export async function postLiveMessage(liveId: string, text: string): Promise<LiveMessage> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("post_live_message", {
    p_live_id: liveId,
    p_text: text,
  });
  if (error) throw new Error(mapError(error, "Message non envoye."));
  return mapMessage(data);
}

export async function getAttendance(liveId: string): Promise<AttendanceRow[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase.rpc("live_attendance", { p_live_id: liveId });
  if (error) throw new Error(mapError(error, "Feuille de presence indisponible."));
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    userId: String(row?.user_id ?? ""),
    displayName: String(row?.display_name ?? "Participant"),
    role: row?.role === "host" ? "host" : "attendee",
    joinedAtMs: Number(row?.joined_at_ms || 0),
    leftAtMs: row?.left_at_ms ?? null,
    totalMs: Number(row?.total_ms || 0),
    isBanned: !!row?.is_banned,
    stillPresent: !!row?.still_present,
  }));
}

/** Roster de la salle, rafraichi a chaque changement de presence. */
export function watchParticipants(liveId: string, cb: (rows: LiveParticipant[]) => void) {
  let active = true;

  const fetchOnce = async () => {
    const { data } = await supabase
      .from("live_participants")
      .select("*")
      .eq("live_id", liveId)
      .order("joined_at_ms", { ascending: true });
    if (active) cb(((data as any[]) || []).map(mapParticipant));
  };

  fetchOnce();

  const channel = supabase
    .channel(`live-participants-${liveId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_participants", filter: `live_id=eq.${liveId}` },
      () => fetchOnce()
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

/** Chat de seance. Les nouveaux messages sont ajoutes sans requete supplementaire. */
export function watchLiveMessages(liveId: string, cb: (rows: LiveMessage[]) => void) {
  let active = true;
  let buffer: LiveMessage[] = [];

  const push = (rows: LiveMessage[]) => {
    buffer = rows;
    if (active) cb(rows);
  };

  (async () => {
    const { data } = await supabase
      .from("live_messages")
      .select("*")
      .eq("live_id", liveId)
      .order("at_ms", { ascending: true })
      .limit(200);
    push(((data as any[]) || []).map(mapMessage));
  })();

  const channel = supabase
    .channel(`live-messages-${liveId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_messages", filter: `live_id=eq.${liveId}` },
      (payload) => {
        const next = mapMessage(payload.new);
        if (!next.id || buffer.some((m) => m.id === next.id)) return;
        push([...buffer, next].slice(-200));
      }
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}
