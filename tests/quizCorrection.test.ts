import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countCorrect,
  parseCorrection,
  parseCorrectionEntry,
} from "../src/lib/quizCorrection.ts";

describe("parseCorrectionEntry", () => {
  it("lit une entree complete", () => {
    assert.deepEqual(
      parseCorrectionEntry({
        questionIndex: 2,
        chosenIndex: 1,
        correctIndices: [1],
        isCorrect: true,
      }),
      { questionIndex: 2, chosenIndex: 1, correctIndices: [1], isCorrect: true }
    );
  });

  it("traite une question sans reponse", () => {
    const entry = parseCorrectionEntry({
      questionIndex: 0,
      chosenIndex: null,
      correctIndices: [3],
      isCorrect: false,
    });
    assert.equal(entry?.chosenIndex, null);
    assert.equal(entry?.isCorrect, false);
  });

  // isCorrect vient d'un jsonb : une chaine "false" ou 0 ne doit jamais
  // compter comme une bonne reponse.
  it("n'accepte que le booleen vrai", () => {
    assert.equal(parseCorrectionEntry({ isCorrect: "true" })?.isCorrect, false);
    assert.equal(parseCorrectionEntry({ isCorrect: 1 })?.isCorrect, false);
    assert.equal(parseCorrectionEntry({ isCorrect: "false" })?.isCorrect, false);
    assert.equal(parseCorrectionEntry({ isCorrect: true })?.isCorrect, true);
  });

  it("retombe sur l'index fourni quand la question n'est pas nommee", () => {
    assert.equal(parseCorrectionEntry({}, 4)?.questionIndex, 4);
    assert.equal(parseCorrectionEntry({ questionIndex: -1 }, 4)?.questionIndex, 4);
  });

  it("nettoie les indices corrects", () => {
    assert.deepEqual(
      parseCorrectionEntry({ correctIndices: [2, "1", 1, -3, null, 0] })?.correctIndices,
      [0, 1, 2]
    );
    assert.deepEqual(parseCorrectionEntry({ correctIndices: "1" })?.correctIndices, []);
  });

  it("refuse ce qui n'est pas un objet", () => {
    assert.equal(parseCorrectionEntry(null), null);
    assert.equal(parseCorrectionEntry("x"), null);
    assert.equal(parseCorrectionEntry(3), null);
  });
});

describe("parseCorrection", () => {
  it("remet les entrees dans l'ordre des questions", () => {
    const parsed = parseCorrection([
      { questionIndex: 2, isCorrect: true },
      { questionIndex: 0, isCorrect: false },
      { questionIndex: 1, isCorrect: true },
    ]);
    assert.deepEqual(
      parsed.map((e) => e.questionIndex),
      [0, 1, 2]
    );
  });

  it("renvoie une liste vide sur une entree non tableau", () => {
    assert.deepEqual(parseCorrection(null), []);
    assert.deepEqual(parseCorrection({}), []);
    assert.deepEqual(parseCorrection("[]"), []);
  });

  it("ecarte les elements inexploitables", () => {
    assert.equal(parseCorrection([{ questionIndex: 0 }, null, 5]).length, 1);
  });
});

describe("countCorrect", () => {
  it("compte les bonnes reponses", () => {
    const entries = parseCorrection([
      { questionIndex: 0, isCorrect: true },
      { questionIndex: 1, isCorrect: false },
      { questionIndex: 2, isCorrect: true },
    ]);
    assert.equal(countCorrect(entries), 2);
  });

  it("vaut zero sur une liste vide", () => {
    assert.equal(countCorrect([]), 0);
  });
});
