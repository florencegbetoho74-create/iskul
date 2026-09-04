import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, OFFICIAL_WEB_ENV_ERROR } from "../lib/supabase";
import StoreButton from "../components/brand/StoreButton";
import { SUPPORT_EMAIL } from "../config";
import { resolveTeacherSignupError } from "../lib/errors";
import { getPasswordStrength, isEmail } from "../lib/validation";

export default function TeacherSignupPage() {
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
          Inscription dediee aux enseignants. Le web donne accès a des statistiques détaillées ; l'experience complète de
          création/organisation de contenus est pensee pour l'application iSkul.
        </p>
      </header>

      <section className="signup-grid" data-reveal="up">
        <article className="signup-showcase">
          <span className="kicker signup-kicker">Portail enseignant</span>
          <h2>Un onboarding clair, sécurisé et rapide.</h2>
          <p>
            Ce portail centralise la création de compte professeur et garantit un contrôle qualite avant accès aux outils.
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
              <strong>Sécurisé</strong>
              <span>Validation</span>
            </div>
          </div>

          <ul className="signup-list">
            <li>Création automatique du profil avec role enseignant.</li>
            <li>Contrôle via politique d'ouverture du portail et domaine autorise.</li>
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

          <section className="form-section" data-reveal="up">
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

          <section className="form-section" data-reveal="up">
            <h3>2. Profil enseignant</h3>
            <div className="form-grid-two">
              <label className="form-field">
                Établissement
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  placeholder="College, lycee, universite"
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
            L'accès reste sécurisé par la politique du portail enseignant et les regles de validation cote serveur.
          </p>

          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Je confirme que ces informations sont exactes et que j'ai l'autorisation de créer ce compte.</span>
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
              <p>{success || "Le compte professeur a été créé avec succès."}</p>
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
            <span>Accès : Web + App</span>
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
