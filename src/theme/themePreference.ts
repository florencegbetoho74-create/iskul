// Resolution de la preference de theme.
//
// Sorti du fournisseur pour rester testable : un fichier JSX n'est pas
// chargeable par le lanceur de tests.

import type { ThemeName } from "@/theme/tokens";

/** Ce que l'utilisateur choisit ; "system" suit le reglage de l'appareil. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme:preference:v1";

/**
 * Valide une preference lue sur disque.
 * Une valeur illisible ne doit pas figer l'application sur un theme : suivre
 * l'appareil est le repli le moins surprenant.
 */
export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** Resout la preference en theme effectif. */
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
): ThemeName {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}
