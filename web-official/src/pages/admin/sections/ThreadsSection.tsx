import { useCallback, useEffect, useState } from "react";

import { listThreads, type AdminThread } from "../../../lib/admin";
import DataTable, { relativeTime, type Column } from "../../../components/admin/DataTable";
import SearchBar from "../../../components/admin/SearchBar";

/**
 * Conversations.
 *
 * La console montre qui parle a qui, quand, et le dernier message -- pas le fil
 * entier. Un echange entre un professeur et un eleve mineur ne se lit pas par
 * commodite : ce qu'il faut ici, c'est reperer un fil qui derape ou un
 * professeur qui ne repond plus.
 */
export default function ThreadsSection() {
  const [rows, setRows] = useState<AdminThread[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      setRows(await listThreads(term));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversations indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(search);
  }, [load, search]);

  const columns: Column<AdminThread>[] = [
    {
      key: "who",
      header: "Participants",
      render: (row) => (
        <div className="cell-identity">
          <strong>{row.teacher_name || "Professeur"}</strong>
          <small>avec {row.student_name || "un élève"}</small>
        </div>
      ),
    },
    {
      key: "course",
      header: "Cours",
      secondary: true,
      render: (row) => row.course_title || <span className="muted">hors cours</span>,
    },
    {
      key: "last",
      header: "Dernier message",
      render: (row) => (
        <span className="cell-excerpt">{row.last_text || <span className="muted">—</span>}</span>
      ),
    },
    {
      key: "count",
      header: "Messages",
      secondary: true,
      align: "end",
      render: (row) => String(row.message_count ?? 0),
    },
    {
      key: "when",
      header: "Activité",
      align: "end",
      render: (row) => relativeTime(row.last_at_ms),
    },
  ];

  return (
    <div className="stack stack--loose">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Professeur, élève, cours…"
        label="Chercher une conversation"
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
        emptyTitle={search ? "Aucun résultat" : "Aucune conversation"}
        emptyMessage={
          search
            ? "Aucune conversation ne correspond à cette recherche."
            : "Aucun échange n'a encore eu lieu entre professeurs et élèves."
        }
      />
    </div>
  );
}
