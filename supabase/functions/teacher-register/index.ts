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

function normalizeEmail(input: unknown): string {
  return String(input || "").trim().toLowerCase();
}

function normalizeText(input: unknown): string {
  return String(input || "").trim();
}

function normalizeSubjects(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((s) => normalizeText(s))
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

function hasValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

function hasAllowedDomain(email: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const domain = email.split("@")[1] || "";
  return allowlist.includes(domain);
}

function mapCreateUserError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already") || lower.includes("registered")) return "already_registered";
  if (lower.includes("password")) return "weak_password";
  return "registration_failed";
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const portalSecret = Deno.env.get("TEACHER_PORTAL_KEY") || "";
    const portalRequireKey = (Deno.env.get("TEACHER_PORTAL_REQUIRE_KEY") || "false").trim().toLowerCase() === "true";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "server_misconfigured" }, 500);
    }

    const allowlist = (Deno.env.get("TEACHER_PORTAL_ALLOWED_DOMAINS") || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_payload" }, 400);
    }

    const name = normalizeText(payload?.name);
    const email = normalizeEmail(payload?.email);
    const password = normalizeText(payload?.password);
    const school = normalizeText(payload?.school);
    const portalKey = normalizeText(payload?.portalKey);
    const subjects = normalizeSubjects(payload?.subjects);

    if (!name || !email || !password) {
      return json({ ok: false, error: "missing_fields" }, 400);
    }
    if (!hasValidEmail(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }
    if (password.length < 8) {
      return json({ ok: false, error: "weak_password" }, 400);
    }
    if (portalRequireKey) {
      if (!portalSecret) return json({ ok: false, error: "server_misconfigured" }, 500);
      if (portalKey !== portalSecret) {
        return json({ ok: false, error: "invalid_portal_key" }, 403);
      }
    }
    if (!hasAllowedDomain(email, allowlist)) {
      return json({ ok: false, error: "domain_not_allowed" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: settings } = await admin
      .from("admin_settings")
      .select("teacher_portal_open,teacher_portal_message")
      .eq("id", 1)
      .maybeSingle();

    if (settings && settings.teacher_portal_open === false) {
      return json(
        {
          ok: false,
          error: "portal_closed",
          message: settings.teacher_portal_message || "Le portail d'inscription professeur est ferme.",
        },
        403
      );
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        signup_source: "teacher_portal",
      },
    });

    if (createError || !created.user) {
      return json({ ok: false, error: mapCreateUserError(createError?.message || "") }, 400);
    }

    const userId = created.user.id;

    const profilePayload: Record<string, unknown> = {
      id: userId,
      name,
      email,
      role: "teacher",
      is_admin: false,
      last_seen_ms: Date.now(),
    };
    if (school) profilePayload.school = school;
    if (subjects.length) profilePayload.subjects = subjects;

    const { error: profileError } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // rollback best effort
      }
      return json(
        { ok: false, error: "profile_creation_failed", detail: profileError.message || "unknown_profile_error" },
        500
      );
    }

    try {
      await admin.from("teacher_portal_audit").insert({
        email,
        full_name: name,
        school: school || null,
        subjects: subjects.length ? subjects : null,
        created_user_id: userId,
        source: portalRequireKey ? "portal_key" : "public_portal",
        created_at_ms: Date.now(),
      });
    } catch {
      // audit is best effort, do not block signup
    }

    return json({ ok: true, userId });
  } catch (error: any) {
    const message = String(error?.message || "internal_error");
    console.error("teacher-register fatal", message);
    return json({ ok: false, error: "internal_error", detail: message }, 500);
  }
});
