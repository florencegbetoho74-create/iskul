import { useCallback, useEffect, useMemo, useState } from "react";

import {
  STAFF_ROLES,
  listStaffRoles,
  listUsers,
  setStaffRoles,
  setUserAdmin,
  setUserRole,
  type AdminUser,
  type StaffRole,
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
 * Comptes et droits.
 *
 * Le role d'usage -- eleve, professeur, parent -- dit ce que la personne fait
 * sur la plateforme. Les roles d'equipe disent ce qu'elle peut decider pour les
 * autres. Les deux sont separes parce qu'ils ne se cumulent pas de la meme
 * facon : un professeur peut relire les cours de ses pairs sans cesser d'etre
 * professeur.
 *
 * Donner les pleins droits est la seule action qui ne se repare pas depuis la
 * console ; elle demande une confirmation, les autres non.
 */
export default function UsersSection() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [staff, setStaff] = useState<Record<string, StaffRole[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openRolesFor, setOpenRolesFor] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      const [users, roles] = await Promise.all([
        listUsers(term),
        listStaffRoles().catch(() => []),
      ]);
      setRows(users);
      setStaff(
        Object.fromEntries(roles.map((row) => [row.user_id, row.staff_roles ?? []]))
      );
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

  const toggleStaffRole = (userId: string, role: StaffRole) => {
    const current = staff[userId] ?? [];
    const next = current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role];
    // La liste locale suit tout de suite : attendre le serveur ferait clignoter
    // les pastilles a chaque clic.
    setStaff((prev) => ({ ...prev, [userId]: next }));
    void act(userId, () => setStaffRoles(userId, next));
  };

  const columns: Column<AdminUser>[] = useMemo(
    () => [
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
        header: "Rôle d'usage",
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
        key: "staff",
        header: "Droits d'équipe",
        render: (row) => {
          const assigned = staff[row.id] ?? [];
          const open = openRolesFor === row.id;
          return (
            <div className="cell-roles">
              <button
                type="button"
                className="badge"
                aria-expanded={open}
                onClick={() => setOpenRolesFor(open ? null : row.id)}
              >
                {row.is_admin
                  ? "Accès complet"
                  : assigned.length
                  ? `${assigned.length} droit${assigned.length > 1 ? "s" : ""}`
                  : "Aucun"}
              </button>

              {open ? (
                <div className="role-picker">
                  {STAFF_ROLES.map((role) => {
                    const checked = row.is_admin || assigned.includes(role.key);
                    return (
                      <label key={role.key} className="role-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          // Un administrateur a deja tout : cocher un role
                          // restreint ne retirerait rien et laisserait croire
                          // le contraire.
                          disabled={row.is_admin || busyId === row.id}
                          onChange={() => toggleStaffRole(row.id, role.key)}
                        />
                        <span>
                          <strong>{role.label}</strong>
                          <small>{role.grants}</small>
                        </span>
                      </label>
                    );
                  })}

                  <div className="role-full">
                    <button
                      type="button"
                      className={row.is_admin ? "btn danger small" : "btn ghost small"}
                      disabled={busyId === row.id}
                      onClick={() => {
                        const next = !row.is_admin;
                        if (
                          next &&
                          !window.confirm(
                            `Donner l'accès complet à ${row.name || row.email} ? Ce compte pourra publier, dépublier et supprimer n'importe quel contenu, et modifier les droits des autres comptes.`
                          )
                        ) {
                          return;
                        }
                        void act(row.id, () => setUserAdmin(row.id, next));
                      }}
                    >
                      {row.is_admin ? "Retirer l'accès complet" : "Donner l'accès complet"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        },
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
    ],
    [busyId, staff, openRolesFor]
  );

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
