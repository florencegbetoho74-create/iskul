import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_STUDENT_DASHBOARD,
  currentStreak,
  greeting,
  liveCountdown,
  parseStudentDashboard,
} from "../src/lib/studentDashboard.ts";

describe("parseStudentDashboard", () => {
  it("lit un instantane complet", () => {
    const d = parseStudentDashboard({
      periodDays: 7,
      totals: {
        minutesThisPeriod: 260,
        lessonsCompleted: 12,
        quizAttempts: 5,
        quizAvgScorePct: 72.5,
        coursesAvailable: 18,
      },
    });
    assert.equal(d.totals.minutesThisPeriod, 260);
    assert.equal(d.totals.quizAvgScorePct, 72.5);
    assert.equal(d.periodDays, 7);
  });

  it("renvoie l'instantane vide sur une entree invalide", () => {
    assert.deepEqual(parseStudentDashboard(null), EMPTY_STUDENT_DASHBOARD);
    assert.deepEqual(parseStudentDashboard("{}"), EMPTY_STUDENT_DASHBOARD);
  });

  it("remplace les valeurs nulles par zero", () => {
    const d = parseStudentDashboard({
      totals: { minutesThisPeriod: null, quizAvgScorePct: undefined },
    });
    assert.equal(d.totals.minutesThisPeriod, 0);
    assert.equal(d.totals.quizAvgScorePct, 0);
  });
});

describe("parseStudentDashboard — reprise", () => {
  it("lit une reprise complete", () => {
    const d = parseStudentDashboard({
      resume: {
        courseId: "c1",
        courseTitle: "Fractions",
        lessonId: "ch3",
        lessonTitle: "Addition",
        watchedSec: 120,
        durationSec: 300,
        percent: 0.4,
      },
    });
    assert.equal(d.resume?.courseTitle, "Fractions");
    assert.equal(d.resume?.percent, 0.4);
  });

  // Une carte de reprise sans identifiants ne menerait nulle part : mieux vaut
  // ne rien afficher qu'un bouton mort.
  it("ecarte une reprise sans identifiants", () => {
    assert.equal(parseStudentDashboard({ resume: { courseTitle: "X" } }).resume, null);
    assert.equal(parseStudentDashboard({ resume: { courseId: "c1" } }).resume, null);
  });

  it("traite l'absence de reprise", () => {
    assert.equal(parseStudentDashboard({ resume: null }).resume, null);
    assert.equal(parseStudentDashboard({}).resume, null);
  });

  it("borne l'avancement entre 0 et 1", () => {
    const d = parseStudentDashboard({
      resume: { courseId: "c", lessonId: "l", percent: 4.2 },
    });
    assert.equal(d.resume?.percent, 1);
  });
});

describe("parseStudentDashboard — prochain live", () => {
  it("lit un live programme", () => {
    const d = parseStudentDashboard({
      nextLive: { liveId: "l1", title: "TD Maths", startAtMs: 1000, status: "scheduled" },
    });
    assert.equal(d.nextLive?.title, "TD Maths");
    assert.equal(d.nextLive?.status, "scheduled");
  });

  it("n'accepte que les deux statuts connus", () => {
    const d = parseStudentDashboard({
      nextLive: { liveId: "l1", status: "ended" },
    });
    assert.equal(d.nextLive?.status, "scheduled");
  });

  it("ecarte un live sans identifiant", () => {
    assert.equal(parseStudentDashboard({ nextLive: { title: "X" } }).nextLive, null);
  });
});

describe("greeting", () => {
  it("suit l'heure locale", () => {
    assert.equal(greeting(new Date(2026, 8, 4, 8, 0)), "Bonjour");
    assert.equal(greeting(new Date(2026, 8, 4, 15, 0)), "Bon après-midi");
    assert.equal(greeting(new Date(2026, 8, 4, 21, 0)), "Bonsoir");
    assert.equal(greeting(new Date(2026, 8, 4, 3, 0)), "Bonne nuit");
  });
});

describe("liveCountdown", () => {
  const now = 1_000_000_000;

  it("annonce le direct en cours", () => {
    assert.equal(liveCountdown(now - 1000, now), "En direct maintenant");
    assert.equal(liveCountdown(now, now), "En direct maintenant");
  });

  it("compte en minutes sous l'heure", () => {
    assert.equal(liveCountdown(now + 25 * 60000, now), "Dans 25 min");
  });

  it("compte en heures puis en jours", () => {
    assert.equal(liveCountdown(now + 3 * 3600000, now), "Dans 3 h");
    assert.equal(liveCountdown(now + 26 * 3600000, now), "Demain");
    assert.equal(liveCountdown(now + 72 * 3600000, now), "Dans 3 jours");
  });
});

describe("currentStreak", () => {
  it("compte les jours consecutifs jusqu'a aujourd'hui", () => {
    assert.equal(
      currentStreak([
        { day: "1", minutes: 10, lessons: 1 },
        { day: "2", minutes: 0, lessons: 0 },
        { day: "3", minutes: 5, lessons: 1 },
        { day: "4", minutes: 12, lessons: 2 },
      ]),
      2
    );
  });

  // Une serie qui compterait un jour inactif ne recompenserait pas la
  // regularite, elle la simulerait.
  it("s'arrete au premier jour inactif", () => {
    assert.equal(
      currentStreak([
        { day: "1", minutes: 30, lessons: 3 },
        { day: "2", minutes: 0, lessons: 0 },
      ]),
      0
    );
  });

  it("vaut zero sur une semaine vide", () => {
    assert.equal(currentStreak([]), 0);
    assert.equal(currentStreak([{ day: "1", minutes: 0, lessons: 0 }]), 0);
  });
});
