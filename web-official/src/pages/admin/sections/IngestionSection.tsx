import { useCallback, useEffect, useState } from "react";

import {
  getIngestionHealth,
  getIngestionSettings,
  listIngestions,
  retryIngestion,
  updateIngestionSettings,
  type IngestionHealth,
  type IngestionJob,
  type IngestionSettings,
} from "../../../lib/admin";
import DataTable, { relativeTime, type Column } from "../../../components/admin/DataTable";

type Filter = "all" | IngestionJob["state"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "failed", label: "Échecs" },
  { key: "queued", label: "En attente" },
  { key: "running", label: "En cours" },
  { key: "done", label: "Terminés" },
  { key: "all", label: "Tout" },
];

const STATE_TONE: Record<IngestionJob["state"], string> = {
  failed: "badge danger",
  queued: "badge warning",
  running: "badge primary",
  done: "badge success",
};

const STATE_LABEL: Record<IngestionJob["state"], string> = {
  failed: "Échec",
  queued: "En attente",
  running: "En cours",
  done: "Terminé",
};

/**
 * Chaîne de traitement des documents.
 *
 * Le journal était fermé à tout client parce qu'il porte l'adresse du PDF
 * d'origine. La conséquence n'avait pas été tirée : une extraction pouvait
 * échouer sans que personne l'apprenne, et rien ne permettait de la relancer.
 *
 * Les échecs ouvrent la liste — ce sont eux qui demandent une décision. La
 * file en attente vient ensuite : un travail qui y dort depuis des heures
 * signale que la fonction planifiée ne tourne plus, la panne la plus courante
 * et la plus silencieuse de cette chaîne.
 */
export default function IngestionSection() {
  const [health, setHealth] = useState<IngestionHealth | null>(null);
  const [rows, setRows] = useState<IngestionJob[]>([]);
  const [filter, setFilter] = useState<Filter>("failed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [settings, setSettings] = useState<IngestionSettings | null>(null);
  const [draft, setDraft] = useState<IngestionSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  const load = useCallback(async (which: Filter) => {
    setError(null);
    try {
      const [state, jobs] = await Promise.all([
        getIngestionHealth(),
        listIngestions(which === "all" ? undefined : which),
      ]);
      setHealth(state);
      setRows(jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  useEffect(() => {
    let alive = true;
    void getIngestionSettings()
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setDraft(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), 2600);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const relaunch = async (job: IngestionJob) => {
    if (busyId) return;
    setBusyId(job.id);
    setError(null);
    try {
      await retryIngestion(job.book_id);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Relance impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const saveSettings = async () => {
    if (!draft || savingSettings) return;
    setSavingSettings(true);
    setError(null);
    try {
      const next = await updateIngestionSettings(draft);
      setSettings(next);
      setDraft(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSavingSettings(false);
    }
  };

  const columns: Column<IngestionJob>[] = [
    {
      key: "document",
      header: "Document",
      render: (row) => (
        <div className="cell-identity">
          <strong>{row.book_title || "Document supprimé"}</strong>
          <small>{row.requester_name || "—"}</small>
        </div>
      ),
    },
    {
      key: "state",
      header: "État",
      render: (row) => (
        <div className="cell-rights">
          <span className={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</span>
          {row.attempts > 1 ? <span className="badge">{row.attempts} essais</span> : null}
        </div>
      ),
    },
    {
      key: "result",
      header: "Résultat",
      secondary: true,
      render: (row) =>
        row.state === "failed" ? (
          <span className="cell-error">{row.error || "Échec sans motif"}</span>
        ) : row.state === "done" ? (
          <span className="muted">
            {row.block_count ?? 0} blocs
            {row.figure_count ? ` · ${row.figure_count} figures à compléter` : ""}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: "when",
      header: "Déposé",
      align: "end",
      render: (row) => relativeTime(row.created_at_ms),
    },
    {
      key: "action",
      header: "",
      align: "end",
      render: (row) =>
        row.state === "failed" ? (
          <button
            type="button"
            className="btn ghost small"
            disabled={busyId === row.id}
            onClick={() => void relaunch(row)}
          >
            {busyId === row.id ? "Relance…" : "Relancer"}
          </button>
        ) : null,
    },
  ];

  const stalled =
    health?.oldestQueuedMs != null && Date.now() - health.oldestQueuedMs > 30 * 60 * 1000;

  return (
    <div className="stack stack--loose">
      {error ? (
        <div className="notice danger">
          <p>{error}</p>
        </div>
      ) : null}

      {stalled ? (
        <div className="notice warning">
          <p>
            <strong>La file ne se vide plus.</strong> Le plus ancien travail attend depuis{" "}
            {relativeTime(health?.oldestQueuedMs)}. La fonction planifiée qui draine la file ne
            tourne probablement plus : vérifiez le planificateur et le secret d'appel.
          </p>
        </div>
      ) : null}

      <section className="console-metrics" aria-label="État de la file">
        <Metric label="Échecs" value={health?.failed} tone={health?.failed ? "danger" : undefined} />
        <Metric label="En attente" value={health?.queued} tone={stalled ? "warning" : undefined} />
        <Metric label="En cours" value={health?.running} />
        <Metric label="Terminés" value={health?.done} />
        <Metric
          label="Jetons consommés"
          value={
            health ? Math.round((health.inputTokens + health.outputTokens) / 1000) : undefined
          }
          suffix="k"
        />
      </section>

      <section className="stack">
        <div className="console-filters" role="group" aria-label="Filtrer par état">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === filter ? "chip-btn active" : "chip-btn"}
              aria-pressed={item.key === filter}
              onClick={() => {
                setFilter(item.key);
                setLoading(true);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          emptyTitle={filter === "failed" ? "Aucun échec" : "Rien à afficher"}
          emptyMessage={
            filter === "failed"
              ? "Toutes les extractions déposées sont passées."
              : "Aucun traitement ne correspond à ce filtre."
          }
        />
      </section>

      {draft ? (
        <section className="card stack">
          <div>
            <h2>Bornes de dépense</h2>
            <p className="muted">
              Chaque traitement coûte un appel facturé. Ces limites empêchent qu'un dépôt massif
              vide le budget avant que quiconque s'en aperçoive.
            </p>
          </div>

          <div className="console-settings-grid">
            <label className="field">
              <span className="field-label">Documents par jour et par compte</span>
              <input
                type="number"
                min={0}
                value={draft.dailyLimit}
                onChange={(e) =>
                  setDraft({ ...draft, dailyLimit: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Pour un relecteur ou un administrateur</span>
              <input
                type="number"
                min={0}
                value={draft.reviewerDailyLimit}
                onChange={(e) =>
                  setDraft({ ...draft, reviewerDailyLimit: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Pages traitées au maximum</span>
              <input
                type="number"
                min={1}
                value={draft.maxPages}
                onChange={(e) => setDraft({ ...draft, maxPages: Number(e.target.value) || 1 })}
              />
            </label>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn primary"
              disabled={savingSettings || JSON.stringify(draft) === JSON.stringify(settings)}
              onClick={() => void saveSettings()}
            >
              {savingSettings ? "Enregistrement…" : "Enregistrer les limites"}
            </button>
            {savedAt ? <span className="badge success">Enregistré</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "",
  tone,
}: {
  label: string;
  value?: number | null;
  suffix?: string;
  tone?: "warning" | "danger";
}) {
  return (
    <div className={tone ? `console-metric tone-${tone}` : "console-metric"}>
      <span className="console-metric-label">{label}</span>
      {value == null ? (
        <span className="skeleton skeleton-metric" />
      ) : (
        <strong className="console-metric-value">
          {value}
          {suffix}
        </strong>
      )}
    </div>
  );
}
