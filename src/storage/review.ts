import { SUPABASE_READY, supabase } from "@/lib/supabase";
import { parseContentStatus, type ContentKind, type ContentStatus } from "@/lib/contentStatus";

export type ReviewQueueItem = {
  kind: ContentKind;
  contentId: string;
  title: string;
  level?: string | null;
  subject?: string | null;
  ownerId: string;
  ownerName: string;
  submittedAtMs?: number | null;
};

function mapError(error: any, fallback: string): string {
  const message = String(error?.message || "");
  if (message.includes("reviewer_only")) return "Reserve aux relecteurs.";
  if (message.includes("not_owner")) return "Ce contenu ne vous appartient pas.";
  if (message.includes("content_not_found")) return "Ce contenu n'existe plus.";
  if (message.includes("already_in_review")) return "Deja en relecture.";
  if (message.includes("already_published")) return "Deja publie.";
  if (message.includes("not_in_review")) return "Ce contenu n'est pas en relecture.";
  if (message.includes("note_required")) return "Indiquez le motif du renvoi a l'auteur.";
  if (message.includes("invalid_decision")) return "Decision invalide.";
  if (message.includes("auth_required")) return "Connectez-vous d'abord.";
  return message || fallback;
}

/** Envoie un contenu en relecture. L'auteur ne publie plus lui-meme. */
export async function submitForReview(
  kind: ContentKind,
  contentId: string
): Promise<ContentStatus> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("submit_content_for_review", {
    p_kind: kind,
    p_content_id: contentId,
  });
  if (error) throw new Error(mapError(error, "Soumission impossible."));
  return parseContentStatus((data as any)?.status);
}

/** Retire un contenu de la file tant qu'aucun relecteur ne l'a traite. */
export async function withdrawFromReview(
  kind: ContentKind,
  contentId: string
): Promise<ContentStatus> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  const { data, error } = await supabase.rpc("withdraw_content_from_review", {
    p_kind: kind,
    p_content_id: contentId,
  });
  if (error) throw new Error(mapError(error, "Retrait impossible."));
  return parseContentStatus((data as any)?.status);
}

/** File d'attente des contenus a relire, du plus ancien au plus recent. */
export async function getReviewQueue(limit = 100): Promise<ReviewQueueItem[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase.rpc("review_queue", { p_limit: limit });
  if (error) throw new Error(mapError(error, "File de relecture indisponible."));

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    kind: (row?.content_kind === "book" || row?.content_kind === "quiz"
      ? row.content_kind
      : "course") as ContentKind,
    contentId: String(row?.content_id ?? ""),
    title: String(row?.title ?? "Sans titre"),
    level: row?.level ?? null,
    subject: row?.subject ?? null,
    ownerId: String(row?.owner_id ?? ""),
    ownerName: String(row?.owner_name ?? "Sans nom"),
    submittedAtMs: row?.submitted_at_ms ?? null,
  }));
}

/**
 * Decision du relecteur.
 * Un renvoi a l'auteur exige un motif : sans lui, l'auteur se heurte a un mur.
 */
export async function decideReview(input: {
  kind: ContentKind;
  contentId: string;
  decision: "published" | "rejected";
  note?: string | null;
}): Promise<ContentStatus> {
  if (!SUPABASE_READY) throw new Error("Supabase non configure.");
  if (input.decision === "rejected" && !String(input.note ?? "").trim()) {
    throw new Error("Indiquez le motif du renvoi a l'auteur.");
  }
  const { data, error } = await supabase.rpc("review_content", {
    p_kind: input.kind,
    p_content_id: input.contentId,
    p_decision: input.decision,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(mapError(error, "Decision non enregistree."));
  return parseContentStatus((data as any)?.status);
}
