import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import iskulLogo from "./assets/iskul-logo.png";
import { OFFICIAL_WEB_ENV_ERROR, supabase } from "./lib/supabase";
import ParentTrackingPage from "./pages/ParentTrackingPage";
import TeacherWorkspacePage from "./pages/TeacherWorkspacePage";
import { useRouteSeo } from "./seo";
import "./styles.css";

type FeatureVisual = {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
};

type PasswordStrength = {
  score: number;
  label: string;
  tone: "weak" | "medium" | "strong";
  percent: number;
};

/** ---------------------------
 *  CONFIG / ENV
 *  --------------------------*/
type AppReleaseStatus = "coming_soon" | "live";

const APP_RELEASE_STATUS: AppReleaseStatus =
  (import.meta.env.VITE_APP_RELEASE_STATUS || "live") === "live" ? "live" : "coming_soon";

const IS_APP_LIVE = APP_RELEASE_STATUS === "live";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.iskuledu.app";
const ANDROID_URL = (import.meta.env.VITE_ANDROID_URL || "").trim() || PLAY_STORE_URL;
const IOS_URL = (import.meta.env.VITE_IOS_URL || "").trim();

// Optionnel : blog externe si tu veux
const BLOG_URL = (import.meta.env.VITE_BLOG_URL || "").trim();

// Support email (affiche uniquement sur inscription prof si besoin)
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "support@iskul.app").trim();

/** ---------------------------
 *  NAVIGATION
 *  --------------------------*/
const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/cours", label: "Cours & Quiz" },
  { to: "/bibliotheque", label: "Bibliotheque" },
  { to: "/open-classroom", label: "Open Classroom" },
  { to: "/parents", label: "Espace parents" },
  { to: "/espace-professeur", label: "Espace professeur" },
  { to: "/a-propos", label: "A propos" },
  { to: "/contact", label: "Contact" },
];

const HERO_VISUALS: FeatureVisual[] = [
  {
    id: "classroom-live",
    title: "Open Classroom (Live)",
    caption: "Sessions en direct : explications, questions-reponses, methodologie et entrainements.",
    imageUrl:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "local-language",
    title: "Francais + langues locales",
    caption: "Des explications accessibles pour comprendre rapidement, sans barriere de langue.",
    imageUrl:
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "learning-metrics",
    title: "Quiz & statistiques",
    caption: "Quiz par sequence, progression, scores et regularite : des indicateurs clairs.",
    imageUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  },
];

const OPEN_CLASSROOM_EVENTS = [
  { day: "Lundi", hour: "18h00", topic: "Mathematiques : fonctions et applications", teacher: "Equipe iSkul Maths" },
  { day: "Mercredi", hour: "19h00", topic: "Francais : methode du commentaire de texte", teacher: "Equipe iSkul Langues" },
  { day: "Samedi", hour: "10h00", topic: "Orientation + revision intelligente", teacher: "Mentors iSkul" },
];

/** ---------------------------
 *  HELPERS
 *  --------------------------*/
function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function mapTeacherSignupError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  if (!msg) return "Inscription impossible pour le moment.";
  if (msg.includes("portal_closed")) return "Le portail professeur est temporairement ferme.";
  if (msg.includes("domain_not_allowed")) return "Domaine email non autorise pour ce portail.";
  if (msg.includes("already") || msg.includes("registered")) return "Cette adresse email est deja utilisee.";
  if (msg.includes("weak_password")) return "Mot de passe trop faible (8 caracteres minimum).";
  if (msg.includes("invalid_email")) return "Adresse email invalide.";
  if (msg.includes("missing_fields")) return "Veuillez remplir tous les champs obligatoires.";
  if (msg.includes("failed to fetch") || msg.includes("functionsfetcherror")) {
    return "Connexion au serveur impossible. Verifiez votre connexion puis reessayez.";
  }
  if (msg.includes("server_misconfigured")) return "Service d'inscription temporairement indisponible.";
  return "Inscription impossible. Verifiez les champs et reessayez.";
}

async function resolveTeacherSignupError(err: unknown): Promise<string> {
  const anyErr = err as {
    message?: string;
    context?: { json?: () => Promise<{ error?: string; message?: string }> };
  };

  let message = String(anyErr?.message || "");

  if (anyErr?.context?.json) {
    try {
      const payload = await anyErr.context.json();
      if (payload?.error) message += ` ${payload.error}`;
      if (payload?.message) message += ` ${payload.message}`;
    } catch {
      // ignore context parsing issues
    }
  }

  return mapTeacherSignupError({ message });
}

function mapContactError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  if (!msg) return "Impossible d'envoyer le message pour le moment.";
  if (msg.includes("missing_fields")) return "Veuillez remplir tous les champs obligatoires.";
  if (msg.includes("invalid_email")) return "Adresse email invalide.";
  if (msg.includes("message_too_short")) return "Votre message est trop court.";
  if (msg.includes("message_too_long")) return "Votre message est trop long.";
  if (msg.includes("contact_storage_not_configured")) {
    return "Le service de contact est temporairement indisponible.";
  }
  if (msg.includes("contact_store_failed") || msg.includes("internal_error")) {
    return "Le service de contact est temporairement indisponible.";
  }
  if (msg.includes("invalid_payload")) return "Le message n'a pas pu etre traite.";
  if (msg.includes("server_misconfigured")) return "Le service de contact est temporairement indisponible.";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("functionsfetcherror") ||
    msg.includes("failed to send a request to the edge function")
  ) {
    return "Connexion au serveur impossible. Verifiez votre connexion puis reessayez.";
  }
  if (msg.includes("404") || msg.includes("function not found") || msg.includes("non-2xx")) {
    return "Le service de contact n'est pas encore deploye.";
  }
  return "Impossible d'envoyer le message pour le moment. Reessayez dans quelques instants.";
}

async function resolveContactError(err: unknown): Promise<string> {
  const anyErr = err as {
    message?: string;
    context?: { json?: () => Promise<{ error?: string; message?: string }> };
  };

  let message = String(anyErr?.message || "");

  if (anyErr?.context?.json) {
    try {
      const payload = await anyErr.context.json();
      if (payload?.error) message += ` ${payload.error}`;
      if (payload?.message) message += ` ${payload.message}`;
    } catch {
      // ignore context parsing issues
    }
  }

  return mapContactError({ message });
}

function mapAccountDeletionRequestError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  if (!msg) return "Impossible d'enregistrer la demande de suppression pour le moment.";
  if (msg.includes("missing_email")) return "Veuillez renseigner l'adresse email du compte a supprimer.";
  if (msg.includes("invalid_email")) return "Adresse email invalide.";
  if (msg.includes("missing_reason")) return "Merci d'indiquer un motif ou un contexte.";
  if (msg.includes("reason_too_short")) return "Votre message est trop court.";
  if (msg.includes("deletion_storage_not_configured")) {
    return "Le service de suppression de compte est temporairement indisponible.";
  }
  if (msg.includes("deletion_request_failed") || msg.includes("internal_error")) {
    return "La demande n'a pas pu etre enregistree pour le moment.";
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("functionsfetcherror") ||
    msg.includes("failed to send a request to the edge function")
  ) {
    return "Connexion au serveur impossible. Verifiez votre connexion puis reessayez.";
  }
  if (msg.includes("404") || msg.includes("function not found") || msg.includes("non-2xx")) {
    return "Le service de suppression de compte n'est pas encore deploye.";
  }
  return "Impossible d'enregistrer la demande de suppression pour le moment.";
}

async function resolveAccountDeletionRequestError(err: unknown): Promise<string> {
  const anyErr = err as {
    message?: string;
    context?: { json?: () => Promise<{ error?: string; message?: string }> };
  };

  let message = String(anyErr?.message || "");

  if (anyErr?.context?.json) {
    try {
      const payload = await anyErr.context.json();
      if (payload?.error) message += ` ${payload.error}`;
      if (payload?.message) message += ` ${payload.message}`;
    } catch {
      // ignore malformed payloads
    }
  }

  return mapAccountDeletionRequestError({ message });
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Faible", tone: "weak", percent: 30 };
  if (score <= 3) return { score, label: "Moyen", tone: "medium", percent: 65 };
  return { score, label: "Solide", tone: "strong", percent: 100 };
}

/** ---------------------------
 *  UX - Scroll / SEO
 *  --------------------------*/
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

function SeoHead() {
  const { pathname } = useLocation();
  useRouteSeo(pathname);
  return null;
}

/** ---------------------------
 *  Icons (inline SVG, cohérents)
 *  --------------------------*/
function GooglePlayIcon() {
  return (
    <svg className="store-badge-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path fill="#00d3ff" d="M48 59.5C45.4 63.2 44 68.5 44 75.2v361.6c0 6.7 1.4 12 4 15.7l1.6 1.6 202.6-202.6v-4.8L49.6 57.9 48 59.5z" />
      <path fill="#ffce00" d="M319.3 324.8 251.7 257v-4.8l67.6-67.6 1.5.9 80 45.5c22.9 13 22.9 34.3 0 47.3l-80 45.5-1.5.7z" />
      <path fill="#ff3d47" d="M320.8 324.1 251.7 255 48 458.5c7.5 8 20 9 34 1l238.8-135.4" />
      <path fill="#00f076" d="M320.8 185.9 82 50.5c-14-8-26.5-7-34 1l203.7 203.5 69.1-69.1z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="store-badge-icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

/** ---------------------------
 *  Store Badges (Google Play / App Store)
 *  --------------------------*/
function StoreButton({
  platform,
}: {
  platform: "android" | "ios";
  /** Conservé pour compatibilité d'appel, l'apparence est désormais celle d'un badge store. */
  variant?: "primary" | "secondary";
}) {
  if (platform === "ios") {
    return (
      <span className="store-badge ios soon" aria-disabled="true">
        <AppleIcon />
        <span className="store-badge-text">
          <small>Bientot sur</small>
          <strong>App Store</strong>
        </span>
        <span className="store-badge-tag">Bientot</span>
      </span>
    );
  }

  if (!IS_APP_LIVE) {
    return (
      <span className="store-badge android soon" aria-disabled="true">
        <GooglePlayIcon />
        <span className="store-badge-text">
          <small>Bientot sur</small>
          <strong>Google Play</strong>
        </span>
        <span className="store-badge-tag">Bientot</span>
      </span>
    );
  }

  return (
    <a className="store-badge android" href={ANDROID_URL} target="_blank" rel="noreferrer">
      <GooglePlayIcon />
      <span className="store-badge-text">
        <small>Disponible sur</small>
        <strong>Google Play</strong>
      </span>
    </a>
  );
}


/** ---------------------------
 *  Header / Footer
 *  --------------------------*/
function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container header-content">
        <NavLink className="brand" to="/">
          <img src={iskulLogo} alt="Logo iSkul" className="brand-logo" />
          <span className="brand-text">
            <strong>iSkul</strong>
            <small>Comprendre. Tester. Progresser.</small>
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
            Telecharger l'app
          </a>
          <Link className="btn ghost nav-mobile-cta" to="/inscription-professeur">
            Devenir professeur
          </Link>
        </nav>

        <div className="header-cta desktop-cta">
          <Link className="btn ghost" to="/inscription-professeur">
            Devenir professeur
          </Link>
          <a className="btn primary" href={ANDROID_URL} target="_blank" rel="noreferrer">
            Telecharger l'app
          </a>
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <NavLink className="footer-brand-row" to="/">
            <img src={iskulLogo} alt="Logo iSkul" className="footer-logo" />
            <span className="footer-title">iSkul</span>
          </NavLink>
          <p>
            Plateforme EdTech : videos par chapitre, quiz de comprehension, statistiques de progression, Open Classroom
            en live, et bibliotheque pedagogique.
          </p>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Navigation</span>
          <div className="footer-links">
            <Link to="/cours">Cours &amp; Quiz</Link>
            <Link to="/bibliotheque">Bibliotheque</Link>
            <Link to="/open-classroom">Open Classroom</Link>
            <Link to="/parents">Espace parents</Link>
            <Link to="/inscription-professeur">Devenir professeur</Link>
          </div>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Ressources</span>
          <div className="footer-links">
            <Link to="/contact">Contact</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/politique-confidentialite">Politique de confidentialite</Link>
            <Link to="/delete-account">Suppression de compte</Link>
            <Link to="/mentions-legales">Mentions legales</Link>
            {BLOG_URL ? (
              <a href={BLOG_URL} target="_blank" rel="noreferrer">
                Blog
              </a>
            ) : null}
          </div>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Application</span>
          <div className="footer-download">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
          </div>
          <p className="footer-app-note">iSkul est disponible sur Google Play. Version iOS bientot disponible.</p>
        </div>
      </div>
      <p className="footer-copy">iSkul (c) 2026 - Comprendre, tester, progresser.</p>
    </footer>
  );
}

/** ---------------------------
 *  Pages
 *  --------------------------*/
function HomePage() {
  const [activeVisual, setActiveVisual] = useState(HERO_VISUALS[0].id);
  const currentVisual = useMemo(
    () => HERO_VISUALS.find((item) => item.id === activeVisual) || HERO_VISUALS[0],
    [activeVisual]
  );

  return (
    <div className="home">
      {/* HERO */}
      <section className="hero container">
        <div className="hero-copy">
          <span className="kicker">Videos - Quiz - Statistiques - Open Classroom</span>
          <h1>Comprendre ses cours, vraiment.</h1>
          <p className="lead">
            iSkul transforme chaque chapitre en une video claire (en francais et en langues locales), suivie d'un quiz
            et d'un suivi de progression. L'eleve avance avec confiance. Le parent suit sans pression. Le professeur
            accompagne avec des indicateurs concrets.
          </p>

          <div className="hero-actions">
            <div className="store-badges">
              <StoreButton platform="android" variant="primary" />
              <StoreButton platform="ios" variant="secondary" />
            </div>
            <Link className="btn ghost" to="/inscription-professeur">
              Devenir professeur iSkul
            </Link>
          </div>

          <div className="hero-trust">
            <div className="trust-item">
              <strong>Videos par chapitre</strong>
              <span>Explications structurees et faciles a suivre</span>
            </div>
            <div className="trust-item">
              <strong>Quiz par sequence</strong>
              <span>On verifie la comprehension, pas la chance</span>
            </div>
            <div className="trust-item">
              <strong>Statistiques</strong>
              <span>Progression, scores, regularite</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-stage">
            <img src={currentVisual.imageUrl} alt={currentVisual.title} />
            <div className="visual-overlay">
              <strong>{currentVisual.title}</strong>
              <p>{currentVisual.caption}</p>
            </div>
          </div>

          <div className="visual-thumbs" role="tablist" aria-label="Fonctionnalites iSkul">
            {HERO_VISUALS.map((visual) => (
              <button
                key={visual.id}
                className={visual.id === activeVisual ? "thumb active" : "thumb"}
                onClick={() => setActiveVisual(visual.id)}
                type="button"
                role="tab"
                aria-selected={visual.id === activeVisual}
              >
                {visual.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PROMESSE */}
      <section className="section container">
        <div className="section-head">
          <span className="kicker">Pourquoi iSkul</span>
          <h2>Quand la langue devient une barriere, la comprehension s'effondre.</h2>
        </div>

        <p className="lead">
          Beaucoup d'eleves finissent par "memoriser" sans comprendre. iSkul remet la comprehension au centre grace a
          des explications accessibles, des quiz immediats et un suivi clair de la progression.
        </p>

        <div className="three-cols">
          <article className="info-card">
            <h3>Comprendre d'abord</h3>
            <p>Une video par chapitre, construite pour expliquer clairement (et pas juste reciter).</p>
          </article>

          <article className="info-card">
            <h3>Verifier ensuite</h3>
            <p>Un quiz par sequence pour confirmer la comprehension et detecter les points a revoir.</p>
          </article>

          <article className="info-card">
            <h3>Progresser durablement</h3>
            <p>Statistiques personnelles : scores, progression, regularite, et points forts.</p>
          </article>
        </div>
      </section>

      {/* FLOW ELEVE */}
      <section className="section container">
        <div className="section-head">
          <span className="kicker">Parcours eleve</span>
          <h2>Un flow simple : apprendre, tester, suivre.</h2>
        </div>

        <div className="grid-cards">
          <article className="content-card">
            <h3>1. Je regarde la video</h3>
            <p className="muted">Chaque chapitre est explique avec des exemples concrets, en francais et en langues locales.</p>
          </article>

          <article className="content-card">
            <h3>2. Je fais le quiz</h3>
            <p className="muted">
              Les questions valident la comprehension. On identifie ce qui est acquis et ce qui doit etre revu.
            </p>
          </article>

          <article className="content-card">
            <h3>3. Je consulte mes statistiques</h3>
            <p className="muted">
              Progression, scores par matiere, regularite : je sais exactement quoi reviser ensuite.
            </p>
          </article>
        </div>

        <div className="hero-actions" style={{ marginTop: 18 }}>
          <Link className="btn ghost" to="/cours">
            Decouvrir Cours & Quiz
          </Link>
          <Link className="btn ghost" to="/bibliotheque">
            Explorer la bibliotheque
          </Link>
          <Link className="btn ghost" to="/open-classroom">
            Voir l'Open Classroom
          </Link>
        </div>
      </section>

      {/* OPEN CLASSROOM */}
      <section className="section container panel">
        <div className="section-head">
          <span className="kicker">Open Classroom</span>
          <h2>Des sessions live pour debloquer les points difficiles.</h2>
        </div>
        <p>
          L'Open Classroom iSkul, ce sont des sessions interactives : explications, questions-reponses, methodes et
          entrainements. Ideal pour reprendre confiance et progresser plus vite.
        </p>
        <div className="hero-actions">
          <Link className="btn primary" to="/open-classroom">
            Voir le planning live
          </Link>
        </div>
      </section>

      {/* PARENTS */}
      <section className="section container panel parents-panel">
        <div className="section-head">
          <span className="kicker">Espace parents</span>
          <h2>Suivre la progression, sans surveiller l'enfant.</h2>
        </div>
        <p>
          L'espace parents permet de consulter les statistiques liees au compte de l'eleve : progression, scores, et
          regularite. Une vue claire, sans pression inutile.
        </p>
        <div className="hero-actions">
          <Link className="btn ghost" to="/parents">
            Acceder a l'espace parents
          </Link>
        </div>
      </section>

      {/* PROF */}
      <section className="section container panel">
        <div className="section-head">
          <span className="kicker">Espace professeur</span>
          <h2>Une vue claire sur la performance et l'engagement.</h2>
        </div>
        <p>
          Sur le web, l'enseignant consulte des indicateurs detailles. Pour creer et organiser les contenus, l'experience
          complete se fait dans l'application iSkul.
        </p>
        <div className="hero-actions">
          <Link className="btn secondary" to="/inscription-professeur">
            Devenir professeur iSkul
          </Link>
          <Link className="btn ghost" to="/espace-professeur">
            Ouvrir l'espace professeur
          </Link>
        </div>
      </section>

      {/* BIBLIOTHEQUE */}
      <section className="section container panel library-panel">
        <div className="section-head">
          <span className="kicker">Bibliotheque</span>
          <h2>Documents pedagogiques et livres, a portee de main.</h2>
        </div>
        <p>
          Une bibliotheque pour approfondir : documents pedagogiques, supports structures, et ressources de lecture. De
          quoi reviser, comprendre et consolider.
        </p>
      </section>

      {/* CTA FINAL - bande de telechargement */}
      <section className="section container">
        <div className="app-cta-band">
          <div className="app-cta-copy">
            <span className="kicker app-cta-kicker">Application iSkul</span>
            <h2>Telechargez iSkul et apprenez ou que vous soyez.</h2>
            <p>
              Videos par chapitre, quiz de comprehension et statistiques de progression, directement sur votre
              telephone. Gratuit, leger et pense pour le terrain.
            </p>
            <div className="app-cta-badges store-badges">
              <StoreButton platform="android" variant="primary" />
              <StoreButton platform="ios" variant="secondary" />
            </div>
            <p className="app-cta-note">Disponible des maintenant sur Google Play - iOS bientot disponible.</p>
          </div>
          <div className="app-cta-glow" aria-hidden="true">
            <img src={iskulLogo} alt="" className="app-cta-logo" />
          </div>
        </div>
      </section>
    </div>
  );
}

function CoursesPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Cours & Quiz</span>
        <h1>Des cours structures pour comprendre avant de memoriser</h1>
        <p>
          Chaque cours iSkul suit la meme logique : video explicative, quiz de comprehension, statistiques de progression.
        </p>
      </header>

      <section className="section">
        <h2>Ce que contient un cours iSkul</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Video par chapitre</h3>
            <p>Explication claire, structuree, en francais et en langues locales.</p>
          </article>

          <article className="content-card">
            <h3>Quiz par sequence</h3>
            <p>Questions ciblees pour tester la comprehension immediate.</p>
          </article>

          <article className="content-card">
            <h3>Statistiques personnelles</h3>
            <p>Suivi des scores, progression par matiere et par chapitre.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>Niveaux concernes</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>College</h3>
            <p>Programmes structures par classe et matiere.</p>
          </article>

          <article className="content-card">
            <h3>Lycee</h3>
            <p>Approfondissement, methodologie et preparation aux examens.</p>
          </article>

          <article className="content-card">
            <h3>Examens</h3>
            <p>Revisions ciblees et quiz d'entrainement.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function LibraryPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Bibliotheque</span>
        <h1>Documents pedagogiques, livres et ressources utiles</h1>
        <p>
          Une bibliotheque pour lire, reviser et approfondir : supports scolaires, documents pedagogiques et ressources
          de reference.
        </p>
      </header>

      <div className="three-cols">
        <article className="content-card">
          <h3>Documents pedagogiques</h3>
          <p>Fiches, supports de cours, exercices et documents structures par matiere et niveau.</p>
        </article>
        <article className="content-card">
          <h3>Livres & lecture</h3>
          <p>Ouvrages utiles pour la culture generale, la lecture et la consolidation des acquis.</p>
        </article>
        <article className="content-card">
          <h3>Ressources mises a jour</h3>
          <p>Une amelioration continue des contenus pour rester aligne sur les besoins du terrain.</p>
        </article>
      </div>
    </div>
  );
}

function OpenClassroomPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Open Classroom</span>
        <h1>Le planning live pour apprendre en direct</h1>
        <p>Sessions interactives : explications, questions-reponses, methodologie et entrainements.</p>
      </header>

      <div className="grid-cards">
        {OPEN_CLASSROOM_EVENTS.map((event) => (
          <article key={`${event.day}-${event.hour}`} className="content-card">
            <h3>
              {event.day} - {event.hour}
            </h3>
            <p>{event.topic}</p>
            <p className="muted">{event.teacher}</p>
          </article>
        ))}
      </div>

      <section className="panel archive-panel">
        <h2>Archives (replays)</h2>
        <p>
          Les replays restent disponibles pour revoir les points difficiles, avancer a son rythme et consolider chaque
          chapitre.
        </p>
      </section>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">A propos</span>
        <h1>Pourquoi iSkul existe</h1>
        <p>
          Notre mission : rendre la comprehension scolaire accessible, en respectant la langue, la culture et le rythme
          d'apprentissage de chaque eleve.
        </p>
      </header>

      <section className="panel">
        <h2>Comprendre change tout</h2>
        <p>
          Quand un eleve comprend vraiment, il reprend confiance. iSkul combine technologie et pedagogie pour transformer
          la comprehension en progres mesurables.
        </p>
      </section>
    </div>
  );
}

/** ---------------------------
 *  Contact (email invisible)
 *  - Necessite une Edge Function: "contact-message"
 *  --------------------------*/
function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (busy || OFFICIAL_WEB_ENV_ERROR) return true;
    if (!name.trim() || !email.trim() || !message.trim()) return true;
    if (!isEmail(email.trim())) return true;
    return false;
  }, [busy, name, email, message]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setBusy(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("contact-message", {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim(),
          source: "website",
        },
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(`${data?.error || "contact_failed"} ${data?.message || ""}`.trim());
      }

      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(await resolveContactError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Contact</span>
        <h1>Ecrivez-nous</h1>
        <p>Une question, une collaboration, une demande institutionnelle ? Envoyez-nous un message.</p>
      </header>

      {OFFICIAL_WEB_ENV_ERROR ? <p className="notice error">{OFFICIAL_WEB_ENV_ERROR}</p> : null}

      {sent ? (
        <p className="notice success">Votre message a bien ete envoye. Nous vous repondrons des que possible.</p>
      ) : (
        <form className="content-card" onSubmit={submit}>
          <label className="form-field">
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
          </label>

          <label className="form-field">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              autoComplete="email"
            />
          </label>

          <label className="form-field">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Expliquez votre besoin..."
              rows={6}
            />
          </label>

          {error ? <p className="notice error">{error}</p> : null}

          <div className="hero-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" disabled={disabled}>
              {busy ? "Envoi..." : "Envoyer"}
            </button>
            <Link className="btn ghost" to="/faq">
              Voir la FAQ
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function FaqPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">FAQ</span>
        <h1>Questions frequentes</h1>
        <p>Voici les reponses aux questions les plus courantes sur iSkul.</p>
      </header>

      <div className="content-card">
        <h3>L'application iSkul est-elle deja disponible ?</h3>
        <p>
          Oui. iSkul est disponible des maintenant sur Google Play (Android). La version iOS arrive prochainement :
          le bouton "App Store" affiche "Bientot" en attendant.
        </p>

        <h3>En quelles langues sont les cours ?</h3>
        <p>Les cours sont en francais et progressivement en langues locales, pour faciliter la comprehension.</p>

        <h3>Comment fonctionnent les quiz ?</h3>
        <p>Chaque sequence est suivie d'un quiz de comprehension. Les resultats alimentent vos statistiques.</p>

        <h3>A quoi sert l'espace parents ?</h3>
        <p>L'espace parents permet de consulter les statistiques liees au compte de l'eleve (progression, scores, regularite).</p>

        <h3>A quoi sert l'espace professeur sur le web ?</h3>
        <p>
          Le web sert surtout a consulter des statistiques detaillees. La creation/organisation des contenus est pensee
          pour l'application iSkul.
        </p>
      </div>
    </div>
  );
}

function DeleteAccountPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (busy || OFFICIAL_WEB_ENV_ERROR) return true;
    if (!email.trim() || !reason.trim()) return true;
    if (!isEmail(email.trim())) return true;
    if (!accepted) return true;
    return false;
  }, [accepted, busy, email, reason]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setBusy(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("account-deletion-request", {
        body: {
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          reason: reason.trim(),
          source: "website-delete-account",
        },
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(`${data?.error || "deletion_request_failed"} ${data?.message || ""}`.trim());
      }

      setSent(true);
      setName("");
      setEmail("");
      setReason("");
      setAccepted(false);
    } catch (err) {
      setError(await resolveAccountDeletionRequestError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Suppression de compte</span>
        <h1>Demander la suppression de votre compte iSkul</h1>
        <p>
          Utilisez ce formulaire si vous n'avez plus acces a l'application. Si vous etes connecte dans l'app iSkul,
          utilisez en priorite le menu <strong>Reglages &gt; Supprimer mon compte</strong>.
        </p>
      </header>

      <section className="content-card">
        <h3>Ce que traite cette demande</h3>
        <ul className="policy-list">
          <li>fermeture du compte utilisateur iSkul concerne ;</li>
          <li>suppression ou anonymisation des donnees associees, sous reserve des obligations legales ou de securite ;</li>
          <li>prise en charge par l'equipe iSkul a partir de l'email fourni.</li>
        </ul>
        <p className="policy-note">
          Pour toute autre question, utilisez aussi la page <Link to="/contact">Contact</Link> ou consultez la{" "}
          <Link to="/politique-confidentialite">Politique de confidentialite</Link>.
        </p>
      </section>

      {OFFICIAL_WEB_ENV_ERROR ? <p className="notice error">{OFFICIAL_WEB_ENV_ERROR}</p> : null}

      {sent ? (
        <p className="notice success">
          Votre demande de suppression a bien ete enregistree. Nous reviendrons vers vous si une verification
          supplementaire est necessaire.
        </p>
      ) : (
        <form className="content-card" onSubmit={submit}>
          <label className="form-field">
            Nom (optionnel)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
          </label>

          <label className="form-field">
            Email du compte iSkul
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              autoComplete="email"
            />
          </label>

          <label className="form-field">
            Motif ou contexte
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Precisez la demande de suppression (ex. : je souhaite supprimer definitivement mon compte iSkul)."
              rows={6}
            />
          </label>

          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Je confirme etre autorise a demander la suppression de ce compte et comprendre que cette action est irreversible une fois traitee.</span>
          </label>

          {error ? <p className="notice error">{error}</p> : null}

          <div className="hero-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" disabled={disabled}>
              {busy ? "Envoi..." : "Envoyer la demande"}
            </button>
            <Link className="btn ghost" to="/contact">
              Contacter iSkul
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function LegalPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Mentions legales</span>
        <h1>Informations legales</h1>
        <p>Ce contenu est un minimum. Il peut etre complete selon votre structure juridique et vos obligations locales.</p>
      </header>

      <section className="content-card">
        <h3>Editeur</h3>
        <p>iSkul - Plateforme EdTech (informations d'editeur a completer).</p>

        <h3>Politique de confidentialite</h3>
        <p>
          La politique de confidentialite detaillee est disponible sur la page{" "}
          <Link to="/politique-confidentialite">Politique de confidentialite</Link>.
        </p>

        <h3>Suppression de compte</h3>
        <p>
          Une page dediee permet de demander la suppression du compte iSkul :{" "}
          <Link to="/delete-account">Suppression de compte</Link>.
        </p>

        <h3>Responsabilite</h3>
        <p>
          iSkul met a disposition des contenus pedagogiques et des fonctionnalites de suivi. Malgre notre attention,
          des erreurs peuvent exister. Les informations sont susceptibles d'evoluer.
        </p>

        <h3>Donnees personnelles</h3>
        <p>
          Les donnees sont utilisees pour fournir les services (progression, statistiques, experience utilisateur).
          Pour toute demande liee aux donnees, utilisez le formulaire de contact.
        </p>

        <h3>Contact</h3>
        <p>
          Pour nous joindre, utilisez la page <Link to="/contact">Contact</Link>.
        </p>
      </section>
    </div>
  );
}

function PrivacyPolicyPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Politique de confidentialite</span>
        <h1>Protection des donnees personnelles sur iSkul</h1>
        <p>
          Derniere mise a jour : 14 avril 2026. Cette politique explique quelles donnees iSkul traite,
          pourquoi elles sont utilisees et comment les utilisateurs peuvent exercer leurs droits.
        </p>
      </header>

      <section className="content-card">
        <p className="policy-meta">
          Service concerne : application mobile iSkul, site public iSkul et services associes.
        </p>
        <p className="policy-meta">
          Contact : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou via la page{" "}
          <Link to="/contact">Contact</Link>.
        </p>
        <p>
          iSkul est une plateforme educative qui propose des cours, quiz, bibliotheque pedagogique,
          messagerie et classes live. Certaines fonctionnalites impliquent l'utilisation de donnees de
          compte, de fichiers, de la camera, du microphone ou de notifications.
        </p>
      </section>

      <section className="policy-grid">
        <article className="content-card">
          <h3>1. Donnees que nous collectons</h3>
          <ul className="policy-list">
            <li>Informations de compte : nom, email, role, identifiants techniques de session.</li>
            <li>Donnees d'apprentissage : progression, scores de quiz, regularite, historique de cours et notes.</li>
            <li>Messagerie : contenu des conversations et pieces jointes envoye es dans l'application.</li>
            <li>Fichiers importes : videos, documents pedagogiques, images de profil ou autres contenus soumis par les utilisateurs.</li>
            <li>Donnees live : identifiants techniques de session, participation aux classes live, reactions et questions.</li>
            <li>Notifications : token push Expo si l'utilisateur autorise les notifications.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>2. Camera et microphone</h3>
          <ul className="policy-list">
            <li>La camera et le microphone sont demandes uniquement pour les fonctionnalites de classe live.</li>
            <li>Ces acces servent a permettre la participation audio et video pendant une session en direct.</li>
            <li>Ils ne sont pas necessaires pour consulter les cours, quiz, bibliotheque ou statistiques.</li>
            <li>L'utilisateur peut refuser ces permissions, mais les fonctions live concernees seront limitees.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid">
        <article className="content-card">
          <h3>3. Finalites du traitement</h3>
          <ul className="policy-list">
            <li>Fournir l'acces aux cours, quiz, bibliotheque, messagerie et classes live.</li>
            <li>Authentifier les utilisateurs et proteger les acces aux espaces eleve, parent, professeur et admin.</li>
            <li>Suivre la progression, afficher les statistiques et personnaliser l'experience d'apprentissage.</li>
            <li>Permettre l'envoi de messages, le partage de documents et l'organisation pedagogique.</li>
            <li>Envoyer des rappels ou notifications si l'utilisateur a donne son autorisation.</li>
            <li>Detecter, prevenir et corriger les incidents techniques ou de securite.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>4. Bases d'acces et controles utilisateur</h3>
          <ul className="policy-list">
            <li>Les acces a la camera, au microphone et aux notifications reposent sur le consentement donne via l'appareil.</li>
            <li>Les donnees de compte et de progression sont traitees pour executer le service demande par l'utilisateur.</li>
            <li>Les permissions peuvent etre retirees a tout moment dans les reglages du telephone.</li>
            <li>Le vidage du cache local est disponible dans l'application pour supprimer les donnees conservees sur l'appareil.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid">
        <article className="content-card">
          <h3>5. Partage avec des prestataires</h3>
          <ul className="policy-list">
            <li>Supabase est utilise pour l'authentification, la base de donnees, le stockage et certaines fonctions backend.</li>
            <li>Agora est utilise pour les classes live audio et video.</li>
            <li>Expo peut etre utilise pour certaines fonctions applicatives, notamment les notifications push.</li>
          </ul>
          <p className="policy-note">
            Nous ne vendons pas les donnees personnelles. Les prestataires techniques sont utilises pour fournir le service.
          </p>
        </article>

        <article className="content-card">
          <h3>6. Conservation</h3>
          <ul className="policy-list">
            <li>Les donnees de compte sont conservees tant que le compte reste actif ou tant que cela est necessaire au service.</li>
            <li>Les messages, documents et contenus pedagogiques sont conserves selon les besoins de fonctionnement de la plateforme.</li>
            <li>Les donnees locales de l'application peuvent rester sur l'appareil jusqu'a deconnexion, suppression du cache ou desinstallation.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid">
        <article className="content-card">
          <h3>7. Droits des utilisateurs</h3>
          <ul className="policy-list">
            <li>Demander l'acces, la rectification ou la suppression de certaines donnees.</li>
            <li>
              Demander la fermeture du compte via l'application iSkul ou la page{" "}
              <Link to="/delete-account">Suppression de compte</Link>.
            </li>
            <li>Retirer les permissions appareil pour la camera, le micro ou les notifications.</li>
            <li>Nous contacter via <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou la page <Link to="/contact">Contact</Link>.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>8. Securite</h3>
          <p>
            iSkul met en oeuvre des controles d'authentification, de permissions applicatives et de restriction
            d'acces aux donnees afin de limiter les acces non autorises. Aucun dispositif n'offrant une securite
            absolue, les utilisateurs doivent aussi proteger leurs identifiants et leurs appareils.
          </p>
          <p>
            Cette politique peut etre mise a jour pour refleter l'evolution du service, des obligations legales ou
            des prestataires techniques.
          </p>
        </article>
      </section>
    </div>
  );
}

/** ---------------------------
 *  Teacher Signup (CTA clarifie)
 *  --------------------------*/
function TeacherSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [school, setSchool] = useState("");
  const [subjects, setSubjects] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string>("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    if (!showSuccessToast) return;
    const timerId = window.setTimeout(() => setShowSuccessToast(false), 7000);
    return () => window.clearTimeout(timerId);
  }, [showSuccessToast]);

  const disabled = useMemo(() => {
    if (busy || OFFICIAL_WEB_ENV_ERROR) return true;
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) return true;
    if (!isEmail(email.trim())) return true;
    if (password.trim().length < 8) return true;
    if (password !== confirmPassword) return true;
    if (!accepted) return true;
    return false;
  }, [busy, name, email, password, confirmPassword, accepted]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke("teacher-register", {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          school: school.trim() || null,
          subjects: subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "registration_failed");

      const normalizedEmail = email.trim().toLowerCase();
      setSuccess("Compte professeur cree. Vous pourrez utiliser l'application iSkul des sa disponibilite.");
      setSuccessEmail(normalizedEmail);
      setShowSuccessToast(true);

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setSchool("");
      setSubjects("");
      setAccepted(false);
    } catch (err) {
      setError(await resolveTeacherSignupError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap container signup-page">
      <header className="page-head">
        <span className="kicker">Espace professeur</span>
        <h1>Devenir professeur iSkul</h1>
        <p>
          Inscription dediee aux enseignants. Le web donne acces a des statistiques detaillees ; l'experience complete de
          creation/organisation de contenus est pensee pour l'application iSkul.
        </p>
      </header>

      <section className="signup-grid">
        <article className="signup-showcase">
          <span className="kicker signup-kicker">Portail enseignant</span>
          <h2>Un onboarding clair, securise et rapide.</h2>
          <p>
            Ce portail centralise la creation de compte professeur et garantit un controle qualite avant acces aux outils.
          </p>

          <div className="signup-pill-grid">
            <div className="signup-pill">
              <strong>3 min</strong>
              <span>Temps moyen</span>
            </div>
            <div className="signup-pill">
              <strong>100%</strong>
              <span>Tracabilite</span>
            </div>
            <div className="signup-pill">
              <strong>Securise</strong>
              <span>Validation</span>
            </div>
          </div>

          <ul className="signup-list">
            <li>Creation automatique du profil avec role enseignant.</li>
            <li>Controle via politique d'ouverture du portail et domaine autorise.</li>
            <li>Journalisation pour audit et suivi operationnel.</li>
            <li>Activation et fermeture du portail depuis la console admin.</li>
          </ul>

          <p className="signup-contact">
            Besoin d'assistance : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </article>

        <form className="signup-form-card" onSubmit={submit}>
          <header className="signup-form-head">
            <h2>Formulaire d'inscription</h2>
            <p>Renseignez des informations exactes pour finaliser votre activation.</p>
          </header>

          {OFFICIAL_WEB_ENV_ERROR ? <p className="notice error">{OFFICIAL_WEB_ENV_ERROR}</p> : null}

          <section className="form-section">
            <h3>1. Informations du compte</h3>
            <div className="form-grid-two">
              <label className="form-field">
                Nom complet
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex : Mariam Diallo" />
              </label>

              <label className="form-field">
                Email professionnel
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nom@ecole.com"
                  autoComplete="email"
                />
              </label>

              <label className="form-field">
                Mot de passe
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8 caracteres minimum"
                  autoComplete="new-password"
                />
              </label>

              <label className="form-field">
                Confirmer le mot de passe
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Retapez le mot de passe"
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="password-meter">
              <div className="password-meter-row">
                <span>Force du mot de passe</span>
                <strong className={`strength-${strength.tone}`}>{strength.label}</strong>
              </div>
              <div className="password-track">
                <span className={`password-fill ${strength.tone}`} style={{ width: `${strength.percent}%` }} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>2. Profil enseignant</h3>
            <div className="form-grid-two">
              <label className="form-field">
                Etablissement
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  placeholder="College, lycee, universite"
                />
              </label>

              <label className="form-field">
                Matieres
                <input
                  value={subjects}
                  onChange={(event) => setSubjects(event.target.value)}
                  placeholder="Maths, Physique, SVT"
                />
              </label>
            </div>
          </section>

          <p className="field-hint">
            L'acces reste securise par la politique du portail enseignant et les regles de validation cote serveur.
          </p>

          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Je confirme que ces informations sont exactes et que j'ai l'autorisation de creer ce compte.</span>
          </label>

          {error ? <p className="notice error">{error}</p> : null}

          <div className="signup-actions">
            <button className="btn primary" disabled={disabled}>
              {busy ? "Creation..." : "Creer mon compte professeur"}
            </button>

            <Link className="btn ghost" to="/contact">
              Contacter iSkul
            </Link>

            <StoreButton platform="android" variant="secondary" />
          </div>
        </form>
      </section>

      {showSuccessToast ? (
        <div className="signup-success-toast" role="status" aria-live="polite">
          <div className="signup-success-head">
            <span className="signup-success-icon" aria-hidden="true">
              OK
            </span>
            <div>
              <strong>Inscription finalisee</strong>
              <p>{success || "Le compte professeur a ete cree avec succes."}</p>
            </div>
            <button
              className="signup-success-close"
              type="button"
              aria-label="Fermer la notification"
              onClick={() => setShowSuccessToast(false)}
            >
              x
            </button>
          </div>

          <p className="signup-success-email">{successEmail}</p>

          <div className="signup-success-tags">
            <span>Role : Professeur</span>
            <span>Statut : Actif</span>
            <span>Acces : Web + App</span>
          </div>

          <div className="signup-success-actions">
            <Link className="btn ghost" to="/espace-professeur">
              Ouvrir l'espace professeur
            </Link>
            <StoreButton platform="android" variant="secondary" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** ---------------------------
 *  App
 *  --------------------------*/
export function App() {
  return (
    <div className="site-root">
      <ScrollToTop />
      <SeoHead />
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/inscription-professeur" element={<TeacherSignupPage />} />
          <Route path="/cours" element={<CoursesPage />} />
          <Route path="/bibliotheque" element={<LibraryPage />} />
          <Route path="/parents" element={<ParentTrackingPage />} />
          <Route path="/open-classroom" element={<OpenClassroomPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/espace-professeur" element={<TeacherWorkspacePage />} />

          {/* NEW */}
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/politique-confidentialite" element={<PrivacyPolicyPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/mentions-legales" element={<LegalPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}
