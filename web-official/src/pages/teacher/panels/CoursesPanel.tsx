/**
 * Onglet courses de l'espace professeur.
 *
 * Extrait d'un composant de mille sept cents lignes. La liste de
 * proprietes ci-dessous n'est pas courte : elle dit ce que cet onglet
 * partage reellement avec les autres, ce qu'aucune lecture du fichier
 * d'origine ne montrait.
 */

import type { ReactNode, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../lib/supabase";
import { toDateLabel } from "../helpers";
import { EMPTY_CHAPTER_FORM, EMPTY_COURSE_FORM } from "../constants";
import { LOCAL_LANGUAGES, isDirectMediaUrl } from "../../../lib/referentials";
import type { GradeLevel, Subject } from "../../../lib/referentials";
import type { ChapterForm, ChapterRow, CourseForm, CourseRow, TabKey } from "../types";

type Props = {
  busy: boolean;
  chapterForm: ChapterForm;
  chapterRows: ChapterRow[];
  courseForm: CourseForm;
  courseSearch: string;
  courses: CourseRow[];
  editChapter: (...args: any[]) => any;
  editCourse: (...args: any[]) => any;
  filteredCourses: CourseRow[];
  gradeLevels: GradeLevel[];
  handleChapterSubmit: (...args: any[]) => any;
  handleCourseSubmit: (...args: any[]) => any;
  onDelete: (...args: any[]) => any;
  runAction: (...args: any[]) => any;
  selectedCourseId: string;
  setChapterForm: Dispatch<SetStateAction<ChapterForm>>;
  setCourseForm: Dispatch<SetStateAction<CourseForm>>;
  setCourseSearch: Dispatch<SetStateAction<string>>;
  setSelectedCourseId: Dispatch<SetStateAction<string>>;
  setTab: Dispatch<SetStateAction<TabKey>>;
  subjects: Subject[];
};

export default function CoursesPanel({
  busy,
  chapterForm,
  chapterRows,
  courseForm,
  courseSearch,
  courses,
  editChapter,
  editCourse,
  filteredCourses,
  gradeLevels,
  handleChapterSubmit,
  handleCourseSubmit,
  onDelete,
  runAction,
  selectedCourseId,
  setChapterForm,
  setCourseForm,
  setCourseSearch,
  setSelectedCourseId,
  setTab,
  subjects,
}: Props): ReactNode {
  return (
    <>
      <section className="teacher-layout-grid">
        <article className="teacher-panel">
          <div className="teacher-panel-head">
            <h2>{courseForm.id ? "Modifier le cours" : "Nouveau cours"}</h2>
            {courseForm.id ? (
              <button className="btn ghost" type="button" onClick={() => setCourseForm(EMPTY_COURSE_FORM)} disabled={busy}>Annuler</button>
            ) : null}
          </div>

          <form className="teacher-form-grid" onSubmit={handleCourseSubmit}>
            <label className="teacher-field">Titre
              <input value={courseForm.title} onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="teacher-field">Classe
              <select
                value={courseForm.gradeLevelId}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, gradeLevelId: event.target.value }))}
              >
                <option value="">Choisir une classe</option>
                {gradeLevels.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="teacher-field">Matière
              <select
                value={courseForm.subjectId}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, subjectId: event.target.value }))}
              >
                <option value="">Choisir une matière</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="teacher-field teacher-field-wide">Description
              <textarea rows={3} value={courseForm.description} onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            <label className="teacher-field teacher-field-wide">URL image de couverture (optionnel)
              <input value={courseForm.coverUrl} onChange={(event) => setCourseForm((prev) => ({ ...prev, coverUrl: event.target.value }))} placeholder="https://..." />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{courseForm.id ? "Mettre a jour" : "Ajouter le cours"}</button>
          </form>
        </article>

        <article className="teacher-panel">
          <div className="teacher-panel-head">
            <h2>Mes cours</h2>
            <input className="teacher-search-input" placeholder="Rechercher un cours..." value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} />
          </div>

          {filteredCourses.length ? (
            <div className="teacher-list">
              {filteredCourses.map((course) => (
                <article key={course.id} className="teacher-item-card">
                  <div className="teacher-item-title">
                    <h3>{course.title}</h3>
                    <p>{course.level} - {course.subject}</p>
                    <div className="teacher-meta-row">
                      <span className="teacher-pill">{course.published ? "Publie" : "Brouillon"}</span>
                      <span>Mise a jour: {toDateLabel(course.updated_at_ms)}</span>
                    </div>
                  </div>
                  <div className="teacher-item-actions">
                    <button className="btn ghost" type="button" onClick={() => editCourse(course)} disabled={busy}>Modifier</button>
                    <button className="btn ghost" type="button" onClick={() =>
                      void runAction(async () => {
                        const { error } = course.published
                          ? await supabase.rpc("review_content", {
                              p_kind: "course",
                              p_content_id: course.id,
                              p_decision: "rejected",
                              p_note: "Depublie depuis l'espace professeur.",
                            })
                          : await supabase.rpc("submit_content_for_review", {
                              p_kind: "course",
                              p_content_id: course.id,
                            });
                        if (error) throw error;
                      }, "Publication du cours mise a jour.")
                    } disabled={busy}>{course.published ? "Depublier" : "Publier"}</button>
                    <button className="btn ghost" type="button" onClick={() => { setSelectedCourseId(course.id); setTab("courses"); }} disabled={busy}>Chapitres</button>
                    <button className="btn ghost danger-outline" type="button" onClick={() =>
                      onDelete(`le cours "${course.title}"`, async () => {
                        const { error } = await supabase.from("courses").delete().eq("id", course.id);
                        if (error) throw error;
                      }, "Cours supprime.")
                    } disabled={busy}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="teacher-empty">Aucun cours correspondant.</p>
          )}
        </article>
      </section>

      <section className="teacher-panel">
        <div className="teacher-panel-head">
          <h3>Gestion des chapitres</h3>
          <select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); setChapterForm(EMPTY_CHAPTER_FORM); }}>
            <option value="">Selectionner un cours</option>
            {courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}
          </select>
        </div>

        <form className="teacher-form-grid" onSubmit={handleChapterSubmit}>
          <label className="teacher-field">Titre du chapitre
            <input value={chapterForm.title} onChange={(event) => setChapterForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="teacher-field">Ordre
            <input type="number" min="1" value={chapterForm.order} onChange={(event) => setChapterForm((prev) => ({ ...prev, order: event.target.value }))} />
          </label>
          <label className="teacher-field">Video en français
            <input
              value={chapterForm.videoUrl}
              onChange={(event) => setChapterForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
              placeholder="https://... (.mp4, .m3u8, .mpd)"
            />
            {chapterForm.videoUrl.trim() &&
            /^https?:\/\//i.test(chapterForm.videoUrl.trim()) &&
            !isDirectMediaUrl(chapterForm.videoUrl.trim()) ? (
              <small className="teacher-field-warning">
                Ce lien ne ressemble pas a un flux direct : il s'ouvrira hors de l'application
                au lieu d'être lu dans le lecteur.
              </small>
            ) : null}
          </label>

          {/* La lecon en langue locale est la raison d'etre d'iSkul : le web
              ne pouvait pas la renseigner, l'application si. */}
          <fieldset className="teacher-field teacher-field-wide teacher-langs">
            <legend>Versions en langue locale (optionnel)</legend>
            {LOCAL_LANGUAGES.map((lang) => (
              <label key={lang.key} className="teacher-lang-row">
                <span>{lang.label}</span>
                <input
                  value={chapterForm.videoByLang[lang.key] || ""}
                  onChange={(event) =>
                    setChapterForm((prev) => ({
                      ...prev,
                      videoByLang: { ...prev.videoByLang, [lang.key]: event.target.value },
                    }))
                  }
                  placeholder="https://..."
                />
              </label>
            ))}
          </fieldset>
          <div className="teacher-inline-actions">
            {chapterForm.id ? (<button className="btn ghost" type="button" onClick={() => setChapterForm(EMPTY_CHAPTER_FORM)} disabled={busy}>Annuler</button>) : null}
            <button className="btn primary" type="submit" disabled={busy}>{chapterForm.id ? "Mettre a jour chapitre" : "Ajouter chapitre"}</button>
          </div>
        </form>

        {selectedCourseId ? (
          chapterRows.length ? (
            <div className="teacher-list">
              {chapterRows.map((chapter) => (
                <article key={chapter.id} className="teacher-item-card">
                  <div className="teacher-item-title">
                    <h3>{chapter.title}</h3>
                    <p>Ordre: {chapter.order_index}</p>
                    <div className="teacher-meta-row">
                      <span>Maj: {toDateLabel(chapter.updated_at_ms)}</span>
                      {chapter.video_url ? (
                        <a className="teacher-link" href={chapter.video_url} target="_blank" rel="noreferrer">Ouvrir la video</a>
                      ) : (
                        <span className="muted">Aucune video</span>
                      )}
                    </div>
                  </div>
                  <div className="teacher-item-actions">
                    <button className="btn ghost" type="button" onClick={() => editChapter(chapter)} disabled={busy}>Modifier</button>
                    <button className="btn ghost danger-outline" type="button" onClick={() =>
                      onDelete(`le chapitre "${chapter.title}"`, async () => {
                        const { error } = await supabase.from("chapters").delete().eq("id", chapter.id);
                        if (error) throw error;
                      }, "Chapitre supprime.")
                    } disabled={busy}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="teacher-empty">Aucun chapitre pour ce cours.</p>
          )
        ) : (
          <p className="teacher-empty">Selectionnez un cours pour gerer ses chapitres.</p>
        )}
      </section>
    </>
  );
}
