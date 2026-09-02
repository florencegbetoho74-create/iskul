import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CONTENT_COUNTRY,
  countryFlagFromCode,
  filterCountries,
  findGradeLevel,
  normalizeGradeCode,
  resolveContentScope,
  sortCountriesForPicker,
  sortGradeLevels,
  type Country,
  type GradeLevel,
} from "../src/lib/referentialSupport.ts";

const BENIN: Country = { code: "BJ", nameFr: "Bénin", flag: "🇧🇯", hasContent: true };
const SENEGAL: Country = { code: "SN", nameFr: "Sénégal", flag: "🇸🇳", hasContent: false };
const ALBANIE: Country = { code: "AL", nameFr: "Albanie", flag: "🇦🇱", hasContent: false };

const LEVELS: GradeLevel[] = [
  { id: "id-tle", code: "Terminale", label: "Terminale", cycle: "lycee", orderIndex: 7 },
  { id: "id-6e", code: "6e", label: "6e", cycle: "college", orderIndex: 1 },
  { id: "id-2nde", code: "2nde", label: "2nde", cycle: "lycee", orderIndex: 5 },
];

describe("normalizeGradeCode", () => {
  it("accepte les alias courants saisis par les eleves", () => {
    assert.equal(normalizeGradeCode("6eme"), "6e");
    assert.equal(normalizeGradeCode("6ème"), "6e");
    assert.equal(normalizeGradeCode("Seconde"), "2nde");
    assert.equal(normalizeGradeCode("2de"), "2nde");
    assert.equal(normalizeGradeCode("1re"), "1ere");
    assert.equal(normalizeGradeCode("première"), "1ere");
    assert.equal(normalizeGradeCode("Tle"), "Terminale");
    assert.equal(normalizeGradeCode(" TERMINALE "), "Terminale");
  });

  it("renvoie null plutot que de deviner", () => {
    assert.equal(normalizeGradeCode(""), null);
    assert.equal(normalizeGradeCode(null), null);
    assert.equal(normalizeGradeCode(undefined), null);
    assert.equal(normalizeGradeCode("CM2"), null);
    assert.equal(normalizeGradeCode("Terminale D"), null);
  });
});

describe("countryFlagFromCode", () => {
  it("derive le drapeau depuis le code ISO", () => {
    assert.equal(countryFlagFromCode("BJ"), "🇧🇯");
    assert.equal(countryFlagFromCode("fr"), "🇫🇷");
  });

  it("renvoie une chaine vide sur un code invalide", () => {
    assert.equal(countryFlagFromCode("BEN"), "");
    assert.equal(countryFlagFromCode("B"), "");
    assert.equal(countryFlagFromCode(null), "");
  });
});

describe("resolveContentScope", () => {
  it("sert le programme du pays quand il existe", () => {
    const scope = resolveContentScope({
      requestedCountryCode: "BJ",
      countriesWithContent: ["BJ"],
    });
    assert.deepEqual(scope, {
      countryCode: "BJ",
      isFallback: false,
      requestedCountryCode: "BJ",
    });
  });

  it("bascule sur le pays de repli quand le pays n'a pas encore de contenu", () => {
    const scope = resolveContentScope({
      requestedCountryCode: "SN",
      countriesWithContent: ["BJ"],
    });
    assert.equal(scope.countryCode, DEFAULT_CONTENT_COUNTRY);
    assert.equal(scope.isFallback, true);
    // Le pays declare par l'eleve reste connu : l'interface doit pouvoir le nommer.
    assert.equal(scope.requestedCountryCode, "SN");
  });

  it("traite un pays absent comme un repli", () => {
    const scope = resolveContentScope({
      requestedCountryCode: null,
      countriesWithContent: ["BJ"],
    });
    assert.equal(scope.countryCode, "BJ");
    assert.equal(scope.isFallback, true);
    assert.equal(scope.requestedCountryCode, null);
  });

  it("normalise la casse du code pays", () => {
    const scope = resolveContentScope({
      requestedCountryCode: "bj",
      countriesWithContent: ["bj"],
    });
    assert.equal(scope.countryCode, "BJ");
    assert.equal(scope.isFallback, false);
  });

  it("respecte un pays de repli explicite", () => {
    const scope = resolveContentScope({
      requestedCountryCode: "SN",
      countriesWithContent: ["CI"],
      fallbackCountryCode: "CI",
    });
    assert.equal(scope.countryCode, "CI");
    assert.equal(scope.isFallback, true);
  });
});

describe("sortCountriesForPicker", () => {
  it("place les pays avec contenu en tete, puis l'ordre alphabetique francais", () => {
    const sorted = sortCountriesForPicker([ALBANIE, SENEGAL, BENIN]);
    assert.deepEqual(
      sorted.map((c) => c.code),
      ["BJ", "AL", "SN"]
    );
  });

  it("ne modifie pas le tableau source", () => {
    const input = [ALBANIE, BENIN];
    sortCountriesForPicker(input);
    assert.deepEqual(
      input.map((c) => c.code),
      ["AL", "BJ"]
    );
  });
});

describe("filterCountries", () => {
  it("ignore accents et casse", () => {
    const found = filterCountries([BENIN, SENEGAL, ALBANIE], "benin");
    assert.deepEqual(
      found.map((c) => c.code),
      ["BJ"]
    );
  });

  it("cherche aussi par code ISO", () => {
    const found = filterCountries([BENIN, SENEGAL, ALBANIE], "sn");
    assert.deepEqual(
      found.map((c) => c.code),
      ["SN"]
    );
  });

  it("renvoie tout sur une recherche vide", () => {
    assert.equal(filterCountries([BENIN, SENEGAL, ALBANIE], "   ").length, 3);
  });
});

describe("sortGradeLevels", () => {
  it("classe du plus bas au plus eleve", () => {
    assert.deepEqual(
      sortGradeLevels(LEVELS).map((l) => l.code),
      ["6e", "2nde", "Terminale"]
    );
  });
});

describe("findGradeLevel", () => {
  it("retrouve par identifiant", () => {
    assert.equal(findGradeLevel(LEVELS, { id: "id-2nde" })?.code, "2nde");
  });

  it("retombe sur le code quand l'identifiant est absent", () => {
    assert.equal(findGradeLevel(LEVELS, { id: null, code: "Seconde" })?.id, "id-2nde");
    assert.equal(findGradeLevel(LEVELS, { code: "tle" })?.id, "id-tle");
  });

  it("renvoie null quand rien ne correspond", () => {
    assert.equal(findGradeLevel(LEVELS, { id: "inconnu", code: "CM2" }), null);
    assert.equal(findGradeLevel(LEVELS, {}), null);
  });
});
