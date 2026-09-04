import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCUMENT_FORMAT_VERSION,
  checkPublishable,
  documentOutline,
  documentPlainText,
  normalizeSchoolYear,
  parseBlock,
  parseDocument,
  parseReference,
  pendingFigures,
  totalPoints,
  type LibraryDocument,
} from "../src/lib/documentFormat.ts";

const doc = (blocks: unknown[]): LibraryDocument => parseDocument({ blocks });

describe("parseDocument — resistance a l'entree", () => {
  it("rend un document vide plutot que de lever", () => {
    for (const input of [null, undefined, 42, "pas du json", "{", [], {}]) {
      const result = parseDocument(input);
      assert.equal(result.version, DOCUMENT_FORMAT_VERSION);
      assert.deepEqual(result.blocks, []);
    }
  });

  it("accepte une chaine JSON", () => {
    const result = parseDocument('{"blocks":[{"kind":"paragraph","text":"Bonjour"}]}');
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].text, "Bonjour");
  });

  it("accepte un tableau de blocs sans enveloppe", () => {
    const result = parseDocument([{ kind: "paragraph", text: "Seul" }]);
    assert.equal(result.blocks.length, 1);
  });

  it("attribue un identifiant aux blocs qui n'en ont pas", () => {
    const result = doc([
      { kind: "paragraph", text: "un" },
      { kind: "paragraph", text: "deux" },
    ]);
    assert.equal(result.blocks[0].id, "b1");
    assert.equal(result.blocks[1].id, "b2");
  });

  // Deux ancres identiques rendraient un lien direct ambigu.
  it("desambigue les identifiants en double", () => {
    const result = doc([
      { id: "x", kind: "paragraph", text: "un" },
      { id: "x", kind: "paragraph", text: "deux" },
      { id: "x", kind: "paragraph", text: "trois" },
    ]);
    assert.deepEqual(
      result.blocks.map((b) => b.id),
      ["x", "x-2", "x-3"]
    );
  });
});

describe("parseBlock — ce qui est rejete", () => {
  it("rejette un type inconnu", () => {
    assert.equal(parseBlock({ kind: "video", text: "x" }, 0), null);
    assert.equal(parseBlock({ text: "sans type" }, 0), null);
  });

  it("rejette un bloc de texte vide", () => {
    assert.equal(parseBlock({ kind: "paragraph", text: "   " }, 0), null);
    assert.equal(parseBlock({ kind: "question" }, 0), null);
  });

  it("rejette une figure sans description ni legende", () => {
    assert.equal(parseBlock({ kind: "figure", pageIndex: 2 }, 0), null);
    assert.ok(parseBlock({ kind: "figure", description: "Triangle rectangle" }, 0));
  });

  it("rejette une formule sans notation", () => {
    assert.equal(parseBlock({ kind: "formula" }, 0), null);
  });

  it("rejette une liste et un tableau sans contenu", () => {
    assert.equal(parseBlock({ kind: "list", items: [] }, 0), null);
    assert.equal(parseBlock({ kind: "list", items: ["  ", ""] }, 0), null);
    assert.equal(parseBlock({ kind: "table", rows: [[""], ["  "]] }, 0), null);
  });

  // Un exercice tient par son etiquette meme sans enonce.
  it("garde un exercice qui n'a que son etiquette", () => {
    const block = parseBlock({ kind: "exercise", label: "Exercice 2" }, 0);
    assert.equal(block?.label, "Exercice 2");
  });

  it("borne le niveau de titre", () => {
    assert.equal(parseBlock({ kind: "heading", text: "T", level: 9 }, 0)?.level, 1);
    assert.equal(parseBlock({ kind: "heading", text: "T", level: 2 }, 0)?.level, 2);
  });

  // Number(null) vaut 0 et Number(true) vaut 1 : un bareme absent deviendrait
  // un bareme de zero point annonce.
  it("ne prend pas null ni un booleen pour un bareme", () => {
    assert.equal(parseBlock({ kind: "paragraph", text: "x", points: null }, 0)?.points, undefined);
    assert.equal(parseBlock({ kind: "paragraph", text: "x", points: true }, 0)?.points, undefined);
    assert.equal(parseBlock({ kind: "paragraph", text: "x", points: "" }, 0)?.points, undefined);
    assert.equal(parseBlock({ kind: "paragraph", text: "x", points: "2,5" }, 0)?.points, 2.5);
  });

  it("ne garde pas un bareme negatif", () => {
    assert.equal(parseBlock({ kind: "paragraph", text: "x", points: -3 }, 0)?.points, undefined);
  });
});

describe("normalizeSchoolYear", () => {
  it("ramene les ecritures courantes a une forme unique", () => {
    assert.equal(normalizeSchoolYear("2023-2024"), "2023-2024");
    assert.equal(normalizeSchoolYear("2023/2024"), "2023-2024");
    assert.equal(normalizeSchoolYear("2023 2024"), "2023-2024");
    assert.equal(normalizeSchoolYear("2023-24"), "2023-2024");
    assert.equal(normalizeSchoolYear("Annee scolaire 2019-2020"), "2019-2020");
  });

  it("garde l'annee seule quand la seconde est absente ou incoherente", () => {
    assert.equal(normalizeSchoolYear("2024"), "2024");
    assert.equal(normalizeSchoolYear("2023-2027"), "2023");
  });

  it("rejette ce qui n'est pas une annee plausible", () => {
    assert.equal(normalizeSchoolYear("hier"), null);
    assert.equal(normalizeSchoolYear("1802-1803"), null);
    assert.equal(normalizeSchoolYear(null), null);
    assert.equal(normalizeSchoolYear(""), null);
  });
});

describe("parseReference", () => {
  it("rend une reference vide sur une entree invalide", () => {
    assert.deepEqual(parseReference("x"), {
      institution: null,
      schoolYear: null,
      session: null,
      series: null,
      author: null,
    });
  });

  it("lit un etablissement partiel", () => {
    const ref = parseReference({ institution: { city: "Porto-Novo" } });
    assert.deepEqual(ref.institution, { name: null, city: "Porto-Novo" });
  });

  it("ignore un etablissement entierement vide", () => {
    assert.equal(parseReference({ institution: { name: "", city: "  " } }).institution, null);
  });

  it("met la serie en capitales", () => {
    assert.equal(parseReference({ series: "d" }).series, "D");
  });

  it("normalise l'annee scolaire au passage", () => {
    assert.equal(parseReference({ schoolYear: "2021/2022" }).schoolYear, "2021-2022");
  });
});

describe("lecture du contenu", () => {
  const sample = doc([
    { id: "e1", kind: "exercise", label: "Exercice 1", points: 8 },
    { id: "q1", kind: "question", label: "1.a", text: "Calculer la somme.", parentId: "e1", points: 3 },
    { id: "f1", kind: "figure", description: "Triangle ABC", pageIndex: 1 },
    { id: "l1", kind: "list", items: ["premier", "second"] },
    { id: "t1", kind: "table", rows: [["x", "y"], ["1", "2"]] },
  ]);

  it("rassemble tout le texte pour la recherche", () => {
    const text = documentPlainText(sample);
    for (const needle of ["Exercice 1", "Calculer la somme.", "Triangle ABC", "premier", "x y"]) {
      assert.ok(text.includes(needle), `manquant : ${needle}`);
    }
  });

  it("construit le sommaire dans l'ordre", () => {
    assert.deepEqual(documentOutline(sample), [
      { id: "e1", label: "Exercice 1", kind: "exercise", points: 8 },
      { id: "q1", label: "1.a", kind: "question", points: 3 },
    ]);
  });

  // L'exercice annonce 8 points qu'il repartit entre ses questions : les
  // additionner tous les deux donnerait 11 points pour un exercice sur 8.
  it("ne compte pas deux fois le bareme d'un exercice et de ses questions", () => {
    assert.equal(totalPoints(sample), 8);
  });

  it("additionne les questions quand aucun exercice ne porte de bareme", () => {
    const sansExercice = doc([
      { kind: "question", label: "1", text: "a", points: 4 },
      { kind: "question", label: "2", text: "b", points: 6 },
    ]);
    assert.equal(totalPoints(sansExercice), 10);
  });

  it("rend null quand le document n'annonce aucun bareme", () => {
    assert.equal(totalPoints(doc([{ kind: "paragraph", text: "x" }])), null);
  });

  it("liste les figures qui attendent leur image", () => {
    assert.equal(pendingFigures(sample).length, 1);
    const remplie = doc([{ kind: "figure", description: "Schema", assetPath: "library/1.png" }]);
    assert.equal(pendingFigures(remplie).length, 0);
  });
});

describe("checkPublishable", () => {
  const ref = parseReference({
    institution: { name: "Lycee Behanzin", city: "Porto-Novo" },
    schoolYear: "2023-2024",
  });

  it("refuse un document vide", () => {
    const check = checkPublishable(parseDocument(null), ref, { isExam: true });
    assert.equal(check.ok, false);
    assert.ok(check.reasons.some((r) => r.includes("aucun bloc")));
  });

  it("refuse tant qu'une figure n'a pas son image", () => {
    const check = checkPublishable(
      doc([{ kind: "figure", description: "Schema du circuit" }]),
      ref,
      { isExam: true }
    );
    assert.equal(check.ok, false);
    assert.ok(check.reasons.some((r) => r.includes("figure")));
  });

  // La reference porte la credibilite : une epreuve anonyme ne vaut rien.
  it("exige etablissement et date pour une epreuve", () => {
    const check = checkPublishable(doc([{ kind: "paragraph", text: "Enonce" }]), parseReference({}), {
      isExam: true,
    });
    assert.equal(check.ok, false);
    assert.equal(check.reasons.length, 2);
  });

  it("n'exige pas de reference d'examen pour un resume de cours", () => {
    const check = checkPublishable(doc([{ kind: "paragraph", text: "Enonce" }]), parseReference({}), {
      isExam: false,
    });
    assert.deepEqual(check, { ok: true, reasons: [] });
  });

  it("accepte une epreuve complete", () => {
    const check = checkPublishable(
      doc([
        { kind: "exercise", label: "Exercice 1" },
        { kind: "figure", description: "Schema", assetPath: "library/a.png" },
      ]),
      ref,
      { isExam: true }
    );
    assert.deepEqual(check, { ok: true, reasons: [] });
  });
});
