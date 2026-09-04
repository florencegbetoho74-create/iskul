import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import iskulLogo from "../../assets/iskul-logo.png";
import { ANDROID_URL } from "../../config";
import { NAV_ACCOUNTS, NAV_CONTENT, type NavLeaf } from "../../content/site";

/**
 * En-tete.
 *
 * Deux zones qui ne se melangent pas : a gauche ce qui se lit, a droite ce
 * dans quoi on entre. Un espace qui demande une connexion n'a rien a faire
 * dans la meme rangee qu'une page de presentation -- le visiteur croit lire,
 * il tombe sur un formulaire.
 *
 * Un seul appel a l'action principal. Deux boutons de meme poids ne
 * choisissent pas a la place du visiteur, ils l'obligent a choisir.
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [location.pathname]);

  // Le fond ne doit pas defiler derriere le menu ouvert.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Un menu deroulant se ferme a l'echappement et au clic exterieur : sans
  // cela il reste ouvert derriere le contenu et pieger le clavier.
  useEffect(() => {
    if (!openGroup) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openGroup]);

  return (
    <header className="shell-header" ref={headerRef}>
      <div className="shell-header-inner container">
        <NavLink className="shell-brand" to="/" aria-label="iSkul, accueil">
          <img src={iskulLogo} alt="" className="shell-brand-logo" width={40} height={40} />
          <span className="shell-brand-text">
            <strong>iSkul</strong>
            <small>Le secondaire, compris.</small>
          </span>
        </NavLink>

        <button
          className="shell-burger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="shell-nav"
        >
          <span />
          <span />
          <span />
        </button>

        {menuOpen ? (
          <div className="shell-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        ) : null}

        <div id="shell-nav" className={menuOpen ? "shell-nav open" : "shell-nav"}>
          <nav className="shell-nav-content" aria-label="Navigation principale">
            {NAV_CONTENT.map((entry) =>
              entry.children ? (
                <div key={entry.label} className="shell-group">
                  <button
                    type="button"
                    className="shell-nav-link shell-group-trigger"
                    aria-expanded={openGroup === entry.label}
                    onClick={() =>
                      setOpenGroup((current) => (current === entry.label ? null : entry.label))
                    }
                  >
                    {entry.label}
                    <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true">
                      <path
                        d="M1 1.5 6 6.5 11 1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  <div
                    className={openGroup === entry.label ? "shell-panel open" : "shell-panel"}
                  >
                    {entry.children.map((child) => (
                      <PanelLink key={child.to} item={child} />
                    ))}
                  </div>
                </div>
              ) : (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.end}
                  className={({ isActive }) =>
                    isActive ? "shell-nav-link active" : "shell-nav-link"
                  }
                >
                  {entry.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="shell-actions">
            <div className="shell-group shell-group--end">
              <button
                type="button"
                className="btn ghost small shell-group-trigger"
                aria-expanded={openGroup === "comptes"}
                onClick={() =>
                  setOpenGroup((current) => (current === "comptes" ? null : "comptes"))
                }
              >
                Se connecter
                <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true">
                  <path
                    d="M1 1.5 6 6.5 11 1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className={openGroup === "comptes" ? "shell-panel open" : "shell-panel"}>
                {NAV_ACCOUNTS.map((item) => (
                  <PanelLink key={item.to} item={item} />
                ))}
              </div>
            </div>

            <a className="btn primary small" href={ANDROID_URL} target="_blank" rel="noreferrer">
              Télécharger l'app
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function PanelLink({ item }: { item: NavLeaf }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => (isActive ? "shell-panel-link active" : "shell-panel-link")}
    >
      <strong>{item.label}</strong>
      {item.hint ? <small>{item.hint}</small> : null}
    </NavLink>
  );
}
