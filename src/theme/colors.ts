// Compatibilite avec les ecrans non encore migres.
//
// Quarante-cinq ecrans importent COLOR, FONT, RADIUS, SPACE et ELEVATION comme
// des constantes statiques. Les rebrancher sur les jetons permet de centraliser
// les valeurs sans reecrire tous les ecrans d'un coup.
//
// Ces constantes restent figees sur le theme clair : un ecran qui doit suivre
// le theme sombre passe par useTheme(), et abandonne cet import au passage.

import { LIGHT, PALETTE, RADIUS as RADIUS_TOKENS, SPACE as SPACE_TOKENS, elevation } from "@/theme/tokens";

export { FONT_FAMILY as FONT } from "@/theme/tokens";

export const COLOR = {
  bg: LIGHT.bg,
  surface: LIGHT.surface,
  card: LIGHT.surface,
  text: LIGHT.text,
  sub: LIGHT.textMuted,
  primary: LIGHT.primary,
  accent: PALETTE.warning[500],
  success: LIGHT.success,
  warn: LIGHT.warning,
  danger: LIGHT.danger,
  border: LIGHT.border,
  muted: LIGHT.surfaceSunk,
  tint: LIGHT.primarySoft,
  overlay: "rgba(11, 18, 32, 0.08)",
  ring: PALETTE.primary[200],
} as const;

export const RADIUS = {
  sm: RADIUS_TOKENS.sm,
  md: RADIUS_TOKENS.md,
  lg: RADIUS_TOKENS.lg,
  xl: RADIUS_TOKENS.xl,
  pill: RADIUS_TOKENS.pill,
} as const;

export const SPACE = {
  xxs: SPACE_TOKENS.xs,
  xs: SPACE_TOKENS.sm,
  sm: SPACE_TOKENS.md,
  md: SPACE_TOKENS.lg,
  lg: SPACE_TOKENS.xl,
  xl: SPACE_TOKENS.xxl,
} as const;

export const ELEVATION = {
  card: elevation(2, LIGHT.shadow),
  floating: elevation(3, LIGHT.shadow),
} as const;
