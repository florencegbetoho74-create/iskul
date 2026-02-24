import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function hasValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_payload" }, 400);
    }

    const name = normalizeText(payload?.name).slice(0, 120);
    const email = normalizeEmail(payload?.email).slice(0, 180);
    const message = normalizeText(payload?.message).slice(0, 4000);
    const source = normalizeText(payload?.source || "website").slice(0, 64);

    // Basic honeypot field. Bots often fill hidden "website" fields.
    const website = normalizeText(payload?.website);
    if (website) {
      return json({ ok: true });
    }

    if (!name || !email || !message) return json({ ok: false, error: "missing_fields" }, 400);
    if (!hasValidEmail(email)) return json({ ok: false, error: "invalid_email" }, 400);
    if (message.length < 10) return json({ ok: false, error: "message_too_short" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ip = getClientIp(req);
    const userAgent = normalizeText(req.headers.get("user-agent")).slice(0, 512) || null;

    const { error } = await admin.from("contact_messages").insert({
      full_name: name,
      email,
      message,
      source,
      ip_address: ip,
      user_agent: userAgent,
      created_at_ms: Date.now(),
    });

    if (error) {
      const lower = String(error.message || "").toLowerCase();
      if (
        (lower.includes("relation") && lower.includes("contact_messages")) ||
        (lower.includes("contact_messages") && lower.includes("schema")) ||
        (lower.includes("contact_messages") && lower.includes("does not exist"))
      ) {
        return json({ ok: false, error: "contact_storage_not_configured" }, 500);
      }
      return json({ ok: false, error: "contact_store_failed" }, 500);
    }

    return json({ ok: true });
  } catch (err: any) {
    const detail = String(err?.message || "internal_error");
    console.error("contact-message fatal", detail);
    return json({ ok: false, error: "internal_error", detail }, 500);
  }
});
