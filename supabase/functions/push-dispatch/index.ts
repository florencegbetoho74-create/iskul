// Edge Function : draine la file push_outbox et envoie les notifications a Expo.
//
// Invocation attendue toutes les minutes, via le planificateur Supabase ou un
// cron externe. Un secret partage est exige : sans lui, n'importe qui pourrait
// declencher des envois.
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// Expo accepte 100 messages par requete.
const EXPO_BATCH_SIZE = 100;
// Au-dela, une ligne est abandonnee : trois echecs signalent un probleme de
// fond, pas un incident reseau.
const MAX_ATTEMPTS = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type OutboxRow = {
  id: number;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  attempts: number;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const secret = Deno.env.get("PUSH_DISPATCH_SECRET") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }
  if (!secret) {
    // Sans secret configure, on refuse plutot que d'exposer un declencheur
    // d'envoi ouvert.
    return json({ ok: false, error: "push_secret_missing" }, 500);
  }
  if (req.headers.get("x-push-secret") !== secret) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pending, error: readError } = await admin
    .from("push_outbox")
    .select("id,user_id,title,body,data,attempts")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at_ms", { ascending: true })
    .limit(500);

  if (readError) {
    return json({ ok: false, error: "read_failed", detail: readError.message }, 500);
  }

  const rows = (pending || []) as OutboxRow[];
  if (!rows.length) return json({ ok: true, sent: 0, failed: 0, skipped: 0 });

  // Un utilisateur peut avoir plusieurs appareils : on resout les jetons en une
  // seule requete plutot qu'une par ligne.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,expo_push_tokens,notifications_enabled")
    .in("id", userIds);

  if (profileError) {
    return json({ ok: false, error: "profiles_failed", detail: profileError.message }, 500);
  }

  const tokensByUser = new Map<string, string[]>();
  for (const profile of (profiles || []) as any[]) {
    if (profile?.notifications_enabled === false) continue;
    const tokens = Array.isArray(profile?.expo_push_tokens) ? profile.expo_push_tokens : [];
    tokensByUser.set(String(profile.id), tokens.filter((t: unknown) => typeof t === "string" && t));
  }

  type Envelope = { rowId: number; token: string; message: Record<string, unknown> };
  const envelopes: Envelope[] = [];
  const skipped: number[] = [];

  for (const row of rows) {
    const tokens = tokensByUser.get(row.user_id) || [];
    if (!tokens.length) {
      // Plus aucun appareil joignable : inutile de reessayer indefiniment.
      skipped.push(row.id);
      continue;
    }
    for (const token of tokens) {
      envelopes.push({
        rowId: row.id,
        token,
        message: {
          to: token,
          title: row.title,
          body: row.body,
          data: row.data || {},
          sound: "default",
          channelId: "default",
        },
      });
    }
  }

  if (skipped.length) {
    await admin
      .from("push_outbox")
      .update({ status: "failed", last_error: "no_active_token" })
      .in("id", skipped);
  }

  const okRows = new Set<number>();
  const errorByRow = new Map<number, string>();
  const deadTokens = new Set<string>();

  for (const batch of chunk(envelopes, EXPO_BATCH_SIZE)) {
    let tickets: ExpoTicket[] = [];
    try {
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch.map((e) => e.message)),
      });
      const payload = await response.json();
      tickets = Array.isArray(payload?.data) ? payload.data : [];
      if (!response.ok && !tickets.length) {
        throw new Error(`expo_http_${response.status}`);
      }
    } catch (error: any) {
      // Incident reseau : on incremente le compteur et on retentera.
      for (const envelope of batch) {
        errorByRow.set(envelope.rowId, String(error?.message || "expo_unreachable"));
      }
      continue;
    }

    batch.forEach((envelope, index) => {
      const ticket = tickets[index];
      if (!ticket) {
        errorByRow.set(envelope.rowId, "expo_no_ticket");
        return;
      }
      if (ticket.status === "ok") {
        okRows.add(envelope.rowId);
        return;
      }
      const reason = ticket.details?.error || ticket.message || "expo_error";
      if (reason === "DeviceNotRegistered") {
        deadTokens.add(envelope.token);
      }
      errorByRow.set(envelope.rowId, reason);
    });
  }

  // Un appareil desinstalle garde un jeton mort : le laisser ferait echouer
  // chaque envoi suivant a cet utilisateur.
  for (const token of deadTokens) {
    await admin.rpc("remove_push_token", { p_token: token }).catch(() => {});
  }

  const nowMs = Date.now();
  if (okRows.size) {
    await admin
      .from("push_outbox")
      .update({ status: "sent", sent_at_ms: nowMs, last_error: null })
      .in("id", Array.from(okRows));
  }

  // Une ligne partiellement livree (un appareil sur deux) compte comme envoyee.
  const failedRows = Array.from(errorByRow.keys()).filter((id) => !okRows.has(id));
  for (const rowId of failedRows) {
    const row = rows.find((r) => r.id === rowId);
    const attempts = (row?.attempts ?? 0) + 1;
    await admin
      .from("push_outbox")
      .update({
        attempts,
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        last_error: errorByRow.get(rowId) || "unknown",
      })
      .eq("id", rowId);
  }

  return json({
    ok: true,
    sent: okRows.size,
    failed: failedRows.length,
    skipped: skipped.length,
    devicesCleaned: deadTokens.size,
  });
});
