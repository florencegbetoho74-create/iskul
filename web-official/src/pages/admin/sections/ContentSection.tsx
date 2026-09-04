import { useCallback, useEffect, useState } from "react";

import {
  listBooks,
  listCourses,
  listLives,
  listQuizzes,
  setBookPublished,
  setCoursePublished,
  setLiveStatus,
  setQuizPublished,
  type AdminBook,
  type AdminCourse,
  type AdminLive,
  type AdminQuiz,
} from "../../../lib/admin";
import DataTable, { relativeTime, shortDate, type Column } from "../../../components/admin/DataTable";
import SearchBar from "../../../components/admin/SearchBar";

type Kind = "courses" | "books" | "quizzes" | "lives";

const TABS: { key: Kind; label: string }[] = [
  { key: "courses", label: "Cours" },
  { key: "books", label: "Documents" },
  { key: "quizzes", label: "Quiz" },
  { key: "lives", label: "Séances" },
];

const LIVE_STATUS: Record<string, string> = {
  scheduled: "Programmée",
  live: "En cours",
  ended: "Terminée",
};

type Row = AdminCourse | AdminBook | AdminQuiz | AdminLive;

/**
 * Contenus.
 *
 * Quatre listes derriere un seul jeu d'onglets plutot que quatre sections :
 * l'administrateur cherche un contenu, il ne cherche pas d'abord son type.
 *
 * La bascule de publication n'attend pas le serveur pour se redessiner --
 * l'attente rendrait la liste penible a corriger -- mais elle se remet en
 * place si l'appel echoue.
 */
export default function ContentSection() {
  const [kind, setKind] = useState<Kind>("courses");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (which: Kind, term: string) => {
    setLoading(true);
    setError(null);
    try {
      const loader =
        which === "courses"
          ? listCourses
          : which === "books"
          ? listBooks
          : which === "quizzes"
          ? listQuizzes
          : listLives;
      setRows((await loader(term)) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contenus indisponibles.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(kind, search);
  }, [load, kind, search]);

  const togglePublished = async (id: string, next: boolean) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    const previous = rows;
    setRows((prev) =>
      prev.map((row) => (row.id === id ? ({ ...row, published: next } as Row) : row))
    );
    try {
      if (kind === "courses") await setCoursePublished(id, next);
      else if (kind === "books") await setBookPublished(id, next);
      else await setQuizPublished(id, next);
    } catch (e) {
      // La liste retrouve son etat : laisser une bascule mensongere serait
      // pire que de ne pas l'avoir bougee.
      setRows(previous);
      setError(e instanceof Error ? e.message : "Changement impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const changeLiveStatus = async (id: string, status: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await setLiveStatus(id, status);
      await load(kind, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Changement impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const publishColumn: Column<Row> = {
    key: "published",
    header: "Publication",
    align: "end",
    render: (row) => {
      const published = (row as AdminCourse).published;
      return (
        <button
          type="button"
          className={published ? "badge success" : "badge warning"}
          disabled={busyId === row.id}
          onClick={() => void togglePublished(row.id, !published)}
        >
          {published ? "Publié" : "Brouillon"}
        </button>
      );
    },
  };

  const baseColumns: Column<Row>[] = [
    {
      key: "title",
      header: "Titre",
      render: (row) => (
        <div className="cell-identity">
          <strong>{row.title || "Sans titre"}</strong>
          <small>{row.owner_name || "Auteur inconnu"}</small>
        </div>
      ),
    },
  ];

  const columns: Column<Row>[] =
    kind === "lives"
      ? [
          ...baseColumns,
          {
            key: "start",
            header: "Début",
            secondary: true,
            render: (row) => shortDate((row as AdminLive).start_at_ms),
          },
          {
            key: "status",
            header: "État",
            align: "end",
            render: (row) => (
              <select
                value={String((row as AdminLive).status || "scheduled")}
                disabled={busyId === row.id}
                aria-label={`État de ${row.title || "la séance"}`}
                onChange={(event) => void changeLiveStatus(row.id, event.target.value)}
              >
                {Object.entries(LIVE_STATUS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ),
          },
        ]
      : [
          ...baseColumns,
          {
            key: "meta",
            header: "Classe et matière",
            secondary: true,
            render: (row) => {
              const item = row as AdminCourse;
              return (
                [item.level, item.subject].filter(Boolean).join(" · ") || (
                  <span className="muted">non classé</span>
                )
              );
            },
          },
          ...(kind === "quizzes"
            ? [
                {
                  key: "attempts",
                  header: "Tentatives",
                  secondary: true,
                  render: (row: Row) => String((row as AdminQuiz).attempts ?? 0),
                } as Column<Row>,
              ]
            : []),
          {
            key: "updated",
            header: "Modifié",
            secondary: true,
            render: (row) => relativeTime(row.updated_at_ms),
          },
          publishColumn,
        ];

  return (
    <div className="stack stack--loose">
      <div className="console-tabs" role="tablist" aria-label="Type de contenu">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={kind === tab.key}
            className={kind === tab.key ? "console-tab active" : "console-tab"}
            onClick={() => setKind(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Titre, auteur…"
        label="Chercher un contenu"
      />

      {error ? (
        <div className="notice danger">
          <p>{error}</p>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle={search ? "Aucun résultat" : "Rien à afficher"}
        emptyMessage={
          search
            ? "Aucun contenu ne correspond à cette recherche."
            : "Aucun contenu de ce type pour le moment."
        }
      />
    </div>
  );
}
