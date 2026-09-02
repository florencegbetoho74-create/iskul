import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_TEACHER_DASHBOARD,
  parseTeacherDashboard,
} from "../src/lib/teacherAnalytics.ts";

describe("parseTeacherDashboard", () => {
  it("lit un instantane complet", () => {
    const snap = parseTeacherDashboard({
      periodDays: 7,
      totals: {
        learners: 12,
        completionRate: 0.42,
        lessonsCompleted: 30,
        quizAttempts: 55,
        quizAttemptsRecent: 9,
        atRiskCount: 3,
        courses: 4,
        coursesPublished: 2,
        chapters: 18,
        quizzes: 6,
      },
    });
    assert.equal(snap.learnerCount, 12);
    assert.equal(snap.completionRate, 0.42);
    assert.equal(snap.coursesPublished, 2);
    assert.equal(snap.periodDays, 7);
  });

  it("renvoie l'instantane vide sur une entree invalide", () => {
    assert.deepEqual(parseTeacherDashboard(null), EMPTY_TEACHER_DASHBOARD);
    assert.deepEqual(parseTeacherDashboard("{}"), EMPTY_TEACHER_DASHBOARD);
    assert.deepEqual(parseTeacherDashboard(42), EMPTY_TEACHER_DASHBOARD);
  });

  it("tolere un payload sans agregats", () => {
    const snap = parseTeacherDashboard({});
    assert.equal(snap.learnerCount, 0);
    assert.equal(snap.periodDays, 30);
    assert.deepEqual(snap.courses, []);
    assert.deepEqual(snap.daily, []);
  });

  // Un professeur sans aucune tentative recoit des null : sans repli, le
  // tableau de bord afficherait NaN.
  it("remplace les valeurs nulles par zero", () => {
    const snap = parseTeacherDashboard({
      totals: { learners: null, completionRate: null, quizAttempts: undefined },
      quizzes: [{ quizId: "q1", title: "Test", attempts: null, avgScorePct: null }],
    });
    assert.equal(snap.learnerCount, 0);
    assert.equal(snap.completionRate, 0);
    assert.equal(snap.quizAttempts, 0);
    assert.equal(snap.quizzes[0].attempts, 0);
    assert.equal(snap.quizzes[0].avgScorePct, 0);
  });

  it("borne les taux entre 0 et 1", () => {
    const snap = parseTeacherDashboard({
      totals: { completionRate: 1.4 },
      atRiskLearners: [{ userId: "u1", completionRate: -0.2 }],
      weakQuestions: [{ quizId: "q1", questionIndex: 0, successRate: 7 }],
    });
    assert.equal(snap.completionRate, 1);
    assert.equal(snap.atRiskLearners[0].completionRate, 0);
    assert.equal(snap.weakQuestions[0].accuracy, 1);
  });

  it("construit une cle stable pour chaque question faible", () => {
    const snap = parseTeacherDashboard({
      weakQuestions: [
        { quizId: "q1", questionIndex: 0, prompt: "A" },
        { quizId: "q1", questionIndex: 3, prompt: "B" },
      ],
    });
    assert.deepEqual(
      snap.weakQuestions.map((q) => q.id),
      ["q1:0", "q1:3"]
    );
  });

  it("nomme par defaut ce que le serveur laisse vide", () => {
    const snap = parseTeacherDashboard({
      atRiskLearners: [{ userId: "u1" }],
      courses: [{ courseId: "c1" }],
      chapters: [{ chapterId: "ch1" }],
      weakQuestions: [{ quizId: "q1" }],
    });
    assert.equal(snap.atRiskLearners[0].name, "Eleve");
    assert.equal(snap.courses[0].title, "Cours");
    assert.equal(snap.chapters[0].title, "Chapitre");
    assert.equal(snap.weakQuestions[0].prompt, "Question");
  });

  it("n'accepte que le booleen vrai pour la publication", () => {
    const snap = parseTeacherDashboard({
      courses: [
        { courseId: "a", published: true },
        { courseId: "b", published: "true" },
        { courseId: "c", published: 1 },
      ],
    });
    assert.deepEqual(
      snap.courses.map((c) => c.published),
      [true, false, false]
    );
  });

  it("ignore les agregats qui ne sont pas des tableaux", () => {
    const snap = parseTeacherDashboard({
      courses: "beaucoup",
      daily: { day: "2026-09-02" },
    });
    assert.deepEqual(snap.courses, []);
    assert.deepEqual(snap.daily, []);
  });
});
