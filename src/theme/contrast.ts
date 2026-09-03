// Calcul de contraste WCAG 2.1.
//
// Une palette "qui a l'air lisible" ne suffit pas : le gris sur blanc passe
// souvent sous le seuil sans que personne ne le remarque, jusqu'a ce qu'un
// eleve lise son cours en plein soleil. Ces fonctions rendent la palette
// verifiable par les tests.

export type Rgb = { r: number; g: number; b: number };

/** Seuil AA pour le texte courant. */
export const AA_TEXT = 4.5;
/** Seuil AA pour le grand texte et les elements d'interface. */
export const AA_LARGE = 3;

export function hexToRgb(hex: string): Rgb | null {
  const raw = String(hex ?? "").trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Compose une couleur translucide sur un fond opaque et renvoie le resultat en
 * hexadecimal. Les jetons poses sur la video sont translucides : sans cette
 * composition, ils echapperaient a toute verification de contraste.
 */
export function over(color: string, backdrop: string): string | null {
  const back = hexToRgb(backdrop);
  if (!back) return null;

  const solid = hexToRgb(color);
  if (solid) return color;

  const match = /^rgba?\(([^)]+)\)$/i.exec(String(color ?? "").trim());
  if (!match) return null;
  const parts = match[1].split(",").map((p) => Number(p.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;

  const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? Math.min(1, Math.max(0, parts[3])) : 1;
  const mix = (fg: number, bg: number) => Math.round(alpha * fg + (1 - alpha) * bg);
  const channels = [
    mix(parts[0], back.r),
    mix(parts[1], back.g),
    mix(parts[2], back.b),
  ];
  return "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminance relative, entre 0 (noir) et 1 (blanc). */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/**
 * Rapport de contraste entre deux couleurs, de 1 (identiques) a 21 (noir sur
 * blanc). Renvoie null si l'une des deux n'est pas une couleur valide.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Le couple respecte-t-il le seuil demande ? */
export function meetsContrast(a: string, b: string, threshold = AA_TEXT): boolean {
  const ratio = contrastRatio(a, b);
  return ratio !== null && ratio >= threshold;
}

/**
 * Choisit l'encre la plus lisible sur un fond donne.
 * Sert aux surfaces dont la couleur vient d'une donnee et non de la palette.
 */
export function readableInk(background: string, light = "#FFFFFF", dark = "#0B1220"): string {
  const withLight = contrastRatio(background, light) ?? 0;
  const withDark = contrastRatio(background, dark) ?? 0;
  return withLight >= withDark ? light : dark;
}
