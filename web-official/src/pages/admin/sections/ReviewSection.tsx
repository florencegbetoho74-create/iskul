import { useCallback, useEffect, useState } from "react";

import { getReviewQueue, reviewContent, type ReviewItem } from "../../../lib/admin";
import { relativeTime } from "../../../components/admin/DataTable";
import ReviewDetail from "./ReviewDetail";

const KIND_LABEL: Record<string, string> = {
  course: "Cours",
  book: "Document",
  quiz: "Quiz",
};

/**
 * File de relecture.
 *
 * Ce n'est pas un tableau : accepter ou refuser un contenu demande de le lire,
 * et un refus demande d'ecrire pourquoi. Chaque entree est donc une fiche, avec
 * son motif ouvert au moment ou l'on refuse -- pas avant, pour ne pas
 * encombrer, pas apres, pour ne pas renvoyer un contenu sans explication.
 */
export default function ReviewSection() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  // Le contenu ne se charge qu'a l'ouverture : la file peut etre longue, et
  // charger cinquante cours pour en juger un serait absurde.
  const [opened, setOpened] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await getReviewQueue());
    } catch (e) {
      setError(e instanceof Error ? e.message : "File indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (item: ReviewItem, decision: "approve" | "reject") => {
    const key = `${item.content_kind}:${item.content_id}`;
    if (busyId) return;

    if (decision === "reject" && !note.trim()) {
      setError("Indiquez ce qui doit être corrigé avant de renvoyer le contenu.");
      return;
    }

    setBusyId(key);
    setError(null);
    try {
      await reviewContent(item.content_kind, item.content_id, decision, note);
      // La ligne disparait de la file : la recharger entierement ferait
      // sauter la page sous le curseur du relecteur.
      setItems((prev) =>
        prev.filter((row) => `${row.content_kind}:${row.content_id}` !== key)
      );
      setRejecting(null);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Décision impossible.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="stack" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="card">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stack stack--loose">
      {error ? (
        <div className="notice danger">
          <p>{error}</p>
        </div>
      ) : null}

      {!items.length ? (
        <div className="empty">
          <h3>Rien à relire</h3>
          <p>
            Aucun contenu n'attend de décision. Les professeurs soumettent depuis leur espace, et
            les contenus arrivent ici.
          </p>
        </div>
      ) : null}

      {items.map((item) => {
        const key = `${item.content_kind}:${item.content_id}`;
        const busy = busyId === key;
        const isRejecting = rejecting === key;

        return (
          <article key={key} className="card review-card">
            <div className="review-head">
              <span className="badge primary">{KIND_LABEL[item.content_kind] ?? item.content_kind}</span>
              <div className="review-title">
                <h3>{item.title || "Sans titre"}</h3>
                <p className="muted">
                  {[item.level, item.subject].filter(Boolean).join(" · ") || "Non classé"} ·{" "}
                  {item.owner_name || "Auteur inconnu"} · soumis {relativeTime(item.submitted_at_ms)}
                </p>
              </div>
            </div>

            <div className="review-actions">
              <button
                type="button"
                className="btn ghost small"
                aria-expanded={opened === key}
                onClick={() => setOpened(opened === key ? null : key)}
              >
                {opened === key ? "Masquer le contenu" : "Voir le contenu"}
              </button>
            </div>

            {opened === key ? <ReviewDetail kind={item.content_kind} id={item.content_id} /> : null}

            {isRejecting ? (
              <div className="field">
                <label htmlFor={`note-${key}`}>Ce qui doit être corrigé</label>
                <span className="field-hint">
                  L'auteur lira ce texte tel quel. Une phrase précise évite un second aller-retour.
                </span>
                <textarea
                  id={`note-${key}`}
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="La vidéo du chapitre 2 ne se lit pas, et la classe indiquée ne correspond pas au contenu."
                />
              </div>
            ) : null}

            <div className="review-actions">
              {isRejecting ? (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(null);
                      setNote("");
                      setError(null);
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => void decide(item, "reject")}
                  >
                    {busy ? "Envoi…" : "Renvoyer à l'auteur"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(key);
                      setNote("");
                      setError(null);
                    }}
                  >
                    Demander une correction
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || opened !== key}
                    title={
                      opened === key
                        ? undefined
                        : "Ouvrez le contenu avant de le publier."
                    }
                    onClick={() => void decide(item, "approve")}
                  >
                    {busy ? "Publication…" : "Publier"}
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
