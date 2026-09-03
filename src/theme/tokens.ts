// Jetons de design iSkul.
//
// L'application comptait 59 blocs de styles independants et environ 130
// couleurs ecrites en dur hors du theme. Tout part desormais d'ici.
//
// L'identite reste le bleu existant (#2F5BFF devient primary 500), mais
// declinee en echelle complete : trois tons ne permettaient ni les etats de
// survol, ni les fonds teintes, ni un mode sombre lisible.

/* -------------------------------------------------------------------------- */
/* Echelles brutes                                                            */
/* -------------------------------------------------------------------------- */
export const PALETTE = {
  // Bleu iSkul, ancre sur la teinte d'origine.
  primary: {
    50: "#EEF3FF",
    100: "#DCE5FF",
    200: "#BACBFF",
    300: "#8EA8FF",
    400: "#6182FF",
    500: "#2F5BFF",
    600: "#1F42D6",
    700: "#1833A8",
    800: "#132880",
    900: "#0E1C59",
  },
  // Neutres legerement bleutes : un gris pur jurerait a cote du bleu.
  neutral: {
    0: "#FFFFFF",
    50: "#F6F8FC",
    100: "#EDF1F8",
    200: "#DDE4EF",
    300: "#C2CCDC",
    400: "#93A0B5",
    500: "#6B7889",
    600: "#515C6E",
    700: "#3A4354",
    800: "#222A38",
    900: "#0B1220",
  },
  success: { 50: "#E6F6EC", 100: "#C6EBD4", 500: "#16A34A", 600: "#12833C", 700: "#0D6630" },
  warning: { 50: "#FDF3E2", 100: "#FAE3BC", 500: "#B45309", 600: "#96450A", 700: "#7A3A09" },
  danger: { 50: "#FDEBEB", 100: "#F9CFCF", 500: "#DC2626", 600: "#B91C1C", 700: "#991B1B" },
} as const;

/* -------------------------------------------------------------------------- */
/* Roles semantiques                                                          */
/* -------------------------------------------------------------------------- */
export type ThemeName = "light" | "dark";

export type Palette = {
  /** Fond de l'ecran. */
  bg: string;
  /** Cartes et panneaux poses sur le fond. */
  surface: string;
  /** Surface superieure : feuilles modales, elements flottants. */
  surfaceRaised: string;
  /** Fond discret : champs, pastilles, zones inertes. */
  surfaceSunk: string;

  text: string;
  textMuted: string;
  textFaint: string;
  /** Encre posee sur une surface de couleur primaire. */
  textOnPrimary: string;

  /** Separateur discret : decoratif, sans exigence de contraste. */
  border: string;
  borderStrong: string;
  /**
   * Contour des controles saisissables. Le seul moyen d'identifier un champ
   * etant sa bordure, celle-ci doit atteindre 3:1.
   */
  borderInteractive: string;

  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryInk: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;

  /** Voile des feuilles modales. */
  scrim: string;
  /** Teinte des ombres portees. */
  shadow: string;

  /**
   * Fond des surfaces media : lecteur video, vignette sans couverture.
   * Volontairement identique dans les deux themes -- une video ne se regarde
   * pas sur fond clair, et un theme clair ne doit pas eclaircir le letterbox.
   */
  media: string;
  /** Encre posee sur une surface media. */
  onMedia: string;
};

export const LIGHT: Palette = {
  bg: PALETTE.neutral[50],
  surface: PALETTE.neutral[0],
  surfaceRaised: PALETTE.neutral[0],
  surfaceSunk: PALETTE.neutral[100],

  text: PALETTE.neutral[900],
  textMuted: PALETTE.neutral[600],
  textFaint: PALETTE.neutral[500],
  textOnPrimary: PALETTE.neutral[0],

  border: PALETTE.neutral[200],
  borderStrong: PALETTE.neutral[300],
  // Doit tenir 3:1 sur la surface blanche comme sur le fond bas.
  borderInteractive: "#78859A",

  primary: PALETTE.primary[500],
  primaryPressed: PALETTE.primary[600],
  primarySoft: PALETTE.primary[50],
  primaryInk: PALETTE.primary[700],

  // Le 600 tombait a 4.32:1 sur son propre fond teinte : sous le seuil AA.
  success: PALETTE.success[700],
  successSoft: PALETTE.success[50],
  warning: PALETTE.warning[500],
  warningSoft: PALETTE.warning[50],
  danger: PALETTE.danger[600],
  dangerSoft: PALETTE.danger[50],

  scrim: "rgba(11, 18, 32, 0.45)",
  shadow: "#0B1D39",

  media: "#0F172A",
  onMedia: "#FFFFFF",
};

export const DARK: Palette = {
  bg: "#0A0F1A",
  surface: "#141B29",
  surfaceRaised: "#1C2536",
  surfaceSunk: "#101725",

  text: "#E9EDF5",
  textMuted: "#A3AFC4",
  textFaint: "#7C889D",
  // Le bleu clair du mode sombre demande une encre foncee.
  textOnPrimary: PALETTE.primary[900],

  border: "#28324a",
  borderStrong: "#3A4763",
  borderInteractive: "#5A6884",

  // Le 500 du mode clair devient illisible sur fond sombre : on remonte
  // l'echelle plutot que de garder la meme valeur des deux cotes.
  primary: PALETTE.primary[300],
  primaryPressed: PALETTE.primary[200],
  primarySoft: "#182449",
  primaryInk: PALETTE.primary[200],

  success: "#5BD08B",
  successSoft: "#12291D",
  warning: "#E9B665",
  warningSoft: "#2C2213",
  danger: "#F08A83",
  dangerSoft: "#2E1717",

  scrim: "rgba(0, 0, 0, 0.6)",
  shadow: "#000000",

  media: "#0F172A",
  onMedia: "#FFFFFF",
};

export const PALETTES: Record<ThemeName, Palette> = { light: LIGHT, dark: DARK };

/* -------------------------------------------------------------------------- */
/* Typographie, espacement, formes                                            */
/* -------------------------------------------------------------------------- */
export const FONT_FAMILY = {
  heading: "Sora_700Bold",
  headingAlt: "Sora_600SemiBold",
  body: "Manrope_500Medium",
  bodyBold: "Manrope_700Bold",
  mono: "Menlo",
} as const;

/** Echelle typographique : chaque niveau porte sa taille et son interligne. */
export const TYPE = {
  display: { fontSize: 30, lineHeight: 36, fontFamily: FONT_FAMILY.heading },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT_FAMILY.heading },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: FONT_FAMILY.headingAlt },
  subheading: { fontSize: 15, lineHeight: 21, fontFamily: FONT_FAMILY.headingAlt },
  body: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.body },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.bodyBold },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.body },
  captionStrong: { fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.bodyBold },
  overline: { fontSize: 10, lineHeight: 14, fontFamily: FONT_FAMILY.bodyBold, letterSpacing: 0.8 },
} as const;

export type TypeVariant = keyof typeof TYPE;

/** Echelle d'espacement de 4 en 4 : toute marge doit venir d'ici. */
export const SPACE = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Hauteur minimale des elements tactiles, conforme aux 44 pt recommandes. */
export const HIT = {
  min: 44,
  compact: 36,
} as const;

export function elevation(level: 0 | 1 | 2 | 3, shadowColor: string) {
  if (level === 0) return {};
  const config = {
    1: { opacity: 0.06, radius: 8, offset: 2, android: 2 },
    2: { opacity: 0.1, radius: 18, offset: 8, android: 4 },
    3: { opacity: 0.14, radius: 26, offset: 14, android: 8 },
  }[level];
  return {
    shadowColor,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offset },
    elevation: config.android,
  };
}
