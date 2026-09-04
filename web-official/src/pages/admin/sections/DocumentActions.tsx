import { useEffect, useState } from "react";

import {
  getContentDetail,
  listIngestions,
  requestIngestionForBook,
  type IngestionJob,
} from "../../../lib/admin";
import { relativeTime } from "../../../components/admin/DataTable";

/**
 * Le traitement d'un document, décidé depuis la console.
 *
 * Le dépôt ne déclenche plus rien. Chaque extraction coûte un appel facturé :
 * l'équipe bibliothèque regarde de quoi il s'agit, puis décide. Un document
 * déposé attend donc ici.
 *
 * Trois états valent d'être distingués — déjà converti, jamais traité, échoué —
 * parce qu'ils appellent trois gestes différents.
 */
export default function DocumentActions({ bookId }: { bookId: string }) {
  const [hasSource, setHasSource] = useState<boolean | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [detail, jobs] = await Promise.all([
          getContentDetail("book", bookId),
          listIngestions(undefined, 200).catch(() => [] as IngestionJob[]),
        ]);
        if (!alive) return;
        setHasSource(detail.hasSource ?? false);
        setHasContent(detail.hasContent ?? false);
        setJob(jobs.find((row) => row.book_id === bookId) ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Lecture impossible.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookId]);

  const launch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await requestIngestionForBook(bookId);
      setNote("Traitement demandé. Il partira au prochain passage du planificateur.");
      const jobs = await listIngestions(undefined, 200).catch(() => [] as IngestionJob[]);
      setJob(jobs.find((row) => row.book_id === bookId) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demande impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (hasSource === null) {
    return <span className="skeleton skeleton-line short" />;
  }

  const running = job?.state === "queued" || job?.state === "running";

  return (
    <section className="doc-actions">
      <h4>Traitement du document</h4>

      {error ? (
        <div className="notice danger">
          <p>{error}</p>
        </div>
      ) : null}
      {note ? (
        <div className="notice success">
          <p>{note}</p>
        </div>
      ) : null}

      {!hasSource ? (
        <p className="source-verdict is-blocking">
          Aucun fichier n'est attaché à ce document. Il n'y a rien à convertir.
        </p>
      ) : hasContent ? (
        <p className="muted">
          Déjà converti{job?.finished_at_ms ? ` ${relativeTime(job.finished_at_ms)}` : ""}
          {job?.block_count ? ` · ${job.block_count} blocs` : ""}
          {job?.figure_count ? ` · ${job.figure_count} figures à compléter` : ""}. Relancer
          écrasera le contenu actuel.
        </p>
      ) : (
        <p className="muted">
          Le fichier n'a jamais été converti. Tant qu'il ne l'est pas, l'élève n'a rien à lire :
          un PDF ne s'affiche pas dans l'application.
        </p>
      )}

      {job?.state === "failed" ? (
        <p className="source-verdict is-blocking">
          Dernière tentative échouée : {job.error || "sans motif"}
        </p>
      ) : null}

      {hasSource ? (
        <button
          type="button"
          className={hasContent ? "btn ghost small" : "btn primary small"}
          disabled={busy || running}
          onClick={() => void launch()}
        >
          {running
            ? "Traitement en file"
            : busy
            ? "Demande…"
            : hasContent
            ? "Relancer la conversion"
            : "Lancer la conversion"}
        </button>
      ) : null}
    </section>
  );
}
