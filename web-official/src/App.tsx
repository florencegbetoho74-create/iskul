import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import iskulLogo from "./assets/iskul-logo.png";
import { OFFICIAL_WEB_ENV_ERROR, supabase } from "./lib/supabase";
import ParentTrackingPage from "./pages/ParentTrackingPage";
import TeacherWorkspacePage from "./pages/TeacherWorkspacePage";
import { useRouteSeo } from "./seo";
import "./styles.css";

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

// Lien officiel de la fiche Play Store. On le force dans le code pour éviter
// qu'une variable d'environnement mal configurée (ex. page d'accueil générique
// du Play Store) ne le remplace en production.
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.iskuledu.app";
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

/** Photographie (élèves du secondaire) — traitée en duotone de marque côté CSS.
 *  Remplaçable par de vraies photos d'élèves béninois aux mêmes emplacements. */
const PHOTOS = {
  hero: "https://images.pexels.com/photos/34162714/pexels-photo-34162714.jpeg?auto=compress&cs=tinysrgb&w=1300",
  understand: "https://images.pexels.com/photos/34526416/pexels-photo-34526416.jpeg?auto=compress&cs=tinysrgb&w=1100",
  classroom: "https://images.pexels.com/photos/34526414/pexels-photo-34526414.jpeg?auto=compress&cs=tinysrgb&w=1100",
  live: "https://images.pexels.com/photos/34211750/pexels-photo-34211750.jpeg?auto=compress&cs=tinysrgb&w=1100",
  parents: "https://images.pexels.com/photos/34211744/pexels-photo-34211744.jpeg?auto=compress&cs=tinysrgb&w=1100",
} as const;

const LEVELS = ["6ᵉ", "5ᵉ", "4ᵉ", "3ᵉ", "2ⁿᵈᵉ", "1ʳᵉ", "Tˡᵉ"];

const SUBJECTS = [
  "Mathématiques",
  "PCT",
  "SVT",
  "Français",
  "Anglais",
  "Histoire-Géographie",
  "Philosophie",
  "Espagnol",
];

const HERO_STATS = [
  { value: "6ᵉ → Tˡᵉ", label: "Tout le secondaire" },
  { value: "8+", label: "Matières du programme" },
  { value: "BEPC · BAC", label: "Préparation aux examens" },
  { value: "FR + langues", label: "Fon, Yoruba, Dendi…" },
];

const PILLARS = [
  {
    title: "La langue n'est plus un mur",
    text: "Des explications en français et en langues locales (Fon, Yoruba, Dendi…) pour vraiment comprendre, pas seulement mémoriser.",
  },
  {
    title: "Le programme béninois, chapitre par chapitre",
    text: "Du collège à la terminale, aligné sur ce que l'élève voit réellement en classe au Bénin.",
  },
  {
    title: "Prêt pour le BEPC et le BAC",
    text: "Quiz d'entraînement, annales et révisions ciblées pour aborder les examens nationaux en confiance.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Je regarde la vidéo",
    text: "Chaque chapitre est expliqué clairement, avec des exemples concrets, en français et en langues locales.",
  },
  {
    num: "02",
    title: "Je fais le quiz",
    text: "Des questions par séquence vérifient ce que j'ai vraiment compris — la compréhension, pas la chance.",
  },
  {
    num: "03",
    title: "Je suis ma progression",
    text: "Scores, régularité et points faibles : je sais exactement quoi réviser avant le BEPC ou le BAC.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Avant, je récitais sans comprendre. Avec les explications en fon, les maths sont enfin devenues claires.",
    name: "Awa",
    role: "Élève en 3ᵉ",
    place: "Cotonou",
  },
  {
    quote:
      "Je vois où mon fils bloque sans avoir à le surveiller. Les statistiques sont simples à lire.",
    name: "M. Hounkpatin",
    role: "Parent",
    place: "Porto-Novo",
  },
  {
    quote:
      "Je crée mes quiz et je suis l'engagement de mes classes. Un vrai gain de temps au quotidien.",
    name: "Mme Adjovi",
    role: "Professeure de SVT",
    place: "Abomey",
  },
];

const OPEN_CLASSROOM_EVENTS = [
  { day: "Lundi", hour: "18h00", topic: "Maths 3ᵉ — Théorème de Thalès et applications", teacher: "Équipe iSkul Maths" },
  { day: "Mercredi", hour: "19h00", topic: "Français Tˡᵉ — Méthode du commentaire de texte", teacher: "Équipe iSkul Lettres" },
  { day: "Samedi", hour: "10h00", topic: "Spécial BEPC — Révisions PCT et SVT", teacher: "Mentors iSkul" },
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

/** Photo avec traitement duotone de marque + repli propre si l'image échoue. */
function Photo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span className={`photo${className ? ` ${className}` : ""}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.opacity = "0";
        }}
      />
    </span>
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
            La plateforme scolaire des élèves du secondaire au Bénin : vidéos par chapitre, quiz de compréhension,
            suivi de progression, Open Classroom en direct et bibliothèque pédagogique.
          </p>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Navigation</span>
          <div className="footer-links">
            <Link to="/cours">Cours &amp; Quiz</Link>
            <Link to="/bibliotheque">Bibliothèque</Link>
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
            <Link to="/politique-confidentialite">Politique de confidentialité</Link>
            <Link to="/delete-account">Suppression de compte</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
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
          <p className="footer-app-note">iSkul est disponible sur Google Play. Version iOS bientôt disponible.</p>
        </div>
      </div>
      <p className="footer-copy">iSkul © 2026 — Fait au Bénin, pour les élèves du secondaire.</p>
    </footer>
  );
}

/** ---------------------------
 *  Pages
 *  --------------------------*/
function HomePage() {
  return (
    <div className="home2">
      {/* HERO */}
      <section className="hero2 container">
        <div className="hero2-copy">
          <span className="eyebrow">Plateforme scolaire · Bénin</span>
          <h1 className="hero2-title">
            Le secondaire, <em>enfin compris.</em>
          </h1>
          <p className="hero2-lead">
            De la 6ᵉ à la terminale, iSkul explique chaque chapitre en vidéo — en français et en langues locales —
            puis vérifie la compréhension par un quiz et suit la progression jusqu'au BEPC et au BAC.
          </p>

          <div className="hero2-badges store-badges">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
          </div>

          <ul className="hero2-points">
            <li>Vidéos par chapitre, alignées sur le programme béninois</li>
            <li>Quiz de compréhension après chaque séquence</li>
            <li>Suivi de progression pour l'élève et le parent</li>
          </ul>
        </div>

        <div className="hero2-media">
          <Photo src={PHOTOS.hero} alt="Élèves du secondaire en cours au Bénin" className="hero2-photo" />
          <div className="hero2-floatcard">
            <span className="hero2-floatcard-label">Cette semaine</span>
            <strong className="hero2-floatcard-value">Spécial BEPC</strong>
            <span className="hero2-floatcard-sub">Révisions PCT &amp; SVT · samedi 10h</span>
          </div>
          <div className="hero2-langchip">Fon · Yoruba · Dendi</div>
        </div>
      </section>

      {/* STATS */}
      <section className="container">
        <div className="stats-strip">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="stat">
              <strong className="stat-value">{stat.value}</strong>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* POURQUOI */}
      <section className="sec container">
        <div className="split">
          <div className="split-copy">
            <span className="eyebrow">Pourquoi iSkul</span>
            <h2 className="sec-title">Quand la langue devient un mur, la compréhension s'effondre.</h2>
            <p className="sec-text">
              Trop d'élèves finissent par réciter sans comprendre. iSkul remet la compréhension au centre, avec des
              explications accessibles, des quiz immédiats et un suivi clair — adaptés à la réalité des classes au Bénin.
            </p>
            <div className="pillars">
              {PILLARS.map((pillar) => (
                <article key={pillar.title} className="pillar">
                  <h3>{pillar.title}</h3>
                  <p>{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>
          <Photo src={PHOTOS.understand} alt="Élèves qui révisent ensemble" className="split-media" />
        </div>
      </section>

      {/* COMMENT CA MARCHE */}
      <section className="sec container">
        <div className="sec-head">
          <span className="eyebrow">Comment ça marche</span>
          <h2 className="sec-title">Apprendre, se tester, progresser — en trois temps.</h2>
        </div>
        <div className="steps">
          {STEPS.map((step) => (
            <article key={step.num} className="step">
              <span className="step-num">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="sec-actions">
          <Link className="btn primary" to="/cours">
            Découvrir Cours &amp; Quiz
          </Link>
          <Link className="btn ghost" to="/bibliotheque">
            Explorer la bibliothèque
          </Link>
        </div>
      </section>

      {/* NIVEAUX & MATIERES */}
      <section className="sec container">
        <div className="curriculum">
          <div className="curriculum-head">
            <span className="eyebrow">Programme béninois</span>
            <h2 className="sec-title">Tout le secondaire, du collège au lycée.</h2>
            <p className="sec-text">
              Des contenus organisés par classe et par matière, pour réviser exactement ce qui est vu en cours et se
              préparer aux examens nationaux.
            </p>
          </div>

          <div className="curriculum-block">
            <span className="curriculum-label">Niveaux</span>
            <div className="chips">
              {LEVELS.map((level) => (
                <span key={level} className="chip">
                  {level}
                </span>
              ))}
              <span className="chip chip-exam">BEPC</span>
              <span className="chip chip-exam">BAC</span>
            </div>
          </div>

          <div className="curriculum-block">
            <span className="curriculum-label">Matières</span>
            <div className="chips">
              {SUBJECTS.map((subject) => (
                <span key={subject} className="chip">
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OPEN CLASSROOM */}
      <section className="sec container">
        <div className="live-board">
          <div className="live-copy">
            <span className="eyebrow eyebrow-light">Open Classroom · en direct</span>
            <h2 className="sec-title">Des sessions live pour débloquer les points difficiles.</h2>
            <p className="sec-text-light">
              Explications, questions-réponses, méthodologie et entraînements. Les replays restent disponibles pour
              revoir un chapitre à son rythme.
            </p>
            <div className="live-list">
              {OPEN_CLASSROOM_EVENTS.map((event) => (
                <div key={`${event.day}-${event.hour}`} className="live-row">
                  <span className="live-when">
                    <strong>{event.day}</strong>
                    <small>{event.hour}</small>
                  </span>
                  <span className="live-topic">
                    {event.topic}
                    <small>{event.teacher}</small>
                  </span>
                </div>
              ))}
            </div>
            <Link className="btn gold" to="/open-classroom">
              Voir tout le planning
            </Link>
          </div>
          <Photo src={PHOTOS.live} alt="Session live avec des élèves" className="live-media" />
        </div>
      </section>

      {/* PARENTS & PROF */}
      <section className="sec container">
        <div className="split split-reverse">
          <Photo src={PHOTOS.parents} alt="Élèves du secondaire béninois en classe" className="split-media" />
          <div className="split-copy">
            <span className="eyebrow">Parents &amp; professeurs</span>
            <h2 className="sec-title">Accompagner, sans surveiller.</h2>
            <p className="sec-text">
              Les parents suivent la progression de leur enfant — scores, régularité, points faibles — d'un coup d'œil,
              sans pression inutile. Les professeurs, eux, créent leurs contenus et suivent l'engagement de leurs classes.
            </p>
            <div className="duo-actions">
              <Link className="btn primary" to="/parents">
                Espace parents
              </Link>
              <Link className="btn ghost" to="/inscription-professeur">
                Devenir professeur
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TEMOIGNAGES */}
      <section className="sec container">
        <div className="sec-head">
          <span className="eyebrow">Ils utilisent iSkul</span>
          <h2 className="sec-title">Des élèves, des parents, des profs — au Bénin.</h2>
        </div>
        <div className="quotes">
          {TESTIMONIALS.map((item) => (
            <figure key={item.name} className="quote">
              <blockquote>« {item.quote} »</blockquote>
              <figcaption>
                <span className="quote-avatar" aria-hidden="true">
                  {item.name.replace(/^(M\.|Mme)\s*/, "").charAt(0)}
                </span>
                <span className="quote-id">
                  <strong>{item.name}</strong>
                  <small>
                    {item.role} · {item.place}
                  </small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* TELECHARGEMENT */}
      <section className="sec container">
        <div className="download">
          <div className="download-copy">
            <span className="eyebrow eyebrow-light">Application iSkul</span>
            <h2 className="download-title">Téléchargez iSkul et révisez où que vous soyez.</h2>
            <p>
              Vidéos, quiz et suivi de progression, directement sur votre téléphone. Gratuit, léger et pensé pour le
              terrain — même avec une connexion limitée.
            </p>
            <div className="store-badges">
              <StoreButton platform="android" variant="primary" />
              <StoreButton platform="ios" variant="secondary" />
            </div>
            <p className="download-note">Disponible dès maintenant sur Google Play · iOS bientôt disponible.</p>
          </div>
          <div className="download-art" aria-hidden="true">
            <img src={iskulLogo} alt="" className="download-logo" />
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
        <span className="kicker">Cours &amp; Quiz</span>
        <h1>Comprendre avant de mémoriser, du collège à la terminale</h1>
        <p>
          Chaque cours iSkul suit la même logique : une vidéo explicative par chapitre, un quiz de compréhension par
          séquence, puis des statistiques de progression — alignés sur le programme béninois.
        </p>
      </header>

      <section className="section">
        <h2>Ce que contient un cours iSkul</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Vidéo par chapitre</h3>
            <p>Une explication claire et structurée, en français et en langues locales (Fon, Yoruba, Dendi…).</p>
          </article>

          <article className="content-card">
            <h3>Quiz par séquence</h3>
            <p>Des questions ciblées pour tester la compréhension immédiatement, séquence après séquence.</p>
          </article>

          <article className="content-card">
            <h3>Statistiques personnelles</h3>
            <p>Le suivi des scores, de la progression par matière et par chapitre, pour savoir quoi réviser.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>Niveaux et examens couverts</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Collège · 6ᵉ → 3ᵉ</h3>
            <p>Les fondamentaux par classe et par matière, pour bâtir des bases solides jusqu'au BEPC.</p>
          </article>

          <article className="content-card">
            <h3>Lycée · 2ⁿᵈᵉ → Tˡᵉ</h3>
            <p>Approfondissement, méthodologie et préparation progressive au baccalauréat.</p>
          </article>

          <article className="content-card">
            <h3>Examens · BEPC &amp; BAC</h3>
            <p>Révisions ciblées, annales et quiz d'entraînement pour aborder les examens en confiance.</p>
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
        <span className="kicker">Bibliothèque</span>
        <h1>Documents pédagogiques, livres et ressources utiles</h1>
        <p>
          Une bibliothèque pour lire, réviser et approfondir : supports scolaires, documents pédagogiques et ouvrages de
          référence, adaptés aux élèves du secondaire au Bénin.
        </p>
      </header>

      <div className="three-cols">
        <article className="content-card">
          <h3>Documents pédagogiques</h3>
          <p>Fiches, supports de cours, exercices et documents structurés par matière et par niveau.</p>
        </article>
        <article className="content-card">
          <h3>Livres &amp; lecture</h3>
          <p>Des ouvrages utiles pour la culture générale, la lecture et la consolidation des acquis.</p>
        </article>
        <article className="content-card">
          <h3>Ressources à jour</h3>
          <p>Une amélioration continue des contenus pour rester aligné sur le programme et les besoins du terrain.</p>
        </article>
      </div>
    </div>
  );
}

function OpenClassroomPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Open Classroom · en direct</span>
        <h1>Le planning live pour apprendre en direct</h1>
        <p>
          Des sessions interactives : explications, questions-réponses, méthodologie et entraînements, animées par
          l'équipe iSkul.
        </p>
      </header>

      <div className="grid-cards">
        {OPEN_CLASSROOM_EVENTS.map((event) => (
          <article key={`${event.day}-${event.hour}`} className="content-card">
            <h3>
              {event.day} · {event.hour}
            </h3>
            <p>{event.topic}</p>
            <p className="muted">{event.teacher}</p>
          </article>
        ))}
      </div>

      <section className="panel archive-panel">
        <h2>Archives (replays)</h2>
        <p>
          Les replays restent disponibles pour revoir les points difficiles, avancer à son rythme et consolider chaque
          chapitre avant le BEPC ou le BAC.
        </p>
      </section>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">À propos</span>
        <h1>Pourquoi iSkul existe</h1>
        <p>
          Notre mission : rendre la compréhension scolaire accessible aux élèves du secondaire au Bénin, en respectant
          leur langue, leur culture et leur rythme d'apprentissage.
        </p>
      </header>

      <section className="panel">
        <h2>Comprendre change tout</h2>
        <p>
          Quand un élève comprend vraiment, il reprend confiance. iSkul combine technologie et pédagogie pour
          transformer la compréhension en progrès mesurables — du collège jusqu'au baccalauréat.
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
