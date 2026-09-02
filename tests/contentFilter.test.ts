import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countryFilter,
  escapeSearchTerm,
  gradeLevelFilter,
  pageRange,
  safeCountryCode,
  safePage,
  safeUuid,
  searchFilter,
} from "../src/lib/contentFilter.ts";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("safeUuid", () => {
  it("accepte un UUID et le normalise en minuscules", () => {
    assert.equal(safeUuid(UUID.toUpperCase()), UUID);
    assert.equal(safeUuid(`  ${UUID}  `), UUID);
  });

  it("rejette tout ce qui n'est pas un UUID", () => {
    assert.equal(safeUuid(""), null);
    assert.equal(safeUuid(null), null);
    assert.equal(safeUuid("6e"), null);
    assert.equal(safeUuid(`${UUID},published.eq.true`), null);
  });
});

describe("safeCountryCode", () => {
  it("normalise en majuscules", () => {
    assert.equal(safeCountryCode("bj"), "BJ");
  });

  it("rejette les formes invalides", () => {
    assert.equal(safeCountryCode("BEN"), null);
    assert.equal(safeCountryCode("B"), null);
    assert.equal(safeCountryCode("B,"), null);
    assert.equal(safeCountryCode(null), null);
  });
});

describe("gradeLevelFilter", () => {
  it("inclut les contenus tous niveaux", () => {
    assert.equal(
      gradeLevelFilter(UUID),
      `grade_level_id.eq.${UUID},grade_level_id.is.null`
    );
  });

  it("ne filtre pas quand la classe est inconnue", () => {
    assert.equal(gradeLevelFilter(null), null);
    assert.equal(gradeLevelFilter(""), null);
  });

  // Sans validation, une valeur de ce genre ajouterait une condition au filtre
  // et donnerait acces a des contenus hors perimetre.
  it("refuse une tentative d'injection dans le filtre or", () => {
    assert.equal(gradeLevelFilter(`${UUID},owner_id.not.is.null`), null);
    assert.equal(gradeLevelFilter("*"), null);
  });
});

describe("countryFilter", () => {
  it("inclut les contenus sans pays", () => {
    assert.equal(countryFilter("BJ"), "country_code.eq.BJ,country_code.is.null");
  });

  it("refuse une injection", () => {
    assert.equal(countryFilter("BJ,published.is.null"), null);
  });
});

describe("escapeSearchTerm", () => {
  it("neutralise les caracteres de motif et de separation", () => {
    assert.equal(escapeSearchTerm("100%"), "100\\%");
    assert.equal(escapeSearchTerm("a,b"), "a\\,b");
    assert.equal(escapeSearchTerm("f(x)"), "f\\(x\\)");
    assert.equal(escapeSearchTerm("a_b"), "a\\_b");
  });

  it("supprime les espaces de bord", () => {
    assert.equal(escapeSearchTerm("  maths  "), "maths");
  });
});

describe("searchFilter", () => {
  it("construit un or sur chaque colonne", () => {
    assert.equal(
      searchFilter("maths", ["title", "subject"]),
      "title.ilike.*maths*,subject.ilike.*maths*"
    );
  });

  it("renvoie null sur une recherche vide", () => {
    assert.equal(searchFilter("   ", ["title"]), null);
    assert.equal(searchFilter("maths", []), null);
  });

  it("echappe le terme avant de l'inserer", () => {
    assert.equal(searchFilter("a,b", ["title"]), "title.ilike.*a\\,b*");
  });
});

describe("safePage", () => {
  it("applique des valeurs par defaut raisonnables", () => {
    assert.deepEqual(safePage(), { limit: 20, offset: 0 });
    assert.deepEqual(safePage({}), { limit: 20, offset: 0 });
  });

  it("borne la taille de page", () => {
    assert.equal(safePage({ limit: 5000 }).limit, 100);
    assert.equal(safePage({ limit: 0 }).limit, 1);
    assert.equal(safePage({ limit: -3 }).limit, 1);
  });

  it("refuse un decalage negatif", () => {
    assert.equal(safePage({ offset: -10 }).offset, 0);
  });

  it("ignore les valeurs non numeriques", () => {
    assert.deepEqual(safePage({ limit: NaN, offset: NaN }), { limit: 20, offset: 0 });
  });
});

describe("pageRange", () => {
  it("produit des bornes inclusives", () => {
    assert.deepEqual(pageRange({ limit: 20, offset: 0 }), [0, 19]);
    assert.deepEqual(pageRange({ limit: 20, offset: 20 }), [20, 39]);
    assert.deepEqual(pageRange({ limit: 1, offset: 7 }), [7, 7]);
  });
});
