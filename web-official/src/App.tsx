import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import iskulLogo from "./assets/iskul-logo.png";
import { OFFICIAL_WEB_ENV_ERROR, supabase } from "./lib/supabase";
import "./styles.css";

type FeatureVisual = {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
};

type CourseCategory = {
  title: string;
  level: string;
  format: string;
  value: string;
};

type PasswordStrength = {
  score: number;
  label: string;
  tone: "weak" | "medium" | "strong";
  percent: number;
};

const ANDROID_URL = (import.meta.env.VITE_ANDROID_URL || "https://play.google.com").trim();
const IOS_URL = (import.meta.env.VITE_IOS_URL || "https://apps.apple.com").trim();
const BLOG_URL = (import.meta.env.VITE_BLOG_URL || "#").trim();
const CONTACT_URL = (import.meta.env.VITE_CONTACT_URL || "#").trim();
const FAQ_URL = (import.meta.env.VITE_FAQ_URL || "#").trim();
const LEGAL_URL = (import.meta.env.VITE_LEGAL_URL || "#").trim();
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "support@iskul.app").trim();

const NAV_ITEMS = [
  { to: "/", label: "Accueil", end: true },
  { to: "/cours", label: "Nos Cours" },
  { to: "/bibliotheque", label: "La Bibliotheque" },
  { to: "/parents", label: "Espace Parents" },
  { to: "/open-classroom", label: "Open Classroom" },
  { to: "/a-propos", label: "A Propos" },
];

const HERO_VISUALS: FeatureVisual[] = [
  {
    id: "classroom-live",
    title: "Open Classroom",
    caption: "Sessions live pour apprendre, poser des questions et progresser en direct.",
    imageUrl:
      "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "local-language",
    title: "Cours bilingues",
    caption: "Des explications en francais et en langues locales pour une comprehension immediate.",
    imageUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "learning-metrics",
    title: "Suivi intelligent",
    caption: "Quiz, progression et statistiques claires pour eleves et parents.",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
  },
];

const COURSE_CATEGORIES: CourseCategory[] = [
  {
    title: "Francais & Communication",
    level: "College / Lycee",
    format: "Resumes audio + fiches claires",
    value: "Ameliorer expression et comprehension rapidement",
  },
  {
    title: "Mathematiques",
    level: "College / Lycee",
    format: "Exercices corriges + quiz progressifs",
    value: "Passer de l'intuition a la maitrise",
  },
  {
    title: "Sciences (SVT / Physique)",
    level: "College / Lycee",
    format: "Capsules visuelles + challenges",
    value: "Comprendre les concepts avant de memoriser",
  },
  {
    title: "Langues locales",
    level: "Tous niveaux",
    format: "Explications ancrees dans le quotidien",
    value: "Lever la barriere linguistique et gagner confiance",
  },
];

const OPEN_CLASSROOM_EVENTS = [
  { day: "Lundi", hour: "18h00", topic: "Mathematiques: fonctions et applications", teacher: "Equipe iSkul Maths" },
  { day: "Mercredi", hour: "19h00", topic: "Francais: methode commentaire de texte", teacher: "Equipe iSkul Langues" },
  { day: "Samedi", hour: "10h00", topic: "Orientation + revision intelligente", teacher: "Mentors iSkul" },
];

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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-content">
        <NavLink className="brand" to="/">
          <img src={iskulLogo} alt="Logo iSkul" className="brand-logo" />
          <span className="brand-text">
            <strong>iSkul</strong>
            <small>EdTech Africa</small>
          </span>
        </NavLink>

        <button className="menu-toggle" onClick={() => setMenuOpen((current) => !current)} aria-label="Ouvrir le menu">
          <span />
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "site-nav open" : "site-nav"}>
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
            Creer un compte
          </Link>
        </nav>

        <Link className="btn ghost desktop-cta" to="/inscription-professeur">
          Creer un compte
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
          <p>La plateforme qui transforme l'apprentissage en comprehension concrete.</p>
        </div>

        <div className="footer-links">
          <a href={CONTACT_URL} target="_blank" rel="noreferrer">
            Contact
          </a>
          <a href={BLOG_URL} target="_blank" rel="noreferrer">
            Blog
          </a>
          <a href={FAQ_URL} target="_blank" rel="noreferrer">
            FAQ
          </a>
          <a href={LEGAL_URL} target="_blank" rel="noreferrer">
            Mentions Legales
          </a>
        </div>

        <div className="footer-social">
          <span>Reseaux Sociaux</span>
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
      <p className="footer-copy">iSkul (c) 2026 - L'education, version 2.0.</p>
    </footer>
  );
}

function HomePage() {
  const [activeVisual, setActiveVisual] = useState(HERO_VISUALS[0].id);
  const currentVisual = useMemo(
    () => HERO_VISUALS.find((item) => item.id === activeVisual) || HERO_VISUALS[0],
    [activeVisual]
  );

  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-copy">
          <span className="kicker">Plateforme EdTech officielle</span>
          <h1>L'excellence scolaire, dans la langue qui vous parle.</h1>
          <p>
            Maitrisez vos cours en francais et en langues locales. Quiz, bibliotheque et Lives: tout iSkul tient dans
            votre poche.
          </p>
          <p className="hero-emotion">"Enfin, ils me comprennent." - Eleve iSkul</p>
          <div className="hero-actions">
            <a className="btn primary" href={ANDROID_URL} target="_blank" rel="noreferrer">
              Telecharger sur Android
            </a>
            <a className="btn secondary" href={IOS_URL} target="_blank" rel="noreferrer">
              Telecharger sur iOS
            </a>
            <Link className="btn ghost" to="/inscription-professeur">
              Creer un compte professeur
            </Link>
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
          <div className="visual-thumbs">
            {HERO_VISUALS.map((visual) => (
              <button
                key={visual.id}
                className={visual.id === activeVisual ? "thumb active" : "thumb"}
                onClick={() => setActiveVisual(visual.id)}
              >
                {visual.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <span className="kicker">Le probleme et la solution</span>
          <h2>"Parfois, il suffit d'un mot dans sa langue pour que tout s'eclaire."</h2>
        </div>
        <p className="lead">
          Apprendre dans une langue qu'on ne maitrise pas a 100% est un frein. iSkul brise cette barriere en proposant
          des resumes de cours qui parlent votre culture.
        </p>
        <div className="three-cols">
          <article className="info-card">
            <h3>Comprendre vite</h3>
            <p>Resumes audio et texte en langues locales.</p>
          </article>
          <article className="info-card">
            <h3>Retenir mieux</h3>
            <p>Des quiz interactifs pour valider chaque acquis.</p>
          </article>
          <article className="info-card">
            <h3>Grandir ensemble</h3>
            <p>Une bibliotheque complete, du manuel scolaire au roman culte.</p>
          </article>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <span className="kicker">Experience eleve</span>
          <h2>Apprendre devient un jeu (serieux).</h2>
        </div>
        <div className="three-cols">
          <article className="feature-card">
            <h3>Quiz & Stats</h3>
            <p>
              Ne devinez plus votre niveau, mesurez-le. Suivez vos scores en temps reel et identifiez vos points forts.
            </p>
          </article>
          <article className="feature-card">
            <h3>Open Classroom</h3>
            <p>
              Posez vos questions en direct. Nos professeurs repondent a vos preoccupations lors de sessions live
              interactives.
            </p>
          </article>
          <article className="feature-card">
            <h3>Mode Hors-ligne</h3>
            <p>Parce que la connexion ne doit pas etre un obstacle, emportez vos cours partout.</p>
          </article>
        </div>
      </section>

      <section className="section container panel parents-panel">
        <div className="section-head">
          <span className="kicker">Espace parental</span>
          <h2>Gardez un oeil sur leur reussite, sans les stresser.</h2>
        </div>
        <p>
          Avec le suivi parental iSkul, vous recevez des rapports clairs sur l'assiduite et les resultats de vos
          enfants. Investissez dans leur avenir avec des donnees concretes, pas des suppositions.
        </p>
      </section>

      <section className="section container panel library-panel">
        <div className="section-head">
          <span className="kicker">La bibliotheque</span>
          <h2>Votre librairie nomade.</h2>
        </div>
        <p>
          Accedez a des milliers de ressources. Livres gratuits pour la culture generale ou ouvrages premium pour
          approfondir vos specialites. La connaissance n'a plus de limites.
        </p>
      </section>
    </div>
  );
}

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
      setSuccess("Compte professeur cree. Vous pouvez vous connecter sur l'application mobile iSkul.");
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
        <span className="kicker">Inscription professeur</span>
        <h1>Creer un compte enseignant iSkul</h1>
        <p>
          Un flux d'onboarding professionnel, reserve aux enseignants autorises. Creation du compte en quelques minutes.
        </p>
      </header>

      <section className="signup-grid">
        <article className="signup-showcase">
          <span className="kicker signup-kicker">Portail officiel iSkul</span>
          <h2>Un onboarding enseignant clair, securise et rapide.</h2>
          <p>
            Ce portail centralise la creation de compte professeur et garantit un controle qualite avant acces aux
            outils de publication.
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
              <strong>Secure</strong>
              <span>Validation institutionnelle</span>
            </div>
          </div>
          <ul className="signup-list">
            <li>Creation automatique du profil avec role enseignant.</li>
            <li>Controle via politique d'ouverture du portail et domaine autorise.</li>
            <li>Journalisation pour audit et suivi operationnel.</li>
            <li>Activation et fermeture du portail depuis la console admin.</li>
          </ul>
          <p className="signup-contact">
            Besoin d'acces ou d'assistance: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </article>

        <form className="signup-form-card" onSubmit={submit}>
          <header className="signup-form-head">
            <h2>Formulaire de creation</h2>
            <p>Renseignez des informations exactes pour finaliser votre activation.</p>
          </header>

          {OFFICIAL_WEB_ENV_ERROR ? <p className="notice error">{OFFICIAL_WEB_ENV_ERROR}</p> : null}

          <section className="form-section">
            <h3>1. Informations du compte</h3>
            <div className="form-grid-two">
              <label className="form-field">
                Nom complet
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Mariam Diallo" />
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
                Confirmer mot de passe
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Retaper le mot de passe"
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
            <span>Je confirme que ces informations sont exactes et que j'ai une autorisation de creation.</span>
          </label>

          {error ? <p className="notice error">{error}</p> : null}
          <div className="signup-actions">
            <button className="btn primary" disabled={disabled}>
              {busy ? "Creation..." : "Creer mon compte professeur"}
            </button>
            <a className="btn ghost" href={`mailto:${SUPPORT_EMAIL}`}>
              Contacter le support
            </a>
            <a className="btn secondary" href={ANDROID_URL} target="_blank" rel="noreferrer">
              Telecharger l'app Android
            </a>
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
            <span>Role: Teacher</span>
            <span>Statut: Actif</span>
            <span>Acces: iSkul App</span>
          </div>
          <div className="signup-success-actions">
            <a className="btn secondary" href={ANDROID_URL} target="_blank" rel="noreferrer">
              Ouvrir l'application Android
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CoursesPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Nos cours</span>
        <h1>Catalogue pedagogique iSkul</h1>
        <p>
          Un parcours bilingue pense pour les eleves qui veulent comprendre vite et progresser durablement, en francais
          et en langues locales.
        </p>
      </header>
      <div className="grid-cards">
        {COURSE_CATEGORIES.map((course) => (
          <article key={course.title} className="content-card">
            <h3>{course.title}</h3>
            <p>
              <strong>Niveau:</strong> {course.level}
            </p>
            <p>
              <strong>Format:</strong> {course.format}
            </p>
            <p className="muted">{course.value}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function LibraryPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Bibliotheque</span>
        <h1>Ressources, e-books et resumes de reference</h1>
        <p>Des contenus gratuits et premium pour nourrir la culture generale et accelerer les performances.</p>
      </header>
      <div className="three-cols">
        <article className="content-card">
          <h3>E-books scolaires</h3>
          <p>Manuels et supports structures par matiere, niveau et objectif de revision.</p>
        </article>
        <article className="content-card">
          <h3>Resumes intelligents</h3>
          <p>Le coeur du cours en quelques minutes, avec points cles et auto-evaluation.</p>
        </article>
        <article className="content-card">
          <h3>Nouveautes hebdo</h3>
          <p>Une mise a jour continue pour rester aligne sur les programmes et les besoins terrain.</p>
        </article>
      </div>
    </div>
  );
}

function ParentsPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Espace Parents</span>
        <h1>Un suivi simple, fiable et rassurant</h1>
        <p>
          "C'est exactement ce qu'il faut a mon enfant." Visualisez les efforts, suivez la progression et decidez avec
          des indicateurs concrets.
        </p>
      </header>
      <div className="three-cols">
        <article className="content-card">
          <h3>Rapports clairs</h3>
          <p>Assiduite, score, temps d'etude: tout est lisible en quelques secondes.</p>
        </article>
        <article className="content-card">
          <h3>Cadre securise</h3>
          <p>Des contenus moderes et un environnement pedagogique centre sur l'apprentissage.</p>
        </article>
        <article className="content-card">
          <h3>Communication utile</h3>
          <p>Restez connecte aux actions qui comptent sans surcharger votre enfant.</p>
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
        <p>Sessions interactives avec enseignants, questions-reponses et archives pour revision autonome.</p>
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
        <h2>Archives des sessions passees</h2>
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
          Notre mission: rendre l'excellence scolaire accessible a chaque eleve, en respectant sa langue, sa culture et
          son rythme d'apprentissage.
        </p>
      </header>
      <section className="panel">
        <h2>L'education en langues locales change tout</h2>
        <p>
          Quand un eleve comprend vraiment, il reprend confiance. iSkul combine technologie, pedagogie et ancrage
          culturel pour transformer cette comprehension en resultats mesurables.
        </p>
      </section>
    </div>
  );
}

export function App() {
  return (
    <div className="site-root">
      <ScrollToTop />
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/inscription-professeur" element={<TeacherSignupPage />} />
          <Route path="/cours" element={<CoursesPage />} />
          <Route path="/bibliotheque" element={<LibraryPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="/open-classroom" element={<OpenClassroomPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}

