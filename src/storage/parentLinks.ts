import { SUPABASE_READY, supabase } from "@/lib/supabase";

export type PairingCode = {
  code: string;
  expiresAtMs: number;
  validForMinutes: number;
};

export type ParentLink = {
  id: string;
  label?: string | null;
  createdAtMs: number;
  lastUsedAtMs?: number | null;
};

function mapError(error: any, fallback: string): string {
  const message = String(error?.message || "");
  if (message.includes("auth_required")) return "Connectez-vous d'abord.";
  if (message.includes("link_not_found")) return "Cet acces a deja ete retire.";
  if (message.includes("code_generation_failed")) return "Reessayez dans un instant.";
  return message || fallback;
}

/**
 * Genere un code d'appairage a transmettre au parent.
 *
 * Le code remplace le precedent s'il en existait un en attente : deux codes
 * valides en meme temps doublent la surface d'attaque sans rien apporter.
 */
export async function createPairingCode(): Promise<PairingCode> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("create_parent_pairing_code");
  if (error) throw new Error(mapError(error, "Code non genere."));
  const row = (data || {}) as any;
  if (!row.code) throw new Error("Code non genere.");
  return {
    code: String(row.code),
    expiresAtMs: Number(row.expiresAtMs || 0),
    validForMinutes: Number(row.validForMinutes || 15),
  };
}

/** Acces parentaux actifs sur le compte de l'eleve. */
export async function listParentLinks(): Promise<ParentLink[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase.rpc("my_parent_links");
  if (error) throw new Error(mapError(error, "Acces indisponibles."));
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    id: String(row?.id ?? ""),
    label: row?.label ?? null,
    createdAtMs: Number(row?.created_at_ms || 0),
    lastUsedAtMs: row?.last_used_at_ms ?? null,
  }));
}

/** Retire un acces : le parent perd immediatement la consultation. */
export async function revokeParentLink(linkId: string): Promise<void> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { error } = await supabase.rpc("revoke_parent_link", { p_link_id: linkId });
  if (error) throw new Error(mapError(error, "Retrait impossible."));
}
