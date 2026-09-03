import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePreference, resolveThemeName } from "../src/theme/themePreference.ts";

describe("parsePreference", () => {
  it("accepte les trois valeurs connues", () => {
    assert.equal(parsePreference("system"), "system");
    assert.equal(parsePreference("light"), "light");
    assert.equal(parsePreference("dark"), "dark");
  });

  // Une preference illisible ne doit pas figer l'application sur un theme :
  // suivre l'appareil est le repli le moins surprenant.
  it("retombe sur le suivi de l'appareil", () => {
    assert.equal(parsePreference(null), "system");
    assert.equal(parsePreference(undefined), "system");
    assert.equal(parsePreference(""), "system");
    assert.equal(parsePreference("sombre"), "system");
    assert.equal(parsePreference(42), "system");
  });
});

describe("resolveThemeName", () => {
  it("respecte un choix explicite quel que soit l'appareil", () => {
    assert.equal(resolveThemeName("light", "dark"), "light");
    assert.equal(resolveThemeName("dark", "light"), "dark");
  });

  it("suit l'appareil en mode automatique", () => {
    assert.equal(resolveThemeName("system", "dark"), "dark");
    assert.equal(resolveThemeName("system", "light"), "light");
  });

  // useColorScheme renvoie null tant que le systeme n'a pas repondu.
  it("part du theme clair quand l'appareil ne dit rien", () => {
    assert.equal(resolveThemeName("system", null), "light");
    assert.equal(resolveThemeName("system", undefined), "light");
  });
});
