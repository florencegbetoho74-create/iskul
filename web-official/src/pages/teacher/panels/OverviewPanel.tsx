/**
 * Onglet overview de l'espace professeur.
 *
 * Extrait d'un composant de mille sept cents lignes. La liste de
 * proprietes ci-dessous n'est pas courte : elle dit ce que cet onglet
 * partage reellement avec les autres, ce qu'aucune lecture du fichier
 * d'origine ne montrait.
 */

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { dayLabel } from "../helpers";
import { BarChart, LineChart } from "../../../components/teacher/Charts";
import type { BookRow, ChapterInsight, CourseInsight, CourseRow, DailyInsight, LiveRow, OverviewMetrics, PeriodDays, QuizRow, TabKey, WeakQuestionInsight } from "../types";

type Props = {
  activeLives: number;
  analyticsDays: PeriodDays;
  books: BookRow[];
  busy: boolean;
  chapterInsights: ChapterInsight[];
  chartMaxAttempts: number;
  chartMaxPct: number;
  completionSeries: number[];
  courseInsights: CourseInsight[];
  courses: CourseRow[];
  dailyInsights: DailyInsight[];
  lives: LiveRow[];
  overview: OverviewMetrics;
  publishedBooks: number;
  publishedCourses: number;
  publishedQuizzes: number;
  quizAttemptsSeries: number[];
  quizScoreSeries: number[];
  quizzes: QuizRow[];
  setAnalyticsDays: Dispatch<SetStateAction<PeriodDays>>;
  setTab: Dispatch<SetStateAction<TabKey>>;
  weakQuestions: WeakQuestionInsight[];
};

export default function OverviewPanel({
  activeLives,
  analyticsDays,
  books,
  busy,
  chapterInsights,
  chartMaxAttempts,
  chartMaxPct,
  completionSeries,
  courseInsights,
  courses,
  dailyInsights,
  lives,
  overview,
  publishedBooks,
  publishedCourses,
  publishedQuizzes,
  quizAttemptsSeries,
  quizScoreSeries,
  quizzes,
  setAnalyticsDays,
  setTab,
  weakQuestions,
}: Props): ReactNode {
  return (
    <>
      <section className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>Synthese sur {analyticsDays} jours</h2>
          <div className="teacher-period-switch" role="group" aria-label="Periode d'analyse">
            {([7, 30, 90] as PeriodDays[]).map((days) => (
              <button
                key={days}
                type="button"
                className={analyticsDays === days ? "teacher-period-btn active" : "teacher-period-btn"}
                onClick={() => setAnalyticsDays(days)}
                disabled={busy}
              >
                {days}j
              </button>
            ))}
          </div>
        </div>
        <div className="teacher-kpi-grid">
          <article className="teacher-kpi-card">
            <span>Cours</span>
            <strong>{courses.length}</strong>
            <small>{publishedCourses} publies</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Documents</span>
            <strong>{books.length}</strong>
            <small>{publishedBooks} publies</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Lives</span>
            <strong>{lives.length}</strong>
            <small>{activeLives} actifs/programmes</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Quiz</span>
            <strong>{quizzes.length}</strong>
            <small>{publishedQuizzes} publies</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Élèves engages</span>
            <strong>{overview.learners}</strong>
            <small>Sur vos contenus</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Completion moyenne</span>
            <strong>{overview.completionRatePct.toFixed(1)}%</strong>
            <small>{overview.atRiskLearners} eleves a risque</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Tentatives quiz</span>
            <strong>{overview.quizAttempts}</strong>
            <small>Historique cumule</small>
          </article>
          <article className="teacher-kpi-card">
            <span>Score quiz moyen</span>
            <strong>{overview.quizAvgScorePct.toFixed(1)}%</strong>
            <small>Base sur max_score</small>
          </article>
        </div>
      </section>

      <section className="teacher-panel teacher-overview-grid">
        <article className="teacher-mini-card">
          <h3>Actions rapides</h3>
          <div className="teacher-inline-actions">
            <button className="btn ghost" type="button" onClick={() => setTab("courses")}>Ajouter un cours</button>
            <button className="btn ghost" type="button" onClick={() => setTab("quizzes")}>Créer un quiz</button>
            <button className="btn ghost" type="button" onClick={() => setTab("lives")}>Programmer un live</button>
          </div>
        </article>
        <article className="teacher-mini-card">
          <h3>Qualite de suivi</h3>
          <p>Cible recommandee: completion &gt; 65% et score quiz moyen &gt; 60%.</p>
        </article>
        <article className="teacher-mini-card">
          <h3>Prochaines etapes</h3>
          <p>Publiez vos contenus finalises puis suivez les performances pour renforcer les chapitres faibles.</p>
        </article>
      </section>

      <section className="teacher-charts-grid">
        <article className="teacher-panel teacher-chart-card">
          <div className="teacher-panel-head">
            <h3>Evolution quotidienne</h3>
            <small>Completion vs score quiz moyen</small>
          </div>
          {dailyInsights.length ? (
            <>
              <div className="teacher-line-stack">
                <LineChart values={completionSeries} maxValue={chartMaxPct} colorClass="completion" />
                <LineChart values={quizScoreSeries} maxValue={chartMaxPct} colorClass="score" />
              </div>
              <div className="teacher-chart-legend">
                <span className="completion">Completion</span>
                <span className="score">Score quiz moyen</span>
              </div>
              <div className="teacher-chart-foot">
                <span>{dayLabel(dailyInsights[0].day)}</span>
                <span>{dayLabel(dailyInsights[dailyInsights.length - 1].day)}</span>
              </div>
            </>
          ) : (
            <p className="teacher-empty">Pas encore de données quotidiennes.</p>
          )}
        </article>

        <article className="teacher-panel teacher-chart-card">
          <div className="teacher-panel-head">
            <h3>Tentatives quiz par jour</h3>
            <small>Activité sur la période</small>
          </div>
          {dailyInsights.length ? (
            <>
              <BarChart values={quizAttemptsSeries} maxValue={chartMaxAttempts} />
              <div className="teacher-chart-foot">
                <span>{dayLabel(dailyInsights[0].day)}</span>
                <span>{dayLabel(dailyInsights[dailyInsights.length - 1].day)}</span>
              </div>
            </>
          ) : (
            <p className="teacher-empty">Pas encore de données de tentatives.</p>
          )}
        </article>
      </section>

      <section className="teacher-analytics-grid">
        <article className="teacher-panel teacher-insight-card">
          <div className="teacher-panel-head">
            <h3>Performance par cours</h3>
            <small>{courseInsights.length} cours analyses</small>
          </div>
          {courseInsights.length ? (
            <div className="teacher-insight-list">
              {courseInsights.slice(0, 8).map((insight) => (
                <article key={insight.courseId} className="teacher-insight-row">
                  <div className="teacher-insight-head">
                    <strong>{insight.title}</strong>
                    <span>{insight.completionRatePct.toFixed(1)}% completion</span>
                  </div>
                  <div className="teacher-insight-meta">
                    <span>{insight.learners} eleves</span>
                    <span>{insight.quizAttempts} tentatives quiz</span>
                    <span>Score moyen {insight.quizAvgScorePct.toFixed(1)}%</span>
                  </div>
                  <div className="teacher-insight-bar">
                    <span style={{ width: `${Math.max(0, Math.min(insight.completionRatePct, 100))}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="teacher-empty">Pas encore assez de données pour cette section.</p>
          )}
        </article>

        <article className="teacher-panel teacher-insight-card">
          <div className="teacher-panel-head">
            <h3>Performance par chapitre</h3>
            <small>Top 10 chapitres</small>
          </div>
          {chapterInsights.length ? (
            <div className="teacher-insight-list">
              {chapterInsights.map((insight) => (
                <article key={insight.chapterId} className="teacher-insight-row">
                  <div className="teacher-insight-head">
                    <strong>{insight.title}</strong>
                    <span>{insight.completionRatePct.toFixed(1)}%</span>
                  </div>
                  <p className="teacher-insight-sub">{insight.courseTitle}</p>
                  <div className="teacher-insight-meta">
                    <span>{insight.learners} eleves</span>
                    <span>{insight.quizAttempts} tentatives</span>
                    <span>Score {insight.quizAvgScorePct.toFixed(1)}%</span>
                  </div>
                  <div className="teacher-insight-bar">
                    <span style={{ width: `${Math.max(0, Math.min(insight.completionRatePct, 100))}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="teacher-empty">Pas encore assez de données pour cette section.</p>
          )}
        </article>

        <article className="teacher-panel teacher-insight-card">
          <div className="teacher-panel-head">
            <h3>Questions a renforcer</h3>
            <small>Faible taux de réussite</small>
          </div>
          {weakQuestions.length ? (
            <div className="teacher-insight-list">
              {weakQuestions.map((insight) => (
                <article key={insight.key} className="teacher-insight-row">
                  <div className="teacher-insight-head">
                    <strong>{insight.quizTitle}</strong>
                    <span>{insight.accuracyPct.toFixed(1)}% justes</span>
                  </div>
                  <p className="teacher-insight-sub">
                    {insight.courseTitle} {insight.chapterTitle ? `- ${insight.chapterTitle}` : ""}
                  </p>
                  <p className="teacher-insight-question" title={insight.prompt}>
                    {insight.prompt}
                  </p>
                  <div className="teacher-insight-meta">
                    <span>{insight.attempts} tentatives</span>
                  </div>
                  <div className="teacher-insight-bar weak">
                    <span style={{ width: `${Math.max(0, Math.min(insight.accuracyPct, 100))}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="teacher-empty">Aucune question faible detectee pour le moment.</p>
          )}
        </article>
      </section>
    </>
  );
}
