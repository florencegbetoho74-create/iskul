/**
 * Onglet lives de l'espace professeur.
 *
 * Extrait d'un composant de mille sept cents lignes. La liste de
 * proprietes ci-dessous n'est pas courte : elle dit ce que cet onglet
 * partage reellement avec les autres, ce qu'aucune lecture du fichier
 * d'origine ne montrait.
 */

import type { ReactNode, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../lib/supabase";
import { toDateLabel } from "../helpers";
import { EMPTY_LIVE_FORM } from "../constants";
import type { LiveForm, LiveRow, LiveStatus } from "../types";

type Props = {
  busy: boolean;
  editLive: (...args: any[]) => any;
  filteredLives: LiveRow[];
  handleLiveSubmit: (...args: any[]) => any;
  liveForm: LiveForm;
  liveSearch: string;
  lives: LiveRow[];
  onDelete: (...args: any[]) => any;
  runAction: (...args: any[]) => any;
  setLiveForm: Dispatch<SetStateAction<LiveForm>>;
  setLiveSearch: Dispatch<SetStateAction<string>>;
};

export default function LivesPanel({
  busy,
  editLive,
  filteredLives,
  handleLiveSubmit,
  liveForm,
  liveSearch,
  lives,
  onDelete,
  runAction,
  setLiveForm,
  setLiveSearch,
}: Props): ReactNode {
  return (
    <section className="teacher-layout-grid">
      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>{liveForm.id ? "Modifier le live" : "Programmer un live"}</h2>
          {liveForm.id ? (<button className="btn ghost" type="button" onClick={() => setLiveForm(EMPTY_LIVE_FORM)} disabled={busy}>Annuler</button>) : null}
        </div>

        <form className="teacher-form-grid" onSubmit={handleLiveSubmit}>
          <label className="teacher-field">Titre
            <input value={liveForm.title} onChange={(event) => setLiveForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="teacher-field">Date / heure
            <input type="datetime-local" value={liveForm.startAt} onChange={(event) => setLiveForm((prev) => ({ ...prev, startAt: event.target.value }))} />
          </label>
          <label className="teacher-field">Statut
            <select value={liveForm.status} onChange={(event) => setLiveForm((prev) => ({ ...prev, status: event.target.value as LiveStatus }))}>
              <option value="scheduled">Programmee</option>
              <option value="live">En direct</option>
              <option value="ended">Terminee</option>
            </select>
          </label>
          <label className="teacher-field teacher-field-wide">Description (optionnel)
            <textarea rows={3} value={liveForm.description} onChange={(event) => setLiveForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <label className="teacher-field teacher-field-wide">URL streaming (optionnel)
            <input value={liveForm.streamingUrl} onChange={(event) => setLiveForm((prev) => ({ ...prev, streamingUrl: event.target.value }))} placeholder="https://..." />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{liveForm.id ? "Mettre a jour" : "Planifier le live"}</button>
        </form>
      </article>

      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>Mes lives</h2>
          <input className="teacher-search-input" placeholder="Rechercher un live..." value={liveSearch} onChange={(event) => setLiveSearch(event.target.value)} />
        </div>

        {filteredLives.length ? (
          <div className="teacher-list">
            {filteredLives.map((live) => (
              <article key={live.id} className="teacher-item-card">
                <div className="teacher-item-title">
                  <h3>{live.title}</h3>
                  <p>{toDateLabel(live.start_at_ms)}</p>
                  <div className="teacher-meta-row">
                    <span className="teacher-pill">{live.status}</span>
                    {live.streaming_url ? (
                      <a className="teacher-link" href={live.streaming_url} target="_blank" rel="noreferrer">Ouvrir le stream</a>
                    ) : (
                      <span className="muted">Pas de lien de streaming</span>
                    )}
                  </div>
                </div>
                <div className="teacher-item-actions">
                  <button className="btn ghost" type="button" onClick={() => editLive(live)} disabled={busy}>Modifier</button>
                  <button className="btn ghost" type="button" onClick={() => {
                    const nextStatus: LiveStatus = live.status === "scheduled" ? "live" : live.status === "live" ? "ended" : "scheduled";
                    void runAction(async () => {
                      const { error } = await supabase.from("lives").update({ status: nextStatus, updated_at_ms: Date.now() }).eq("id", live.id);
                      if (error) throw error;
                    }, "Statut du live mis a jour.");
                  }} disabled={busy}>Changer statut</button>
                  <button className="btn ghost danger-outline" type="button" onClick={() =>
                    onDelete(`le live "${live.title}"`, async () => {
                      const { error } = await supabase.from("lives").delete().eq("id", live.id);
                      if (error) throw error;
                    }, "Live supprime.")
                  } disabled={busy}>Supprimer</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="teacher-empty">Aucun live correspondant.</p>
        )}
      </article>
    </section>
  );
}
