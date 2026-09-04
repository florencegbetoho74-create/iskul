import { useEffect, useState } from "react";

import {
  getPushHealth,
  getSnapshot,
  listUnclassified,
  type DashboardSnapshot,
  type PushHealth,
  type UnclassifiedItem,
} from "../../../lib/admin";
import DataTable, { relativeTime, type Column } from "../../../components/admin/DataTable";

const KIND_LABEL: Record<string, string> = {
  course: "Cours",
  book: "Document",
  quiz: "Quiz",
};

const COLUMNS: Column<UnclassifiedItem>[] = [
  {
    key: "kind",
    header: "Type",
    render: (row) => <span className="badge">{KIND_LABEL[row.kind] ?? row.kind}</span>,
  },
  { key: "title", header: "Titre", render: (row) => row.title || "Sans titre" },
  {
    key: "level",
    header: "Classe saisie",
    secondary: true,
    render: (row) => row.level_text || <span className="muted">non renseignée</span>,
  },
  {
    key: "subject",
    header: "Matière saisie",
    secondary: true,
    render: (row) => row.subject_text || <span className="muted">non renseignée</span>,
  },
  {
    key: "updated",
    header: "Modifié",
    align: "end",
    render: (row) => relativeTime(row.updated_at_ms),
  },
];

/**
 * Vue d'ensemble.
 *
 * Les compteurs viennent en second. Ce qui ouvre la page, c'est la liste des
 * contenus non rattaches au referentiel : leur auteur les croit en ligne et
 * aucun eleve ne les voit. C'est le seul endroit ou cette panne est visible.
 */
export default function OverviewSection() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<PushHealth | null>(null);
  const [orphans, setOrphans] = useState<UnclassifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [snap, push, unclassified] = await Promise.all([
          getSnapshot(),
          getPushHealth().catch(() => null),
          listUnclassified().catch(() => [] as UnclassifiedItem[]),
        ]);
        if (!alive) return;
        setSnapshot(snap);
        setHealth(push);
        setOrphans(unclassified);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="notice danger">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="stack stack--loose">
      {orphans.length ? (
        <section className="stack">
          <div className="notice warning">
            <p>
              <strong>
                {orphans.length} contenu{orphans.length > 1 ? "s" : ""} sans classe ni matière du
                référentiel.
              </strong>{" "}
              Ils n'apparaissent dans la portée d'aucun élève : leur auteur les croit en ligne.
              Reclassez-les depuis la fiche du contenu.
            </p>
          </div>
          <DataTable
            rows={orphans}
            columns={COLUMNS}
            rowKey={(row) => `${row.kind}:${row.id}`}
            emptyTitle="Tout est classé"
            emptyMessage="Aucun contenu orphelin."
          />
        </section>
      ) : null}

      <section className="console-metrics" data-stagger="60">
        <Metric label="Comptes" value={snapshot?.users} loading={loading} />
        <Metric label="Professeurs" value={snapshot?.teachers} loading={loading} />
        <Metric
          label="Cours publiés"
          value={snapshot?.coursesPublished}
          total={snapshot?.courses}
          loading={loading}
        />
        <Metric
          label="Documents publiés"
          value={snapshot?.documentsPublished}
          total={snapshot?.documents}
          loading={loading}
        />
        <Metric
          label="Quiz publiés"
          value={snapshot?.quizzesPublished}
          total={snapshot?.quizzes}
          loading={loading}
        />
        <Metric
          label="Séances actives"
          value={snapshot?.livesActive}
          total={snapshot?.lives}
          loading={loading}
        />
        <Metric label="Conversations" value={snapshot?.threads} loading={loading} />
        <Metric label="Messages" value={snapshot?.messages} loading={loading} />
      </section>

      {health ? (
        <section className="card">
          <h2>Notifications</h2>
          <p className="muted">
            La file d'envoi est drainée par une fonction planifiée. Une file qui grossit signale que
            cette fonction ne tourne plus.
          </p>
          <div className="console-metrics console-metrics--inline">
            <Metric label="En attente" value={health.pending} tone={health.pending > 50 ? "warning" : undefined} />
            <Metric label="Échecs" value={health.failed} tone={health.failed > 0 ? "danger" : undefined} />
            <Metric label="Envoyées" value={health.sent} />
          </div>
          <p className="muted">
            Dernier envoi : {relativeTime(health.lastSentMs)}
            {health.oldestPendingMs
              ? ` · plus ancienne en attente depuis ${relativeTime(health.oldestPendingMs)}`
              : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  total,
  loading,
  tone,
}: {
  label: string;
  value?: number | null;
  total?: number | null;
  loading?: boolean;
  tone?: "warning" | "danger";
}) {
  return (
    <div className={tone ? `console-metric tone-${tone}` : "console-metric"} data-reveal="up">
      <span className="console-metric-label">{label}</span>
      {loading ? (
        <span className="skeleton skeleton-metric" />
      ) : (
        <strong className="console-metric-value">
          {value ?? 0}
          {typeof total === "number" ? <small> / {total}</small> : null}
        </strong>
      )}
    </div>
  );
}
