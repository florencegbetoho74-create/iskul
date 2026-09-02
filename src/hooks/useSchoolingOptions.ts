import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listCountries,
  listGradeLevels,
  listSubjects,
  resolveScopeForCountry,
  type ContentScope,
  type Country,
  type GradeLevel,
  type Subject,
} from "@/storage/referentials";

type State = {
  countries: Country[];
  gradeLevels: GradeLevel[];
  subjects: Subject[];
  scope: ContentScope | null;
  loadingCountries: boolean;
  loadingGrades: boolean;
  error: string | null;
};

const EMPTY: State = {
  countries: [],
  gradeLevels: [],
  subjects: [],
  scope: null,
  loadingCountries: true,
  loadingGrades: false,
  error: null,
};

/**
 * Charge la liste des pays et les classes du programme servi pour le pays
 * courant. Utilise par l'inscription, le profil et les reglages : ces trois
 * ecrans doivent proposer exactement les memes options.
 */
export function useSchoolingOptions(countryCode?: string | null) {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loadingCountries: true, error: null }));
    listCountries()
      .then((countries) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, countries, loadingCountries: false }));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loadingCountries: false,
          error: e?.message || "Liste des pays indisponible.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const code = String(countryCode || "").trim();
    if (!code) {
      setState((prev) => ({
        ...prev,
        gradeLevels: [],
        subjects: [],
        scope: null,
        loadingGrades: false,
      }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loadingGrades: true, error: null }));

    Promise.all([resolveScopeForCountry(code), listGradeLevels(code), listSubjects(code)])
      .then(([scope, gradeLevels, subjects]) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, scope, gradeLevels, subjects, loadingGrades: false }));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loadingGrades: false,
          error: e?.message || "Programme indisponible pour ce pays.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  const fallbackCountryName = useMemo(() => {
    if (!state.scope?.isFallback) return null;
    const match = state.countries.find((c) => c.code === state.scope?.countryCode);
    return match?.nameFr ?? state.scope.countryCode;
  }, [state.scope, state.countries]);

  /**
   * Message affiche a l'eleve quand on lui sert le programme d'un autre pays.
   * Le dire explicitement vaut mieux qu'un ecran vide ou qu'un contenu presente
   * a tort comme le sien.
   */
  const fallbackNotice = useMemo(() => {
    if (!fallbackCountryName) return null;
    return `Le programme de votre pays n'est pas encore disponible. Vous suivez pour l'instant le programme ${fallbackCountryName}.`;
  }, [fallbackCountryName]);

  const gradeLabel = useCallback(
    (gradeLevelId?: string | null) =>
      state.gradeLevels.find((l) => l.id === gradeLevelId)?.label ?? "",
    [state.gradeLevels]
  );

  return { ...state, fallbackCountryName, fallbackNotice, gradeLabel };
}
