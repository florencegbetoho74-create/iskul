import { supabase } from "@/lib/supabase";

/**
 * Chaine de traitement des documents.
 *
 * Le client demande, suit et relance ; il ne voit jamais l'adresse du PDF
 * d'origine, qui reste dans le journal cote serveur.
 */

export type IngestionState = "none" | "queued" | "running" | "done" | "failed";

export type IngestionStatus = {
  id: string | null;
  state: IngestionState;
  pageCount: number | null;
  blockCount: number | null;
  figureCount: number | null;
  error: string | null;
  attempts: number;
  finishedAtMs: number | null;
};

export type IngestionQuota = { limit: number; used: number; left: number };

const EMPTY: IngestionStatus = {
  id: null,
  state: "none",
  pageCount: null,
  blockCount: null,
  figureCount: null,
  error: null,
  attempts: 0,
  finishedAtMs: null,
};

function toInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/**
 * Traduit ce que la base refuse en une phrase que le professeur peut lire.
 * Les codes viennent des `raise exception` de la migration.
 */
export function ingestionErrorMessage(raw: string): string {
  if (raw.startsWith("quota_atteint")) {
    const limit = raw.split(":")[1];
    return limit
      ? `Vous avez atteint la limite de ${limit} documents traites aujourd'hui. Reessayez demain.`
      : "Vous avez atteint votre limite de documents traites pour aujourd'hui.";
  }
  const known: Record<string, string> = {
    auth_required: "Reconnectez-vous pour lancer le traitement.",
    document_introuvable: "Ce document n'existe plus.",
    droits_insuffisants: "Vous ne pouvez pas lancer le traitement de ce document.",
    source_manquante: "Aucun fichier n'est attache a ce document.",
    traitement_deja_en_cours: "Un traitement est deja en cours sur ce document.",
  };
  for (const [code, message] of Object.entries(known)) {
    if (raw.includes(code)) return message;
  }
  return raw;
}

/** Met un document en file de traitement. Rend l'identifiant du travail. */
export async function requestIngestion(bookId: string, sourceUrl: string): Promise<string> {
  const { data, error } = await supabase.rpc("request_document_ingestion", {
    p_book_id: bookId,
    p_source_url: sourceUrl,
  });
  if (error) throw new Error(ingestionErrorMessage(error.message));
  return String(data);
}

export async function getIngestionStatus(bookId: string): Promise<IngestionStatus> {
  const { data, error } = await supabase.rpc("document_ingestion_state", {
    p_book_id: bookId,
  });
  if (error) throw new Error(ingestionErrorMessage(error.message));

  const row = (data ?? {}) as Record<string, unknown>;
  const state = String(row.state ?? "none");
  if (state === "none") return { ...EMPTY };

  return {
    id: row.id ? String(row.id) : null,
    state: (["queued", "running", "done", "failed"].includes(state)
      ? state
      : "none") as IngestionState,
    pageCount: toInt(row.pageCount),
    blockCount: toInt(row.blockCount),
    figureCount: toInt(row.figureCount),
    error: row.error ? String(row.error) : null,
    attempts: toInt(row.attempts) ?? 0,
    finishedAtMs: toInt(row.finishedAtMs),
  };
}

export async function getIngestionQuota(): Promise<IngestionQuota> {
  const { data, error } = await supabase.rpc("ingestion_quota_left");
  if (error) throw new Error(ingestionErrorMessage(error.message));
  const row = (data ?? {}) as Record<string, unknown>;
  const limit = toInt(row.limit) ?? 0;
  const used = toInt(row.used) ?? 0;
  return { limit, used, left: Math.max(0, limit - used) };
}

/** Relance apres un echec. Reserve aux relecteurs et aux administrateurs. */
export async function retryIngestion(bookId: string): Promise<string> {
  const { data, error } = await supabase.rpc("retry_document_ingestion", {
    p_book_id: bookId,
  });
  if (error) throw new Error(ingestionErrorMessage(error.message));
  return String(data);
}

/**
 * Suit un traitement jusqu'a son terme.
 *
 * Le journal n'est pas lisible par le client : on ne peut pas s'abonner aux
 * changements de la table, il faut demander. L'intervalle s'allonge a mesure
 * que l'attente dure, pour ne pas interroger le serveur sans fin.
 */
export function watchIngestion(
  bookId: string,
  onChange: (status: IngestionStatus) => void,
  options?: { firstDelayMs?: number; maxDelayMs?: number }
): () => void {
  const first = options?.firstDelayMs ?? 3000;
  const max = options?.maxDelayMs ?? 20000;
  let delay = first;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const status = await getIngestionStatus(bookId);
      if (!active) return;
      onChange(status);
      if (status.state === "done" || status.state === "failed" || status.state === "none") {
        return;
      }
    } catch {
      // Une interrogation qui echoue ne doit pas arreter le suivi : la
      // suivante repartira, avec un intervalle plus long.
    }
    if (!active) return;
    delay = Math.min(max, Math.round(delay * 1.5));
    timer = setTimeout(tick, delay);
  };

  timer = setTimeout(tick, first);

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}
