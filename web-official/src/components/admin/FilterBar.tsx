import type { ReactNode } from "react";

export type FilterOption = {
  key: string;
  label: string;
  /** Affiché en pastille. Zéro se distingue d'inconnu : on n'affiche rien. */
  count?: number | null;
  tone?: "danger" | "warning" | "success";
};

type Props = {
  /** Recherche libre. Absente si la section n'en propose pas. */
  search?: { value: string; onChange: (next: string) => void; placeholder: string; label: string };
  options?: FilterOption[];
  value?: string;
  onChange?: (key: string) => void;
  /** Actions de droite : rafraîchir, exporter. */
  actions?: ReactNode;
};

/**
 * La barre d'outils d'une section de la console.
 *
 * Chaque section dessinait sa propre recherche et ses propres pastilles. Une
 * console de supervision se parcourt en diagonale : si le filtre ne se trouve
 * pas au même endroit d'un écran à l'autre, on le cherche à chaque fois.
 *
 * Les compteurs sont portés par les pastilles plutôt que par un tableau
 * séparé : le nombre d'échecs est ce qui décide sur quel filtre on clique.
 */
export default function FilterBar({ search, options, value, onChange, actions }: Props) {
  return (
    <div className="filterbar">
      {search ? (
        <div className="filterbar-search">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label}
          />
          {search.value ? (
            <button type="button" onClick={() => search.onChange("")} aria-label="Effacer la recherche">
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {options?.length ? (
        <div className="filterbar-chips" role="group" aria-label="Filtrer">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.key === value ? "chip-btn active" : "chip-btn"}
              aria-pressed={option.key === value}
              onClick={() => onChange?.(option.key)}
            >
              {option.label}
              {option.count != null ? (
                <span className={option.tone ? `chip-count tone-${option.tone}` : "chip-count"}>
                  {option.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {actions ? <div className="filterbar-actions">{actions}</div> : null}
    </div>
  );
}
