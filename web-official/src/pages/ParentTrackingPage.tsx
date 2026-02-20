import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

type ParentPeriod = 7 | 14 | 30 | 60;

type ParentStudent = {
  id: string;
  name: string;
  email: string;
  school: string | null;
  grade: string | null;
};

type ParentTotals = {
  timeSpentMs: number;
  coursesViewed: number;
  lessonsViewed: number;
  documentsOpened: number;
  livesJoined: number;
  quizAttempts: number;
  quizAvgScorePct: number;
  quizBestScorePct: number;
};

type ParentTimelineRow = {
  day: string;
  timeSpentMs: number;
  coursesViewed: number;
  lessonsViewed: number;
  documentsOpened: number;
  livesJoined: number;
  quizAttempts: number;
  quizAvgScorePct: number;
};

type ParentQuizAttempt = {
  quizId: string;
  quizTitle: string;
  scorePct: number;
  createdAtMs: number;
};

type ParentSnapshot = {
  student: ParentStudent;
  periodDays: number;
  generatedAtMs: number;
  totals: ParentTotals;
  timeline: ParentTimelineRow[];
  recentQuizAttempts: ParentQuizAttempt[];
};

const PERIOD_OPTIONS: ParentPeriod[] = [7, 14, 30, 60];

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toPeriod(value: unknown): ParentPeriod {
  const parsed = Math.floor(num(value));
  if (PERIOD_OPTIONS.includes(parsed as ParentPeriod)) return parsed as ParentPeriod;
  return 30;
}

function mapError(error: unknown) {
  const anyError = error as { message?: string; code?: string };
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "");
  const lower = message.toLowerCase();

  if (code === "PGRST202") {
    return "Suivi parental non active en base. Executez la migration SQL puis reessayez.";
  }
  if (lower.includes("student_not_found")) return "Aucun eleve trouve pour cet email.";
  if (lower.includes("missing_email")) return "Veuillez renseigner un email eleve valide.";
  if (lower.includes("invalid input syntax for type bigint") && lower.includes("nan")) {
    return "Periode d'analyse invalide. Reessayez avec 7, 14, 30 ou 60 jours.";
  }
  if (!message) return "Impossible de recuperer les donnees parentales.";
  return message;
}

function fmtDuration(ms: number) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function fmtPct(value: number) {
  return `${Math.round(clampPercent(value))}%`;
}

function fmtDate(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString();
}

function dayLabel(day: string) {
  const parsed = new Date(`${day}T00:00:00`);
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function normalizeSnapshot(raw: unknown): ParentSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const student = (value.student || {}) as Record<string, unknown>;
  const totals = (value.totals || {}) as Record<string, unknown>;
  const timelineRaw = Array.isArray(value.timeline) ? value.timeline : [];
  const attemptsRaw = Array.isArray(value.recentQuizAttempts) ? value.recentQuizAttempts : [];

  const timeline: ParentTimelineRow[] = timelineRaw.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      day: String(row.day || ""),
      timeSpentMs: num(row.timeSpentMs),
      coursesViewed: Math.floor(num(row.coursesViewed)),
      lessonsViewed: Math.floor(num(row.lessonsViewed)),
      documentsOpened: Math.floor(num(row.documentsOpened)),
      livesJoined: Math.floor(num(row.livesJoined)),
      quizAttempts: Math.floor(num(row.quizAttempts)),
      quizAvgScorePct: clampPercent(num(row.quizAvgScorePct)),
    };
  });

  const recentQuizAttempts: ParentQuizAttempt[] = attemptsRaw.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      quizId: String(row.quizId || ""),
      quizTitle: String(row.quizTitle || "Quiz"),
      scorePct: clampPercent(num(row.scorePct)),
      createdAtMs: Math.floor(num(row.createdAtMs)),
    };
  });

  return {
    student: {
      id: String(student.id || ""),
      name: String(student.name || "Eleve"),
      email: String(student.email || ""),
      school: student.school ? String(student.school) : null,
      grade: student.grade ? String(student.grade) : null,
    },
    periodDays: Math.max(1, Math.min(60, Math.floor(num(value.periodDays || 7)))),
    generatedAtMs: Math.floor(num(value.generatedAtMs)),
    totals: {
      timeSpentMs: num(totals.timeSpentMs),
      coursesViewed: Math.floor(num(totals.coursesViewed)),
      lessonsViewed: Math.floor(num(totals.lessonsViewed)),
      documentsOpened: Math.floor(num(totals.documentsOpened)),
      livesJoined: Math.floor(num(totals.livesJoined)),
      quizAttempts: Math.floor(num(totals.quizAttempts)),
      quizAvgScorePct: clampPercent(num(totals.quizAvgScorePct)),
      quizBestScorePct: clampPercent(num(totals.quizBestScorePct)),
    },
    timeline,
    recentQuizAttempts,
  };
}

function linePoints(values: number[], maxValue: number, width: number, height: number) {
  if (!values.length || maxValue <= 0) return "";
  if (values.length === 1) return `0,${height / 2}`;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function ParentLineChart({
  values,
  maxValue,
  colorClass,
}: {
  values: number[];
  maxValue: number;
  colorClass: string;
}) {
  const width = 300;
  const height = 88;
  const points = linePoints(values, maxValue, width, height);
  return (
    <svg className={`parent-line-chart ${colorClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height} x2={width} y2={height} />
      {points ? <polyline points={points} /> : null}
    </svg>
  );
}

function ParentBarChart({
  values,
  maxValue,
}: {
  values: number[];
  maxValue: number;
}) {
  return (
    <div className="parent-bar-chart">
      {values.map((value, index) => {
        const heightPct = maxValue > 0 ? (Math.max(0, value) / maxValue) * 100 : 0;
        return (
          <span key={`${index}-${value}`} className="parent-bar-col">
            <i style={{ height: `${heightPct}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export default function ParentTrackingPage() {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState<ParentPeriod>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ParentSnapshot | null>(null);
  const [isActivityExpanded, setIsActivityExpanded] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const load = useCallback(
    async (silent = false, overrideDays?: ParentPeriod) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setError("Veuillez renseigner un email eleve.");
        return;
      }

      const safeDays = toPeriod(overrideDays ?? days);
      if (!silent) setBusy(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc("parent_student_snapshot", {
          p_student_email: cleanEmail,
          p_days: safeDays,
        });
        if (rpcError) throw rpcError;

        const normalized = normalizeSnapshot(data);
        if (!normalized) throw new Error("snapshot_invalid");
        setSnapshot(normalized);
      } catch (loadError) {
        setError(mapError(loadError));
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [days, email]
  );

  const handlePeriodChange = useCallback(
    async (period: ParentPeriod) => {
      setDays(period);
      if (!email.trim()) return;
      await load(false, period);
    },
    [email, load]
  );

  useEffect(() => {
    if (!snapshot || !email.trim()) return;
    const timerId = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(timerId);
  }, [email, load, snapshot]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await load(false);
  };

  const timeline = snapshot?.timeline || [];

  const timeSeriesMinutes = useMemo(
    () => timeline.map((row) => Math.round(row.timeSpentMs / 60000)),
    [timeline]
  );
  const quizAvgSeries = useMemo(
    () => timeline.map((row) => clampPercent(row.quizAvgScorePct)),
    [timeline]
  );
  const activitySeries = useMemo(
    () =>
      timeline.map(
        (row) =>
          row.coursesViewed + row.lessonsViewed + row.documentsOpened + row.livesJoined + row.quizAttempts
      ),
    [timeline]
  );
  const maxTimeMinutes = useMemo(() => Math.max(1, ...timeSeriesMinutes), [timeSeriesMinutes]);
  const maxActivity = useMemo(() => Math.max(1, ...activitySeries), [activitySeries]);
  const maxLineScore = useMemo(() => Math.max(100, ...quizAvgSeries), [quizAvgSeries]);

  const maxTimeMs = useMemo(() => Math.max(1, ...timeline.map((row) => row.timeSpentMs)), [timeline]);

  const bestDay = useMemo(() => {
    if (!timeline.length) return null;
    return [...timeline].sort((a, b) => b.timeSpentMs - a.timeSpentMs)[0];
  }, [timeline]);

  const avgDailyTimeMs = useMemo(() => {
    if (!timeline.length) return 0;
    return timeline.reduce((sum, row) => sum + row.timeSpentMs, 0) / timeline.length;
  }, [timeline]);

  return (
    <div className="page-wrap container parent-tracking">
      <header className="page-head">
        <span className="kicker">Espace Parents</span>
        <h1>Suivi parental en temps reel</h1>
        <p>
          Renseignez l&apos;email eleve pour consulter temps passe, cours suivis, lives et performances quiz avec une
          trace claire.
        </p>
      </header>

      <form className="parent-form-card" onSubmit={submit}>
        <div className="parent-filter-row">
          <label className="teacher-field">
            Email eleve
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="eleve@ecole.com"
            />
          </label>

          <div className="teacher-field">
            Fenetre d'analyse
            <div className="parent-period-switch" role="group" aria-label="Periode suivi parental">
              {PERIOD_OPTIONS.map((period) => (
                <button
                  key={period}
                  className={days === period ? "parent-period-btn active" : "parent-period-btn"}
                  type="button"
                  disabled={busy}
                  aria-pressed={days === period}
                  onClick={() => void handlePeriodChange(period)}
                >
                  {period}j
                </button>
              ))}
            </div>
          </div>

          <div className="teacher-inline-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Chargement..." : "Analyser"}
            </button>
            {snapshot ? (
              <button className="btn ghost" type="button" onClick={() => void load(false)} disabled={busy}>
                Actualiser
              </button>
            ) : null}
          </div>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
      </form>

      {snapshot ? (
        <>
          <section className="parent-student-card">
            <h2>{snapshot.student.name}</h2>
            <p className="parent-student-meta">
              <span>{snapshot.student.email}</span>
              {snapshot.student.grade ? <span>{snapshot.student.grade}</span> : null}
              {snapshot.student.school ? <span>{snapshot.student.school}</span> : null}
            </p>
            <small>
              Periode: {snapshot.periodDays} jours | Mise a jour: {fmtDate(snapshot.generatedAtMs)}
            </small>
          </section>

          <section className="parent-stats-grid">
            <article className="parent-stat-card">
              <span>Temps total</span>
              <strong>{fmtDuration(snapshot.totals.timeSpentMs)}</strong>
            </article>
            <article className="parent-stat-card">
              <span>Cours regardes</span>
              <strong>{snapshot.totals.coursesViewed}</strong>
            </article>
            <article className="parent-stat-card">
              <span>Lives suivis</span>
              <strong>{snapshot.totals.livesJoined}</strong>
            </article>
            <article className="parent-stat-card">
              <span>Tentatives quiz</span>
              <strong>{snapshot.totals.quizAttempts}</strong>
            </article>
            <article className="parent-stat-card">
              <span>Moyenne quiz</span>
              <strong>{fmtPct(snapshot.totals.quizAvgScorePct)}</strong>
            </article>
            <article className="parent-stat-card">
              <span>Meilleur score</span>
              <strong>{fmtPct(snapshot.totals.quizBestScorePct)}</strong>
            </article>
          </section>

          <section className="parent-charts-grid">
            <article className="parent-panel parent-chart-card">
              <div className="teacher-panel-head">
                <h2>Tendances quotidiennes</h2>
                <small>Temps d'etude vs score quiz</small>
              </div>
              {timeline.length ? (
                <>
                  <div className="parent-line-stack">
                    <ParentLineChart values={timeSeriesMinutes} maxValue={maxTimeMinutes} colorClass="time" />
                    <ParentLineChart values={quizAvgSeries} maxValue={maxLineScore} colorClass="score" />
                  </div>
                  <div className="parent-chart-legend">
                    <span className="time">Temps (minutes)</span>
                    <span className="score">Moyenne quiz (%)</span>
                  </div>
                  <div className="parent-chart-foot">
                    <span>{dayLabel(timeline[0].day)}</span>
                    <span>{dayLabel(timeline[timeline.length - 1].day)}</span>
                  </div>
                </>
              ) : (
                <p className="teacher-empty">Pas encore de donnees sur cette periode.</p>
              )}
            </article>

            <article className="parent-panel parent-chart-card">
              <div className="teacher-panel-head">
                <h2>Volume d'activite</h2>
                <small>Interactions journalieres</small>
              </div>
              {timeline.length ? (
                <>
                  <ParentBarChart values={activitySeries} maxValue={maxActivity} />
                  <div className="parent-chart-foot">
                    <span>{dayLabel(timeline[0].day)}</span>
                    <span>{dayLabel(timeline[timeline.length - 1].day)}</span>
                  </div>
                </>
              ) : (
                <p className="teacher-empty">Pas encore de donnees sur cette periode.</p>
              )}
            </article>
          </section>

          <section className="parent-highlight-grid">
            <article className="parent-highlight-card">
              <span>Meilleur jour</span>
              <strong>{bestDay ? bestDay.day : "-"}</strong>
              <small>{bestDay ? fmtDuration(bestDay.timeSpentMs) : "Aucune activite"}</small>
            </article>
            <article className="parent-highlight-card">
              <span>Temps moyen / jour</span>
              <strong>{fmtDuration(avgDailyTimeMs)}</strong>
              <small>Sur {snapshot.periodDays} jours</small>
            </article>
            <article className="parent-highlight-card">
              <span>Stabilite quiz</span>
              <strong>{fmtPct(snapshot.totals.quizAvgScorePct)}</strong>
              <small>Pic: {fmtPct(snapshot.totals.quizBestScorePct)}</small>
            </article>
          </section>

                    <section className="parent-panel">
            <div className="parent-panel-head">
              <h2>Activite quotidienne</h2>
              <button
                className="parent-toggle-btn"
                type="button"
                onClick={() => setIsActivityExpanded((prev) => !prev)}
                aria-expanded={isActivityExpanded}
              >
                {isActivityExpanded ? "Reduire" : "Afficher"}
              </button>
            </div>
            {isActivityExpanded ? (
              <div className="parent-timeline">
                {timeline.map((row) => (
                  <div key={row.day} className="parent-day-row">
                    <div className="parent-day-meta">
                      <strong>{row.day}</strong>
                      <small>
                        {fmtDuration(row.timeSpentMs)} - {row.coursesViewed} cours - {row.livesJoined} lives -{" "}
                        {row.quizAttempts} quiz
                      </small>
                    </div>
                    <div className="parent-day-bar">
                      <span style={{ width: `${Math.max(4, (row.timeSpentMs / maxTimeMs) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="parent-collapsed-hint">Section reduite. Ouvrez-la pour voir la timeline complete.</p>
            )}
          </section>

          <section className="parent-panel">
            <div className="parent-panel-head">
              <h2>Details journaliers</h2>
              <button
                className="parent-toggle-btn"
                type="button"
                onClick={() => setIsDetailsExpanded((prev) => !prev)}
                aria-expanded={isDetailsExpanded}
              >
                {isDetailsExpanded ? "Reduire" : `Afficher (${timeline.length})`}
              </button>
            </div>
            {isDetailsExpanded ? (
              <div className="parent-table-wrap">
                <table className="parent-table">
                  <thead>
                    <tr>
                      <th>Jour</th>
                      <th>Temps</th>
                      <th>Cours</th>
                      <th>Lecons</th>
                      <th>Docs</th>
                      <th>Lives</th>
                      <th>Quiz</th>
                      <th>Moy quiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td>{fmtDuration(row.timeSpentMs)}</td>
                        <td>{row.coursesViewed}</td>
                        <td>{row.lessonsViewed}</td>
                        <td>{row.documentsOpened}</td>
                        <td>{row.livesJoined}</td>
                        <td>{row.quizAttempts}</td>
                        <td>{fmtPct(row.quizAvgScorePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="parent-collapsed-hint">Section reduite. Ouvrez-la pour voir le tableau detaille.</p>
            )}
          </section>

          <section className="parent-panel">
            <h2>Dernieres tentatives quiz</h2>
            <div className="parent-quiz-list">
              {snapshot.recentQuizAttempts.map((row, index) => (
                <article className="parent-quiz-item" key={`${row.quizId}-${row.createdAtMs}-${index}`}>
                  <h3>{row.quizTitle}</h3>
                  <p>Score: {fmtPct(row.scorePct)}</p>
                  <small>{fmtDate(row.createdAtMs)}</small>
                </article>
              ))}
              {snapshot.recentQuizAttempts.length === 0 ? (
                <p>Aucune tentative quiz sur cette periode.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

