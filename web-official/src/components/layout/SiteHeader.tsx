import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import iskulLogo from "../../assets/iskul-logo.png";
import { ANDROID_URL } from "../../config";
import { NAV_ITEMS } from "../../content/site";

/** ---------------------------
 *  Header / Footer
 *  --------------------------*/
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Le fond ne doit pas defiler derriere le menu ouvert.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="site-topline" aria-hidden="true" />
      <div className="container header-content">
        <NavLink className="brand" to="/">
          <img src={iskulLogo} alt="Logo iSkul" className="brand-logo" />
          <span className="brand-text">
            <strong>iSkul</strong>
            <small>Le secondaire, compris.</small>
          </span>
        </NavLink>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls="site-main-nav"
        >
          <span />
          <span />
          <span />
        </button>

        {menuOpen ? <div className="nav-backdrop" onClick={() => setMenuOpen(false)} /> : null}

        <nav id="site-main-nav" className={menuOpen ? "site-nav open" : "site-nav"}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}

          <a
            className="btn primary nav-mobile-cta"
            href={ANDROID_URL}
            target="_blank"
            rel="noreferrer"
          >
            Télécharger l'app
          </a>
          <Link className="btn ghost nav-mobile-cta" to="/inscription-professeur">
            Devenir professeur
          </Link>
        </nav>

        <div className="header-cta desktop-cta">
          <Link className="btn ghost" to="/inscription-professeur">
            Devenir prof
          </Link>
          <a className="btn primary" href={ANDROID_URL} target="_blank" rel="noreferrer">
            Télécharger l'app
          </a>
        </div>
      </div>
    </header>
  );
}
