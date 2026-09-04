/**
 * Onglet quizzes de l'espace professeur.
 *
 * Extrait d'un composant de mille sept cents lignes. La liste de
 * proprietes ci-dessous n'est pas courte : elle dit ce que cet onglet
 * partage reellement avec les autres, ce qu'aucune lecture du fichier
 * d'origine ne montrait.
 */

import type { ReactNode, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../lib/supabase";
import { makeEmptyQuizForm } from "../helpers";
import type { ChapterRow, CourseRow, QuizForm, QuizMetrics, QuizRow, QuizScope } from "../types";

type Props = {
  addQuizOption: (...args: any[]) => any;
  addQuizQuestion: (...args: any[]) => any;
  allChapters: ChapterRow[];
  busy: boolean;
  chapterMap: Map<string, ChapterRow>;
  courseMap: Map<string, CourseRow>;
  courses: CourseRow[];
  editQuiz: (...args: any[]) => any;
  filteredQuizzes: QuizRow[];
  handleQuizScopeChange: (...args: any[]) => any;
  handleQuizSubmit: (...args: any[]) => any;
  onDelete: (...args: any[]) => any;
  quizCourseChapters: ChapterRow[];
  quizForm: QuizForm;
  quizMetrics: Record<string, QuizMetrics>;
  quizSearch: string;
  quizzes: QuizRow[];
  removeQuizOption: (...args: any[]) => any;
  removeQuizQuestion: (...args: any[]) => any;
  runAction: (...args: any[]) => any;
  setQuizForm: Dispatch<SetStateAction<QuizForm>>;
  setQuizSearch: Dispatch<SetStateAction<string>>;
  updateQuizQuestion: (...args: any[]) => any;
};

export default function QuizzesPanel({
  addQuizOption,
  addQuizQuestion,
  allChapters,
  busy,
  chapterMap,
  courseMap,
  courses,
  editQuiz,
  filteredQuizzes,
  handleQuizScopeChange,
  handleQuizSubmit,
  onDelete,
  quizCourseChapters,
  quizForm,
  quizMetrics,
  quizSearch,
  quizzes,
  removeQuizOption,
  removeQuizQuestion,
  runAction,
  setQuizForm,
  setQuizSearch,
  updateQuizQuestion,
}: Props): ReactNode {
  return (
    <section className="teacher-layout-grid">
      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>{quizForm.id ? "Modifier le quiz" : "Nouveau quiz"}</h2>
          {quizForm.id ? (<button className="btn ghost" type="button" onClick={() => setQuizForm(makeEmptyQuizForm())} disabled={busy}>Annuler</button>) : null}
        </div>

        <form className="teacher-form-grid" onSubmit={handleQuizSubmit}>
          <label className="teacher-field">Portee
            <select value={quizForm.scope} onChange={(event) => handleQuizScopeChange(event.target.value as QuizScope)}>
              <option value="standalone">Standalone</option>
              <option value="lesson">Quiz de lecon</option>
            </select>
          </label>

          {quizForm.scope === "lesson" ? (
            <>
              <label className="teacher-field">Cours
                <select value={quizForm.courseId} onChange={(event) => {
                  const nextCourseId = event.target.value;
                  const nextChapterId = allChapters.find((chapter) => chapter.course_id === nextCourseId)?.id || "";
                  setQuizForm((previous) => ({ ...previous, courseId: nextCourseId, chapterId: nextChapterId }));
                }}>
                  <option value="">Selectionner un cours</option>
                  {courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}
                </select>
              </label>
              <label className="teacher-field">Chapitre
                <select value={quizForm.chapterId} onChange={(event) => setQuizForm((previous) => ({ ...previous, chapterId: event.target.value }))}>
                  <option value="">Selectionner un chapitre</option>
                  {quizCourseChapters.map((chapter) => (<option key={chapter.id} value={chapter.id}>{chapter.title}</option>))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="teacher-field">Niveau
                <input value={quizForm.level} onChange={(event) => setQuizForm((previous) => ({ ...previous, level: event.target.value }))} />
              </label>
              <label className="teacher-field">Matière
                <input value={quizForm.subject} onChange={(event) => setQuizForm((previous) => ({ ...previous, subject: event.target.value }))} />
              </label>
            </>
          )}

          <label className="teacher-field">Titre du quiz
            <input value={quizForm.title} onChange={(event) => setQuizForm((previous) => ({ ...previous, title: event.target.value }))} />
          </label>
          <label className="teacher-field teacher-field-wide">Description (optionnel)
            <textarea rows={2} value={quizForm.description} onChange={(event) => setQuizForm((previous) => ({ ...previous, description: event.target.value }))} />
          </label>

          <div className="teacher-question-list teacher-field-wide">
            {quizForm.questions.map((question, questionIndex) => (
              <article key={question.localId} className="teacher-question-card">
                <div className="teacher-question-head">
                  <h3>Question {questionIndex + 1}</h3>
                  <button className="btn ghost danger-outline" type="button" onClick={() => removeQuizQuestion(question.localId)} disabled={busy || quizForm.questions.length <= 1}>Supprimer</button>
                </div>

                <label className="teacher-field teacher-field-wide">Intitule
                  <textarea rows={2} value={question.prompt} onChange={(event) => updateQuizQuestion(question.localId, { prompt: event.target.value })} />
                </label>

                <div className="teacher-option-list">
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.localId}-${optionIndex}`} className="teacher-option-row">
                      <label className="teacher-option-correct">
                        <input type="radio" name={`correct-${question.localId}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuizQuestion(question.localId, { correctIndex: optionIndex })} />
                        <span>Bonne</span>
                      </label>
                      <input value={option} onChange={(event) => {
                        const nextOptions = question.options.map((item, idx) => idx === optionIndex ? event.target.value : item);
                        updateQuizQuestion(question.localId, { options: nextOptions });
                      }} placeholder={`Option ${optionIndex + 1}`} />
                      <button className="btn ghost" type="button" onClick={() => removeQuizOption(question.localId, optionIndex)} disabled={busy || question.options.length <= 2}>Retirer</button>
                    </div>
                  ))}
                </div>

                <div className="teacher-inline-actions">
                  <button className="btn ghost" type="button" onClick={() => addQuizOption(question.localId)} disabled={busy}>Ajouter une option</button>
                </div>
              </article>
            ))}
          </div>

          <div className="teacher-inline-actions teacher-field-wide">
            <button className="btn ghost" type="button" onClick={addQuizQuestion} disabled={busy}>Ajouter une question</button>
            <button className="btn primary" type="submit" disabled={busy}>{quizForm.id ? "Mettre a jour le quiz" : "Creer le quiz"}</button>
          </div>
        </form>
      </article>

      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>Mes quiz</h2>
          <input className="teacher-search-input" placeholder="Rechercher un quiz..." value={quizSearch} onChange={(event) => setQuizSearch(event.target.value)} />
        </div>

        {filteredQuizzes.length ? (
          <div className="teacher-list">
            {filteredQuizzes.map((quiz) => {
              const scope: QuizScope = quiz.course_id && quiz.chapter_id ? "lesson" : "standalone";
              const metric = quizMetrics[quiz.id] || { attempts: 0, avgScorePct: 0, bestScorePct: 0 };
              const course = quiz.course_id ? courseMap.get(quiz.course_id) : null;
              const chapter = quiz.chapter_id ? chapterMap.get(quiz.chapter_id) : null;
              const questionsCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

              return (
                <article key={quiz.id} className="teacher-item-card">
                  <div className="teacher-item-title">
                    <h3>{quiz.title}</h3>
                    <p>
                      {scope === "lesson"
                        ? `${course?.title || "Cours"} / ${chapter?.title || "Chapitre"}`
                        : `${quiz.level || "-"} - ${quiz.subject || "-"}`}
                    </p>
                    <div className="teacher-meta-row">
                      <span className="teacher-pill">{quiz.published ? "Publie" : "Brouillon"}</span>
                      <span>{questionsCount} questions</span>
                      <span>{metric.attempts} tentatives</span>
                      <span>Score moyen: {metric.avgScorePct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="teacher-item-actions">
                    <button className="btn ghost" type="button" onClick={() => editQuiz(quiz)} disabled={busy}>Modifier</button>
                    <button className="btn ghost" type="button" onClick={() =>
                      void runAction(async () => {
                        const { error } = quiz.published
                          ? await supabase.rpc("review_content", {
                              p_kind: "quiz",
                              p_content_id: quiz.id,
                              p_decision: "rejected",
                              p_note: "Depublie depuis l'espace professeur.",
                            })
                          : await supabase.rpc("submit_content_for_review", {
                              p_kind: "quiz",
                              p_content_id: quiz.id,
                            });
                        if (error) throw error;
                      }, "Publication du quiz mise a jour.")
                    } disabled={busy}>{quiz.published ? "Depublier" : "Publier"}</button>
                    <button className="btn ghost danger-outline" type="button" onClick={() =>
                      onDelete(`le quiz "${quiz.title}"`, async () => {
                        const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
                        if (error) throw error;
                      }, "Quiz supprime.")
                    } disabled={busy}>Supprimer</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="teacher-empty">Aucun quiz correspondant.</p>
        )}
      </article>
    </section>
  );
}
