import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatExamLabel,
  groupByDocumentType,
  isValidExamYear,
  parseDocumentType,
  parseDocumentTypes,
  type DocumentType,
} from "../src/lib/documentTaxonomy.ts";

const EPREUVE: DocumentType = {
  id: "t1",
  code: "epreuve",
  label: "Épreuve",
  pluralLabel: "Épreuves",
  isExam: true,
  orderIndex: 1,
};

const OEUVRE: DocumentType = {
  id: "t2",
  code: "oeuvre",
  label: "Œuvre",
  pluralLabel: "Œuvres littéraires",
  isExam: false,
  orderIndex: 3,
};

describe("parseDocumentType", () => {
  it("lit une ligne serveur en snake_case", () => {
    assert.deepEqual(
      parseDocumentType({
        id: "t1",
        code: "epreuve",
        label: "Épreuve",
        plural_label: "Épreuves",
        is_exam: true,
        order_index: 1,
      }),
      EPREUVE
    );
  });

  it("retombe sur le libelle simple quand le pluriel manque", () => {
    assert.equal(parseDocumentType({ code: "x", label: "Test" })?.pluralLabel, "Test");
  });

  it("n'accepte que le booleen vrai pour is_exam", () => {
    assert.equal(parseDocumentType({ code: "x", is_exam: "true" })?.isExam, false);
    assert.equal(parseDocumentType({ code: "x", is_exam: 1 })?.isExam, false);
    assert.equal(parseDocumentType({ code: "x", is_exam: true })?.isExam, true);
  });

  it("refuse une ligne sans code", () => {
    assert.equal(parseDocumentType({ label: "Sans code" }), null);
    assert.equal(parseDocumentType({ code: "   " }), null);
    assert.equal(parseDocumentType(null), null);
  });
});

describe("parseDocumentTypes", () => {
  it("classe par ordre du referentiel", () => {
    const parsed = parseDocumentTypes([
      { code: "oeuvre", label: "B", order_index: 3 },
      { code: "epreuve", label: "A", order_index: 1 },
    ]);
    assert.deepEqual(
      parsed.map((t) => t.code),
      ["epreuve", "oeuvre"]
    );
  });

  it("departage a ordre egal par le libelle", () => {
    const parsed = parseDocumentTypes([
      { code: "b", label: "Zebre", order_index: 5 },
      { code: "a", label: "Antilope", order_index: 5 },
    ]);
    assert.deepEqual(
      parsed.map((t) => t.code),
      ["a", "b"]
    );
  });

  it("renvoie une liste vide sur une entree non tableau", () => {
    assert.deepEqual(parseDocumentTypes(null), []);
    assert.deepEqual(parseDocumentTypes({}), []);
  });
});

describe("formatExamLabel", () => {
  it("assemble examen, session et annee", () => {
    assert.equal(
      formatExamLabel({ examName: "BEPC", examSession: "Juin", examYear: 2024 }),
      "BEPC · Juin · 2024"
    );
  });

  it("omet ce qui manque", () => {
    assert.equal(formatExamLabel({ examName: "BAC", examYear: 2023 }), "BAC · 2023");
    assert.equal(formatExamLabel({ examName: "BAC" }), "BAC");
  });

  // Sans ce garde-fou, un document sans metadonnees afficherait "0" ou "NaN".
  it("renvoie une chaine vide quand rien n'est connu", () => {
    assert.equal(formatExamLabel({}), "");
    assert.equal(formatExamLabel({ examName: null, examYear: null, examSession: null }), "");
    assert.equal(formatExamLabel({ examYear: 0 }), "");
    assert.equal(formatExamLabel({ examName: "   " }), "");
  });
});

describe("isValidExamYear", () => {
  it("accepte une annee plausible", () => {
    assert.equal(isValidExamYear(2024), true);
    assert.equal(isValidExamYear(1960), true);
    assert.equal(isValidExamYear(2100), true);
  });

  it("refuse les fautes de frappe et les valeurs hors bornes", () => {
    assert.equal(isValidExamYear(202), false);
    assert.equal(isValidExamYear(20244), false);
    assert.equal(isValidExamYear(1959), false);
    assert.equal(isValidExamYear(2024.5), false);
    assert.equal(isValidExamYear("2024"), true);
    assert.equal(isValidExamYear("deux mille"), false);
    assert.equal(isValidExamYear(null), false);
  });
});

describe("groupByDocumentType", () => {
  const docs = [
    { id: "d1", documentTypeId: "t2" },
    { id: "d2", documentTypeId: "t1" },
    { id: "d3", documentTypeId: "t1" },
  ];

  it("respecte l'ordre du referentiel, pas celui des documents", () => {
    const groups = groupByDocumentType(docs, [EPREUVE, OEUVRE]);
    assert.deepEqual(
      groups.map((g) => g.type.code),
      ["epreuve", "oeuvre"]
    );
    assert.deepEqual(
      groups[0].items.map((d) => d.id),
      ["d2", "d3"]
    );
  });

  // Une section vide n'apprend rien a l'eleve.
  it("omet les types sans document", () => {
    const groups = groupByDocumentType([{ id: "d1", documentTypeId: "t1" }], [EPREUVE, OEUVRE]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].type.code, "epreuve");
  });

  it("ecarte les documents dont le type est inconnu", () => {
    const groups = groupByDocumentType(
      [{ id: "d1", documentTypeId: "inconnu" }, { id: "d2", documentTypeId: null }],
      [EPREUVE, OEUVRE]
    );
    assert.deepEqual(groups, []);
  });
});
