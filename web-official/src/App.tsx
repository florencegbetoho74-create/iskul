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
  (import.meta.env.VITE_APP_RELEASE_STATUS || "coming_soon") === "live" ? "live" : "coming_soon";

const IS_APP_LIVE = APP_RELEASE_STATUS === "live";

const ANDROID_URL = (import.meta.env.VITE_ANDROID_URL || "").trim();
const IOS_URL = (import.meta.env.VITE_IOS_URL || "").trim();

// Optionnel : blog externe si tu veux
const BLOG_URL = (import.meta.env.VITE_BLOG_URL || "").trim();

// Support email (affiché uniquement sur inscription prof si besoin)
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "support@iskul.app").trim();

/** ---------------------------
 *  NAVIGATION
 *  --------------------------*/
const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/cours", label: "Cours & Quiz" },
  { to: "/bibliotheque", label: "Bibliothèque" },
  { to: "/open-classroom", label: "Open Classroom" },
  { to: "/parents", label: "Espace parents" },
  { to: "/espace-professeur", label: "Espace professeur" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
];

const HERO_VISUALS: FeatureVisual[] = [
  {
    id: "classroom-live",
    title: "Open Classroom (Live)",
    caption: "Sessions en direct : explications, questions-réponses, méthodologie et entraînements.",
    imageUrl:
      "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "local-language",
    title: "Français + langues locales",
    caption: "Des explications accessibles pour comprendre rapidement, sans barrière de langue.",
    imageUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "learning-metrics",
    title: "Quiz & statistiques",
    caption: "Quiz par séquence, progression, scores et régularité : des indicateurs clairs.",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
  },
];

const OPEN_CLASSROOM_EVENTS = [
  { day: "Lundi", hour: "18h00", topic: "Mathématiques : fonctions et applications", teacher: "Équipe iSkul Maths" },
  { day: "Mercredi", hour: "19h00", topic: "Français : méthode du commentaire de texte", teacher: "Équipe iSkul Langues" },
  { day: "Samedi", hour: "10h00", topic: "Orientation + révision intelligente", teacher: "Mentors iSkul" },
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
  if (msg.includes("portal_closed")) return "Le portail professeur est temporairement fermé.";
  if (msg.includes("domain_not_allowed")) return "Domaine email non autorisé pour ce portail.";
  if (msg.includes("already") || msg.includes("registered")) return "Cette adresse email est déjà utilisée.";
  if (msg.includes("weak_password")) return "Mot de passe trop faible (8 caractères minimum).";
  if (msg.includes("invalid_email")) return "Adresse email invalide.";
  if (msg.includes("missing_fields")) return "Veuillez remplir tous les champs obligatoires.";
  if (msg.includes("failed to fetch") || msg.includes("functionsfetcherror")) {
    return "Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.";
  }
  if (msg.includes("server_misconfigured")) return "Service d'inscription temporairement indisponible.";
  return "Inscription impossible. Vérifiez les champs et réessayez.";
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
 *  Store Buttons (Coming Soon)
 *  --------------------------*/
function StoreButton({
  platform,
  variant,
}: {
  platform: "android" | "ios";
  variant: "primary" | "secondary";
}) {
  const label =
    platform === "android"
      ? IS_APP_LIVE
        ? "Télécharger sur Android"
        : "Bientôt sur Android"
      : IS_APP_LIVE
      ? "Télécharger sur iOS"
      : "Bientôt sur iOS";

  if (IS_APP_LIVE) {
    const url = platform === "android" ? ANDROID_URL : IOS_URL;

    // Sécurité: si l'app est live mais le lien est vide, on garde un fallback propre
    if (!url) {
      return (
        <button
          className={`btn ${variant}`}
          type="button"
          onClick={() => alert("Le lien de téléchargement sera disponible très bientôt.")}
        >
          {label}
        </button>
      );
    }

    return (
      <a className={`btn ${variant}`} href={url} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <button
      className={`btn ${variant}`}
      type="button"
      onClick={() => alert("L'application iSkul sera bientôt disponible sur les stores.")}
    >
      {label}
    </button>
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

          <Link className="btn ghost nav-mobile-cta" to="/inscription-professeur">
            Devenir professeur
          </Link>
        </nav>

        <Link className="btn ghost desktop-cta" to="/inscription-professeur">
          Devenir professeur
        </Link>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <p className="footer-title">iSkul</p>
          <p>
            Plateforme EdTech : vidéos par chapitre, quiz de compréhension, statistiques de progression, Open Classroom
            en live, et bibliothèque pédagogique.
          </p>
        </div>

        <div className="footer-links">
          <Link to="/contact">Contact</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/mentions-legales">Mentions légales</Link>
          {BLOG_URL ? (
            <a href={BLOG_URL} target="_blank" rel="noreferrer">
              Blog
            </a>
          ) : null}
        </div>

        <div className="footer-social">
          <span>Réseaux sociaux</span>
          <div className="social-row">
            <a aria-label="Instagram" href="https://instagram.com" target="_blank" rel="noreferrer">
              IG
            </a>
            <a aria-label="Facebook" href="https://facebook.com" target="_blank" rel="noreferrer">
              FB
            </a>
            <a aria-label="X" href="https://x.com" target="_blank" rel="noreferrer">
              X
            </a>
            <a aria-label="LinkedIn" href="https://linkedin.com" target="_blank" rel="noreferrer">
              IN
            </a>
          </div>
        </div>
      </div>
      <p className="footer-copy">iSkul © 2026 — Comprendre, tester, progresser.</p>
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
          <span className="kicker">Vidéos • Quiz • Statistiques • Open Classroom</span>
          <h1>Comprendre ses cours, vraiment.</h1>
          <p className="lead">
            iSkul transforme chaque chapitre en une vidéo claire (en français et en langues locales), suivie d’un quiz
            et d’un suivi de progression. L’élève avance avec confiance. Le parent suit sans pression. Le professeur
            accompagne avec des indicateurs concrets.
          </p>

          <div className="hero-actions">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
            <Link className="btn ghost" to="/inscription-professeur">
              Devenir professeur iSkul
            </Link>
          </div>

          <div className="hero-trust">
            <div className="trust-item">
              <strong>Vidéos par chapitre</strong>
              <span>Explications structurées et faciles à suivre</span>
            </div>
            <div className="trust-item">
              <strong>Quiz par séquence</strong>
              <span>On vérifie la compréhension, pas la chance</span>
            </div>
            <div className="trust-item">
              <strong>Statistiques</strong>
              <span>Progression, scores, régularité</span>
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

          <div className="visual-thumbs" role="tablist" aria-label="Fonctionnalités iSkul">
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
          <h2>Quand la langue devient une barrière, la compréhension s’effondre.</h2>
        </div>

        <p className="lead">
          Beaucoup d’élèves finissent par “mémoriser” sans comprendre. iSkul remet la compréhension au centre grâce à
          des explications accessibles, des quiz immédiats et un suivi clair de la progression.
        </p>

        <div className="three-cols">
          <article className="info-card">
            <h3>Comprendre d’abord</h3>
            <p>Une vidéo par chapitre, construite pour expliquer clairement (et pas juste réciter).</p>
          </article>

          <article className="info-card">
            <h3>Vérifier ensuite</h3>
            <p>Un quiz par séquence pour confirmer la compréhension et détecter les points à revoir.</p>
          </article>

          <article className="info-card">
            <h3>Progresser durablement</h3>
            <p>Statistiques personnelles : scores, progression, régularité, et points forts.</p>
          </article>
        </div>
      </section>

      {/* FLOW ÉLÈVE */}
      <section className="section container">
        <div className="section-head">
          <span className="kicker">Parcours élève</span>
          <h2>Un flow simple : apprendre → tester → suivre.</h2>
        </div>

        <div className="grid-cards">
          <article className="content-card">
            <h3>1. Je regarde la vidéo</h3>
            <p className="muted">Chaque chapitre est expliqué avec des exemples concrets, en français et en langues locales.</p>
          </article>

          <article className="content-card">
            <h3>2. Je fais le quiz</h3>
            <p className="muted">
              Les questions valident la compréhension. On identifie ce qui est acquis et ce qui doit être revu.
            </p>
          </article>

          <article className="content-card">
            <h3>3. Je consulte mes statistiques</h3>
            <p className="muted">
              Progression, scores par matière, régularité : je sais exactement quoi réviser ensuite.
            </p>
          </article>
        </div>

        <div className="hero-actions" style={{ marginTop: 18 }}>
          <Link className="btn ghost" to="/cours">
            Découvrir Cours & Quiz
          </Link>
          <Link className="btn ghost" to="/bibliotheque">
            Explorer la bibliothèque
          </Link>
          <Link className="btn ghost" to="/open-classroom">
            Voir l’Open Classroom
          </Link>
        </div>
      </section>

      {/* OPEN CLASSROOM */}
      <section className="section container panel">
        <div className="section-head">
          <span className="kicker">Open Classroom</span>
          <h2>Des sessions live pour débloquer les points difficiles.</h2>
        </div>
        <p>
          L’Open Classroom iSkul, ce sont des sessions interactives : explications, questions-réponses, méthodes et
          entraînements. Idéal pour reprendre confiance et progresser plus vite.
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
          <h2>Suivre la progression, sans surveiller l’enfant.</h2>
        </div>
        <p>
          L’espace parents permet de consulter les statistiques liées au compte de l’élève : progression, scores, et
          régularité. Une vue claire, sans pression inutile.
        </p>
        <div className="hero-actions">
          <Link className="btn ghost" to="/parents">
            Accéder à l’espace parents
          </Link>
        </div>
      </section>

      {/* PROF */}
      <section className="section container panel">
        <div className="section-head">
          <span className="kicker">Espace professeur</span>
          <h2>Une vue claire sur la performance et l’engagement.</h2>
        </div>
        <p>
          Sur le web, l’enseignant consulte des indicateurs détaillés. Pour créer et organiser les contenus, l’expérience
          complète se fait dans l’application iSkul.
        </p>
        <div className="hero-actions">
          <Link className="btn secondary" to="/inscription-professeur">
            Devenir professeur iSkul
          </Link>
          <Link className="btn ghost" to="/espace-professeur">
            Ouvrir l’espace professeur
          </Link>
        </div>
      </section>

      {/* BIBLIOTHÈQUE */}
      <section className="section container panel library-panel">
        <div className="section-head">
          <span className="kicker">Bibliothèque</span>
          <h2>Documents pédagogiques et livres, à portée de main.</h2>
        </div>
        <p>
          Une bibliothèque pour approfondir : documents pédagogiques, supports structurés, et ressources de lecture. De
          quoi réviser, comprendre et consolider.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="section container">
        <div className="section-head">
          <span className="kicker">Rejoindre iSkul</span>
          <h2>Une meilleure compréhension change tout.</h2>
        </div>
        <p className="lead">
          iSkul aide les élèves à comprendre, à se tester, et à progresser avec des repères simples. Les parents suivent
          la progression. Les professeurs accompagnent avec des statistiques utiles.
        </p>
        <div className="hero-actions">
          <StoreButton platform="android" variant="primary" />
          <StoreButton platform="ios" variant="secondary" />
          <Link className="btn ghost" to="/inscription-professeur">
            Devenir professeur
          </Link>
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
        <h1>Des cours structurés pour comprendre avant de mémoriser</h1>
        <p>
          Chaque cours iSkul suit la même logique : vidéo explicative, quiz de compréhension, statistiques de progression.
        </p>
      </header>

      <section className="section">
        <h2>Ce que contient un cours iSkul</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Vidéo par chapitre</h3>
            <p>Explication claire, structurée, en français et en langues locales.</p>
          </article>

          <article className="content-card">
            <h3>Quiz par séquence</h3>
            <p>Questions ciblées pour tester la compréhension immédiate.</p>
          </article>

          <article className="content-card">
            <h3>Statistiques personnelles</h3>
            <p>Suivi des scores, progression par matière et par chapitre.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>Niveaux concernés</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Collège</h3>
            <p>Programmes structurés par classe et matière.</p>
          </article>

          <article className="content-card">
            <h3>Lycée</h3>
            <p>Approfondissement, méthodologie et préparation aux examens.</p>
          </article>

          <article className="content-card">
            <h3>Examens</h3>
            <p>Révisions ciblées et quiz d’entraînement.</p>
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
          Une bibliothèque pour lire, réviser et approfondir : supports scolaires, documents pédagogiques et ressources
          de référence.
        </p>
      </header>

      <div className="three-cols">
        <article className="content-card">
          <h3>Documents pédagogiques</h3>
          <p>Fiches, supports de cours, exercices et documents structurés par matière et niveau.</p>
        </article>
        <article className="content-card">
          <h3>Livres & lecture</h3>
          <p>Ouvrages utiles pour la culture générale, la lecture et la consolidation des acquis.</p>
        </article>
        <article className="content-card">
          <h3>Ressources mises à jour</h3>
          <p>Une amélioration continue des contenus pour rester aligné sur les besoins du terrain.</p>
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
        <p>Sessions interactives : explications, questions-réponses, méthodologie et entraînements.</p>
      </header>

      <div className="grid-cards">
        {OPEN_CLASSROOM_EVENTS.map((event) => (
          <article key={`${event.day}-${event.hour}`} className="content-card">
            <h3>
              {event.day} — {event.hour}
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
        <span className="kicker">À propos</span>
        <h1>Pourquoi iSkul existe</h1>
        <p>
          Notre mission : rendre la compréhension scolaire accessible, en respectant la langue, la culture et le rythme
          d’apprentissage de chaque élève.
        </p>
      </header>

      <section className="panel">
        <h2>Comprendre change tout</h2>
        <p>
          Quand un élève comprend vraiment, il reprend confiance. iSkul combine technologie et pédagogie pour transformer
          la compréhension en progrès mesurables.
        </p>
      </section>
    </div>
  );
}

/** ---------------------------
 *  Contact (email invisible)
 *  - Nécessite une Edge Function: "contact-message"
 *  --------------------------*/
function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (busy) return true;
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
      if (!data?.ok) throw new Error(data?.error || "contact_failed");

      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError("Impossible d’envoyer le message pour le moment. Réessayez dans quelques instants.");
      // Optionnel : console.log(err)
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Contact</span>
        <h1>Écrivez-nous</h1>
        <p>Une question, une collaboration, une demande institutionnelle ? Envoyez-nous un message.</p>
      </header>

      {sent ? (
        <p className="notice success">Votre message a bien été envoyé. Nous vous répondrons dès que possible.</p>
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
              placeholder="Expliquez votre besoin…"
              rows={6}
            />
          </label>

          {error ? <p className="notice error">{error}</p> : null}

          <div className="hero-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" disabled={disabled}>
              {busy ? "Envoi…" : "Envoyer"}
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
        <h1>Questions fréquentes</h1>
        <p>Voici les réponses aux questions les plus courantes sur iSkul.</p>
      </header>

      <div className="content-card">
        <h3>L’application iSkul est-elle déjà disponible ?</h3>
        <p>
          Pas encore. Les boutons “Télécharger” affichent “Bientôt disponible” tant que l’app n’est pas publiée sur les
          stores.
        </p>

        <h3>En quelles langues sont les cours ?</h3>
        <p>Les cours sont en français et progressivement en langues locales, pour faciliter la compréhension.</p>

        <h3>Comment fonctionnent les quiz ?</h3>
        <p>Chaque séquence est suivie d’un quiz de compréhension. Les résultats alimentent vos statistiques.</p>

        <h3>À quoi sert l’espace parents ?</h3>
        <p>L’espace parents permet de consulter les statistiques liées au compte de l’élève (progression, scores, régularité).</p>

        <h3>À quoi sert l’espace professeur sur le web ?</h3>
        <p>
          Le web sert surtout à consulter des statistiques détaillées. La création/organisation des contenus est pensée
          pour l’application iSkul.
        </p>
      </div>
    </div>
  );
}

function LegalPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Mentions légales</span>
        <h1>Informations légales</h1>
        <p>Ce contenu est un minimum. Il peut être complété selon votre structure juridique et vos obligations locales.</p>
      </header>

      <section className="content-card">
        <h3>Éditeur</h3>
        <p>iSkul — Plateforme EdTech (informations d’éditeur à compléter).</p>

        <h3>Responsabilité</h3>
        <p>
          iSkul met à disposition des contenus pédagogiques et des fonctionnalités de suivi. Malgré notre attention,
          des erreurs peuvent exister. Les informations sont susceptibles d’évoluer.
        </p>

        <h3>Données personnelles</h3>
        <p>
          Les données sont utilisées pour fournir les services (progression, statistiques, expérience utilisateur).
          Pour toute demande liée aux données, utilisez le formulaire de contact.
        </p>

        <h3>Contact</h3>
        <p>
          Pour nous joindre, utilisez la page <Link to="/contact">Contact</Link>.
        </p>
      </section>
    </div>
  );
}

/** ---------------------------
 *  Teacher Signup (CTA clarifié)
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
      setSuccess("Compte professeur créé. Vous pourrez utiliser l’application iSkul dès sa disponibilité.");
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
          Inscription dédiée aux enseignants. Le web donne accès à des statistiques détaillées ; l’expérience complète de
          création/organisation de contenus est pensée pour l’application iSkul.
        </p>
      </header>

      <section className="signup-grid">
        <article className="signup-showcase">
          <span className="kicker signup-kicker">Portail enseignant</span>
          <h2>Un onboarding clair, sécurisé et rapide.</h2>
          <p>
            Ce portail centralise la création de compte professeur et garantit un contrôle qualité avant accès aux outils.
          </p>

          <div className="signup-pill-grid">
            <div className="signup-pill">
              <strong>3 min</strong>
              <span>Temps moyen</span>
            </div>
            <div className="signup-pill">
              <strong>100%</strong>
              <span>Traçabilité</span>
            </div>
            <div className="signup-pill">
              <strong>Sécurisé</strong>
              <span>Validation</span>
            </div>
          </div>

          <ul className="signup-list">
            <li>Création automatique du profil avec rôle enseignant.</li>
            <li>Contrôle via politique d'ouverture du portail et domaine autorisé.</li>
            <li>Journalisation pour audit et suivi opérationnel.</li>
            <li>Activation et fermeture du portail depuis la console admin.</li>
          </ul>

          <p className="signup-contact">
            Besoin d’assistance : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </article>

        <form className="signup-form-card" onSubmit={submit}>
          <header className="signup-form-head">
            <h2>Formulaire d’inscription</h2>
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
                  placeholder="8 caractères minimum"
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
                Établissement
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  placeholder="Collège, lycée, université"
                />
              </label>

              <label className="form-field">
                Matières
                <input
                  value={subjects}
                  onChange={(event) => setSubjects(event.target.value)}
                  placeholder="Maths, Physique, SVT"
                />
              </label>
            </div>
          </section>

          <p className="field-hint">
            L’accès reste sécurisé par la politique du portail enseignant et les règles de validation côté serveur.
          </p>

          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Je confirme que ces informations sont exactes et que j’ai l’autorisation de créer ce compte.</span>
          </label>

          {error ? <p className="notice error">{error}</p> : null}

          <div className="signup-actions">
            <button className="btn primary" disabled={disabled}>
              {busy ? "Création…" : "Créer mon compte professeur"}
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
              <strong>Inscription finalisée</strong>
              <p>{success || "Le compte professeur a été créé avec succès."}</p>
            </div>
            <button
              className="signup-success-close"
              type="button"
              aria-label="Fermer la notification"
              onClick={() => setShowSuccessToast(false)}
            >
              ×
            </button>
          </div>

          <p className="signup-success-email">{successEmail}</p>

          <div className="signup-success-tags">
            <span>Rôle : Professeur</span>
            <span>Statut : Actif</span>
            <span>Accès : Web + App</span>
          </div>

          <div className="signup-success-actions">
            <Link className="btn ghost" to="/espace-professeur">
              Ouvrir l’espace professeur
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
          <Route path="/mentions-legales" element={<LegalPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}