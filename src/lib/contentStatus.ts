// Statut editorial d'un contenu, cote interface.
//
// Le libelle affiche a l'auteur doit dire ou en est son travail et ce qu'il
// peut faire ensuite. "Publié / Non publié" ne suffit plus : un cours refuse et
// un cours jamais soumis ne demandent pas la meme action.

export type ContentStatus = "draft" | "in_review" | "published" | "rejected";

export type ContentKind = "course" | "book" | "quiz";

const KNOWN: ContentStatus[] = ["draft", "in_review", "published", "rejected"];

/** Ramene une valeur serveur vers un statut connu, brouillon par defaut. */
export function parseContentStatus(input?: string | null): ContentStatus {
  const raw = String(input ?? "").trim().toLowerCase();
  return (KNOWN as string[]).includes(raw) ? (raw as ContentStatus) : "draft";
}

export type StatusPresentation = {
  label: string;
  /** Ce que l'auteur doit comprendre de la situation. */
  hint: string;
  tone: "neutral" | "pending" | "success" | "danger";
};

const PRESENTATION: Record<ContentStatus, StatusPresentation> = {
  draft: {
    label: "Brouillon",
    hint: "Visible de vous seul. Soumettez-le pour qu'un relecteur le valide.",
    tone: "neutral",
  },
  in_review: {
    label: "En relecture",
    hint: "Un relecteur doit le valider avant sa mise en ligne.",
    tone: "pending",
  },
  published: {
    label: "Publié",
    hint: "En ligne pour les élèves concernes.",
    tone: "success",
  },
  rejected: {
    label: "A corriger",
    hint: "Le relecteur a demande des modifications avant publication.",
    tone: "danger",
  },
};

export function presentStatus(status: ContentStatus): StatusPresentation {
  return PRESENTATION[status];
}

/** L'auteur peut-il envoyer ce contenu en relecture ? */
export function canSubmit(status: ContentStatus): boolean {
  return status === "draft" || status === "rejected";
}

/** L'auteur peut-il le retirer de la file avant qu'un relecteur s'en saisisse ? */
export function canWithdraw(status: ContentStatus): boolean {
  return status === "in_review";
}

/**
 * Libelle du bouton principal offert a l'auteur.
 * Renvoie null quand aucune action ne lui appartient.
 */
export function authorActionLabel(status: ContentStatus): string | null {
  if (status === "draft") return "Envoyer en relecture";
  if (status === "rejected") return "Renvoyer en relecture";
  if (status === "in_review") return "Retirer de la file";
  return null;
}

/** Un contenu refuse s'accompagne toujours d'un motif cote serveur. */
export function rejectionNote(status: ContentStatus, note?: string | null): string | null {
  if (status !== "rejected") return null;
  const clean = String(note ?? "").trim();
  return clean || "Le relecteur n'a pas laisse de motif.";
}
