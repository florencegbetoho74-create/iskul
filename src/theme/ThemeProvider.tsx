import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  THEME_STORAGE_KEY,
  parsePreference,
  resolveThemeName,
  type ThemePreference,
} from "@/theme/themePreference";
import {
  HIT,
  PALETTES,
  RADIUS,
  SPACE,
  TYPE,
  elevation,
  type Palette,
  type ThemeName,
} from "@/theme/tokens";

export type { ThemePreference } from "@/theme/themePreference";
export { parsePreference, resolveThemeName } from "@/theme/themePreference";

export type Theme = {
  name: ThemeName;
  preference: ThemePreference;
  color: Palette;
  space: typeof SPACE;
  radius: typeof RADIUS;
  type: typeof TYPE;
  hit: typeof HIT;
  /** Ombre portee, teintee selon le theme actif. */
  elevation: (level: 0 | 1 | 2 | 3) => ReturnType<typeof elevation>;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setPreferenceState(parsePreference(raw));
      })
      .catch(() => {
        // Sans preference lisible, on suit l'appareil.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // On applique tout de suite : attendre l'ecriture disque ferait clignoter
    // l'interface.
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Theme>(() => {
    const name = resolveThemeName(preference, systemScheme);
    const color = PALETTES[name];
    return {
      name,
      preference,
      color,
      space: SPACE,
      radius: RADIUS,
      type: TYPE,
      hit: HIT,
      elevation: (level) => elevation(level, color.shadow),
      setPreference,
    };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Theme actif.
 *
 * Renvoie le theme clair si aucun fournisseur n'est monte : un ecran isole ne
 * doit pas planter, il doit simplement s'afficher en clair.
 */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  const color = PALETTES.light;
  return {
    name: "light",
    preference: "system",
    color,
    space: SPACE,
    radius: RADIUS,
    type: TYPE,
    hit: HIT,
    elevation: (level) => elevation(level, color.shadow),
    setPreference: () => {},
  };
}
