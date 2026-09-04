import { useEffect, useState } from "react";

import { getPortalSettings, updatePortalSettings } from "../../../lib/admin";
import { relativeTime } from "../../../components/admin/DataTable";

/**
 * Reglages.
 *
 * Le portail d'inscription professeur est ouvert ou ferme depuis ici. Ouvert,
 * n'importe qui peut creer un compte enseignant ; c'est pour cela que la
 * publication passe par une relecture, mais le robinet reste utile le jour ou
 * la moderation ne suit plus.
 */
export default function SettingsSection() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAtMs, setUpdatedAtMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const settings = await getPortalSettings();
        if (!alive) return;
        setOpen(settings.open);
        setMessage(settings.message || "");
        setUpdatedAtMs(settings.updatedAtMs);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Réglages indisponibles.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // La confirmation s'efface d'elle-meme : une alerte à fermer pour un succès
  // attendu ne fait que rajouter un geste.
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(0), 2600);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updatePortalSettings(open, message);
      setUpdatedAtMs(Date.now());
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card" aria-busy="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line short" />
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

      <section className="card stack">
        <div>
          <h2>Portail d'inscription professeur</h2>
          <p className="muted">
            Fermé, la page d'inscription affiche votre message et n'accepte plus de candidature. Les
            comptes existants ne sont pas touchés.
          </p>
        </div>

        <label className="console-switch">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => setOpen(event.target.checked)}
          />
          <span>{open ? "Ouvert aux nouvelles candidatures" : "Fermé"}</span>
        </label>

        <div className="field">
          <label htmlFor="portal-message">Message affiché quand le portail est fermé</label>
          <span className="field-hint">
            Une phrase qui dit quand rouvrir évite une vague de messages au support.
          </span>
          <textarea
            id="portal-message"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Les inscriptions rouvrent à la rentrée de septembre."
          />
        </div>

        <div className="row">
          <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {savedAt ? <span className="badge success">Enregistré</span> : null}
          {updatedAtMs ? (
            <span className="muted">Dernière modification {relativeTime(updatedAtMs)}</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
