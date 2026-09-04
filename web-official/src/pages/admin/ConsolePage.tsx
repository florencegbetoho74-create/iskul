import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import OverviewSection from "./sections/OverviewSection";
import ReviewSection from "./sections/ReviewSection";
import UsersSection from "./sections/UsersSection";
import ContentSection from "./sections/ContentSection";
import ThreadsSection from "./sections/ThreadsSection";
import SettingsSection from "./sections/SettingsSection";

type SectionKey = "overview" | "review" | "content" | "users" | "threads" | "settings";

type Access = "checking" | "anonymous" | "denied" | "reviewer" | "admin";

const SECTIONS: { key: SectionKey; label: string; hint: string; reviewerOk?: boolean }[] = [
  { key: "overview", label: "Vue d'ensemble", hint: "L'etat de la plateforme en un coup d'oeil" },
  {
    key: "review",
    label: "Relecture",
    hint: "Les contenus en attente d'une decision",
    reviewerOk: true,
  },
  { key: "content", label: "Contenus", hint: "Cours, documents, quiz et seances" },
  { key: "users", label: "Comptes", hint: "Rôles, droits et activité" },
  { key: "threads", label: "Conversations", hint: "Les echanges entre professeurs et eleves" },
  { key: "settings", label: "Reglages", hint: "Portail professeur et etat technique" },
];

/**
 * Console d'administration.
 *
 * La verification du droit d'acces faite ici ne protege rien : elle evite
 * seulement d'afficher des sections vides. Ce sont les procedures
 * `security definer` du serveur qui refusent reellement, et elles le font
 * meme si quelqu'un force l'affichage.
 *
 * Un relecteur n'est pas un administrateur : il entre, mais ne voit que la
 * file de relecture.
 */
export default function ConsolePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>("checking");
  const [section, setSection] = useState<SectionKey>("overview");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const checkAccess = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin,is_reviewer,role")
      .eq("id", userId)
      .maybeSingle();

    if (error) return "denied" as const;
    const row = data as { is_admin?: boolean; is_reviewer?: boolean; role?: string } | null;
    if (row?.is_admin || String(row?.role || "").toLowerCase() === "admin") return "admin" as const;
    if (row?.is_reviewer) return "reviewer" as const;
    return "denied" as const;
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session?.user?.id) {
      setAccess(session === null ? "anonymous" : "checking");
      return;
    }
    void checkAccess(session.user.id).then((result) => {
      if (alive) setAccess(result);
    });
    return () => {
      alive = false;
    };
  }, [session, checkAccess]);

  const visible = useMemo(
    () => (access === "admin" ? SECTIONS : SECTIONS.filter((item) => item.reviewerOk)),
    [access]
  );

  useEffect(() => {
    if (visible.some((item) => item.key === section)) return;
    if (visible[0]) setSection(visible[0].key);
  }, [visible, section]);

  if (access === "checking") {
    return (
      <div className="console-gate">
        <p className="lead">Vérification de vos droits…</p>
      </div>
    );
  }

  if (access === "anonymous") {
    return (
      <div className="console-gate">
        <h1>Console iSkul</h1>
        <p className="lead">
          Cette console est réservée a l'équipe. Connectez-vous depuis l'espace professeur avec un
          compte disposant des droits.
        </p>
        <Link className="btn primary" to="/espace-professeur">
          Aller a la connexion
        </Link>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="console-gate">
        <h1>Accès refusé</h1>
        <p className="lead">
          Votre compte n'a ni les droits d'administration ni ceux de relecture. Si vous pensez qu'il
          s'agit d'une erreur, contactez l'équipe iSkul.
        </p>
        <Link className="btn ghost" to="/">
          Revenir au site
        </Link>
      </div>
    );
  }

  const current = visible.find((item) => item.key === section) ?? visible[0];

  return (
    <div className="console">
      <aside className={navOpen ? "console-nav open" : "console-nav"}>
        <div className="console-brand">
          <span className="console-brand-mark" aria-hidden="true">
            iS
          </span>
          <span className="console-brand-text">
            <strong>Console</strong>
            <small>{access === "admin" ? "Administration" : "Relecture"}</small>
          </span>
        </div>

        <nav aria-label="Sections de la console">
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === section ? "console-nav-item active" : "console-nav-item"}
              aria-current={item.key === section ? "page" : undefined}
              onClick={() => {
                setSection(item.key);
                setNavOpen(false);
              }}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>

        <div className="console-nav-foot">
          <Link className="btn ghost small block" to="/">
            Quitter la console
          </Link>
        </div>
      </aside>

      <div className="console-main">
        <header className="console-head">
          <button
            type="button"
            className="console-nav-toggle"
            onClick={() => setNavOpen((open) => !open)}
            aria-expanded={navOpen}
            aria-label="Ouvrir les sections"
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <h1>{current?.label}</h1>
            <p className="console-head-hint">{current?.hint}</p>
          </div>
          <span className="badge primary console-identity">{session?.user?.email}</span>
        </header>

        <div className="console-body">
          {section === "overview" ? <OverviewSection /> : null}
          {section === "review" ? <ReviewSection /> : null}
          {section === "content" ? <ContentSection /> : null}
          {section === "users" ? <UsersSection /> : null}
          {section === "threads" ? <ThreadsSection /> : null}
          {section === "settings" ? <SettingsSection /> : null}
        </div>
      </div>
    </div>
  );
}
