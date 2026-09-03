import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AA_LARGE,
  AA_TEXT,
  contrastRatio,
  hexToRgb,
  meetsContrast,
  readableInk,
  relativeLuminance,
} from "../src/theme/contrast.ts";
import { DARK, LIGHT, PALETTES, type Palette, type ThemeName } from "../src/theme/tokens.ts";

describe("hexToRgb", () => {
  it("lit les formes longues et courtes", () => {
    assert.deepEqual(hexToRgb("#FFFFFF"), { r: 255, g: 255, b: 255 });
    assert.deepEqual(hexToRgb("000000"), { r: 0, g: 0, b: 0 });
    assert.deepEqual(hexToRgb("#f00"), { r: 255, g: 0, b: 0 });
  });

  it("refuse ce qui n'est pas une couleur", () => {
    assert.equal(hexToRgb("rgba(0,0,0,0.5)"), null);
    assert.equal(hexToRgb("#12345"), null);
    assert.equal(hexToRgb(""), null);
  });
});

describe("relativeLuminance", () => {
  it("place le noir et le blanc aux extremes", () => {
    assert.equal(relativeLuminance("#000000"), 0);
    assert.equal(relativeLuminance("#FFFFFF"), 1);
  });
});

describe("contrastRatio", () => {
  it("donne 21 pour noir sur blanc", () => {
    assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF") as number), 21);
  });

  it("donne 1 pour deux couleurs identiques", () => {
    assert.equal(contrastRatio("#2F5BFF", "#2F5BFF"), 1);
  });

  it("est symetrique", () => {
    const a = contrastRatio("#2F5BFF", "#FFFFFF");
    const b = contrastRatio("#FFFFFF", "#2F5BFF");
    assert.equal(a, b);
  });

  it("renvoie null sur une entree invalide", () => {
    assert.equal(contrastRatio("transparent", "#FFFFFF"), null);
  });
});

describe("readableInk", () => {
  it("choisit l'encre la plus lisible", () => {
    assert.equal(readableInk("#0B1220"), "#FFFFFF");
    assert.equal(readableInk("#F6F8FC"), "#0B1220");
  });
});

/* -------------------------------------------------------------------------- */
/* La palette elle-meme                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Couples reellement affiches par l'application. Un jeton peut exister sans
 * jamais etre lisible : ce sont ces combinaisons qu'il faut verifier, pas les
 * couleurs prises isolement.
 */
function textPairs(p: Palette): Array<[string, string, string]> {
  return [
    ["texte sur fond", p.text, p.bg],
    ["texte sur surface", p.text, p.surface],
    ["texte sur surface haute", p.text, p.surfaceRaised],
    ["texte sur surface basse", p.text, p.surfaceSunk],
    ["texte attenue sur fond", p.textMuted, p.bg],
    ["texte attenue sur surface", p.textMuted, p.surface],
    ["encre sur primaire", p.textOnPrimary, p.primary],
    ["primaire sur surface", p.primaryInk, p.surface],
    ["primaire sur fond teinte", p.primaryInk, p.primarySoft],
    ["succes sur fond teinte", p.success, p.successSoft],
    ["alerte sur fond teinte", p.warning, p.warningSoft],
    ["erreur sur fond teinte", p.danger, p.dangerSoft],
    ["erreur sur surface", p.danger, p.surface],
    ["succes sur surface", p.success, p.surface],
  ];
}

/** Elements d'interface : bordures et pastilles, seuil abaisse a 3:1. */
function uiPairs(p: Palette): Array<[string, string, string]> {
  return [
    // Seule la bordure des controles saisissables porte une exigence : c'est
    // elle qui identifie le champ. Un separateur decoratif n'en a pas.
    ["bordure de champ sur surface", p.borderInteractive, p.surface],
    ["bordure de champ sur fond bas", p.borderInteractive, p.surfaceSunk],
    ["primaire sur surface", p.primary, p.surface],
  ];
}

const THEMES: ThemeName[] = ["light", "dark"];

for (const name of THEMES) {
  const palette = PALETTES[name];

  describe(`palette ${name} — texte`, () => {
    for (const [label, fg, bg] of textPairs(palette)) {
      it(`${label} respecte AA (${AA_TEXT}:1)`, () => {
        const ratio = contrastRatio(fg, bg);
        assert.ok(ratio !== null, `${label} : couleur invalide (${fg} / ${bg})`);
        assert.ok(
          (ratio as number) >= AA_TEXT,
          `${label} : ${fg} sur ${bg} donne ${(ratio as number).toFixed(2)}:1`
        );
      });
    }
  });

  describe(`palette ${name} — interface`, () => {
    for (const [label, fg, bg] of uiPairs(palette)) {
      it(`${label} respecte le seuil interface (${AA_LARGE}:1)`, () => {
        const ratio = contrastRatio(fg, bg);
        assert.ok(ratio !== null, `${label} : couleur invalide`);
        assert.ok(
          (ratio as number) >= AA_LARGE,
          `${label} : ${fg} sur ${bg} donne ${(ratio as number).toFixed(2)}:1`
        );
      });
    }
  });
}

describe("coherence des deux themes", () => {
  it("expose exactement les memes jetons", () => {
    assert.deepEqual(Object.keys(LIGHT).sort(), Object.keys(DARK).sort());
  });

  it("n'oublie aucune valeur", () => {
    for (const [name, palette] of Object.entries(PALETTES)) {
      for (const [token, value] of Object.entries(palette)) {
        assert.ok(
          typeof value === "string" && value.length > 0,
          `${name}.${token} est vide`
        );
      }
    }
  });

  // Un fond sombre qui serait plus clair que son texte trahirait une inversion.
  it("inverse bien la clarte entre les deux themes", () => {
    const lightBg = relativeLuminance(LIGHT.bg) as number;
    const darkBg = relativeLuminance(DARK.bg) as number;
    assert.ok(lightBg > 0.5, "le fond clair doit etre clair");
    assert.ok(darkBg < 0.1, "le fond sombre doit etre sombre");
  });

  it("garde le meme sens de lecture pour les surfaces", () => {
    // En clair, la surface remonte vers le blanc ; en sombre, elle s'eclaircit
    // aussi par rapport au fond. Dans les deux cas elle se detache.
    assert.ok(meetsContrast(LIGHT.surface, LIGHT.bg, 1.05));
    assert.ok(meetsContrast(DARK.surface, DARK.bg, 1.05));
  });
});
