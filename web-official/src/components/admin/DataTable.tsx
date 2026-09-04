import type { ReactNode } from "react";

/**
 * Tableau de la console.
 *
 * Une seule implementation pour les six listes : sans elle, chaque section
 * redessine ses en-tetes et ses etats vides, et les six finissent par diverger.
 * Le tableau ne sait rien du contenu ; il sait rendre une colonne, une ligne
 * vide et un chargement.
 */

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Colonne secondaire, masquee sur petit ecran. */
  secondary?: boolean;
  align?: "start" | "end";
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle: string;
  emptyMessage: string;
  /** Nombre de lignes de squelette pendant le chargement. */
  skeletonRows?: number;
};

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyTitle,
  emptyMessage,
  skeletonRows = 6,
}: Props<T>) {
  if (loading) {
    return (
      <div className="table-wrap" aria-busy="true">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.secondary ? "col-secondary" : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className={column.secondary ? "col-secondary" : undefined}>
                    <span className="skeleton skeleton-cell" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="empty">
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.secondary ? "col-secondary" : undefined}
                style={column.align === "end" ? { textAlign: "right" } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.secondary ? "col-secondary" : undefined}
                  style={column.align === "end" ? { textAlign: "right" } : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Date courte. Une console se lit en diagonale : l'heure suffit rarement. */
export function shortDate(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Anciennete relative : "il y a 3 jours" se lit plus vite qu'une date. */
export function relativeTime(ms?: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return shortDate(ms);
}
