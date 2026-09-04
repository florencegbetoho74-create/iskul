import { useCallback, useEffect, useState } from "react";

import {
  listUsers,
  setUserAdmin,
  setUserReviewer,
  setUserRole,
  type AdminUser,
} from "../../../lib/admin";
import DataTable, { relativeTime, type Column } from "../../../components/admin/DataTable";
import SearchBar from "../../../components/admin/SearchBar";

const ROLES = ["student", "teacher", "parent", "admin"];
const ROLE_LABEL: Record<string, string> = {
  student: "Élève",
  teacher: "Professeur",
  parent: "Parent",
  admin: "Administrateur",
};

/**
 * Comptes.
 *
 * Donner les droits d'administration est la seule action de la console qui ne
 * se repare pas depuis la console : un administrateur retire peut se remettre.
 * Elle demande donc une confirmation, les autres non.
 */
export default function UsersSection() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      setRows(await listUsers(term));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comptes indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(search);
  }, [load, search]);

  const act = async (userId: string, run: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(userId);
    setError(null);
    try {
      await run();
      await load(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "identity",
      header: "Compte",
      render: (row) => (
        <div className="cell-identity">
          <strong>{row.name || "Sans nom"}</strong>
          <small>{row.email || "—"}</small>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      render: (row) => (
        <select
          value={String(row.role || "student")}
          disabled={busyId === row.id}
          aria-label={`Rôle de ${row.name || row.email || "ce compte"}`}
          onChange={(event) => void act(row.id, () => setUserRole(row.id, event.target.value))}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "rights",
      header: "Droits",
      render: (row) => (
        <div className="cell-rights">
          <button
            type="button"
            className={row.is_admin ? "badge danger" : "badge"}
            disabled={busyId === row.id}
            onClick={() => {
              const next = !row.is_admin;
              if (next && !window.confirm(
                `Donner les droits d'administration à ${row.name || row.email} ? Ce compte pourra tout publier, tout supprimer et modifier les autres comptes.`
              )) {
                return;
              }
              void act(row.id, () => setUserAdmin(row.id, next));
            }}
          >
            {row.is_admin ? "Administrateur" : "Simple compte"}
          </button>
          <button
            type="button"
            className="badge"
            disabled={busyId === row.id}
            onClick={() => void act(row.id, () => setUserReviewer(row.id, true))}
          >
            Nommer relecteur
          </button>
        </div>
      ),
    },
    {
      key: "content",
      header: "Contenus",
      secondary: true,
      render: (row) =>
        `${row.courses_count} cours · ${row.books_count} doc. · ${row.quizzes_count} quiz`,
    },
    {
      key: "seen",
      header: "Vu",
      align: "end",
      render: (row) => relativeTime(row.last_seen_ms),
    },
  ];

  return (
    <div className="stack stack--loose">
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Nom, adresse e-mail…"
        label="Chercher un compte"
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
        emptyTitle={search ? "Aucun compte trouvé" : "Aucun compte"}
        emptyMessage={
          search
            ? "Aucun compte ne correspond à cette recherche."
            : "La plateforme ne compte encore aucun inscrit."
        }
      />
    </div>
  );
}
