// Logique de salle : qui est a l'ecran, dans quel ordre, et depuis combien de
// temps. Aucune dependance React Native ni Supabase, pour rester testable.

export type RosterEntry = {
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

/**
 * Retrouve le nom derriere un identifiant Agora.
 *
 * C'est le correctif du "Participant 1042318" : le flux video ne transporte
 * qu'un nombre, l'association vit en base. Renvoie null si l'identifiant n'est
 * rattache a personne -- l'appelant choisit alors quoi afficher plutot que de
 * recevoir un nom invente.
 */
export function nameForAgoraUid(
  uid: number | null | undefined,
  roster: readonly RosterEntry[]
): string | null {
  if (uid === null || uid === undefined || !Number.isFinite(uid)) return null;
  const match = roster.find((p) => p.agoraUid === uid);
  return match ? match.displayName : null;
}

/** Libelle affiche sous une vignette video. */
export function tileLabel(
  uid: number | null | undefined,
  roster: readonly RosterEntry[],
  selfUid?: number | null
): string {
  if (uid !== null && uid !== undefined && selfUid !== null && selfUid !== undefined && uid === selfUid) {
    return "Vous";
  }
  return nameForAgoraUid(uid, roster) ?? "Participant";
}

/**
 * Ordre d'affichage du roster : l'animateur, puis les mains levees dans l'ordre
 * ou elles se sont levees, puis les autres par ordre alphabetique.
 */
export function sortRoster(roster: readonly RosterEntry[]): RosterEntry[] {
  return [...roster].sort((a, b) => {
    if (a.role !== b.role) return a.role === "host" ? -1 : 1;

    const aHand = a.handRaisedAtMs ?? null;
    const bHand = b.handRaisedAtMs ?? null;
    if (aHand !== null && bHand !== null) return aHand - bHand;
    if (aHand !== null) return -1;
    if (bHand !== null) return 1;

    return a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" });
  });
}

/** Ne garde que les personnes actuellement dans la salle. */
export function presentOnly(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((p) => p.present);
}

/**
 * File des mains levees, de la plus ancienne a la plus recente.
 * Une main levee par quelqu'un qui a quitte la salle ne compte pas.
 */
export function raisedHands(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster
    .filter((p) => p.present && p.handRaisedAtMs !== null)
    .sort((a, b) => (a.handRaisedAtMs as number) - (b.handRaisedAtMs as number));
}

/** Duree lisible pour la feuille de presence. */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalMinutes = Math.floor(safe / 60000);
  if (totalMinutes < 1) return "moins d'une minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

/**
 * Un eleve doit-il couper son micro ?
 * L'animateur peut imposer le silence ; le participant garde la main sur son
 * propre micro par ailleurs.
 */
export function micDisabled(entry: RosterEntry | null | undefined): boolean {
  if (!entry) return false;
  return entry.role !== "host" && entry.mutedByHost;
}
