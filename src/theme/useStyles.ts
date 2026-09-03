import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme, type Theme } from "@/theme/ThemeProvider";

type NamedStyles<T> = { [P in keyof T]: object };

/**
 * Feuille de styles derivee du theme actif.
 *
 * Un `StyleSheet.create` pose au niveau du module fige les couleurs au premier
 * chargement : c'est ce qui empechait le mode sombre. Ici la feuille est
 * recalculee quand le theme change, et memorisee entre deux rendus.
 *
 * La fabrique doit rester pure : elle est appelee a chaque changement de theme.
 */
export function useStyles<T extends NamedStyles<T>>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}

/**
 * Variante pour les ecrans qui ont besoin du theme lui-meme en plus des styles.
 * Evite d'appeler useTheme() une seconde fois dans le composant.
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T
): { styles: T; theme: Theme } {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
  return { styles, theme };
}
