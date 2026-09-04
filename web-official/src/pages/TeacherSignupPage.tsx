import { FormEvent, useEffect, useMemo, useState } from "react";
import PageHero from "../components/page/PageHero";
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
    <div className="page container signup-page">
      <PageHero
        eyebrow="Enseigner sur iSkul"
        title="Vos cours, vus par vos élèves et par d'autres."
        lead="Un compte professeur donne accès à la création de cours, de quiz et de séances en direct. Ce formulaire crée le compte ; le travail se fait ensuite depuis l'application."
      />

      <section className="signup-grid" data-reveal="up">
        <article className="signup-showcase">
          <h2>Ce qu'il faut savoir avant de commencer</h2>

          {/*
            Les trois pastilles annoncaient "3 min de temps moyen", "100 % de
            tracabilite" et "Securise" : deux chiffres que personne ne mesure et
            un adjectif presente comme une metrique. La liste ci-dessous ne dit
            que des choses verifiables.
          */}
          <ul className="signup-list">
            <li>
              <strong>Vos contenus passent par une relecture.</strong> Un cours, un quiz ou un
              document n'est visible par les élèves qu'une fois validé. Un contenu renvoyé revient
              avec le motif écrit.
            </li>
            <li>
              <strong>La création se fait dans l'application.</strong> Chapitres, vidéos et
              versions en langue locale s'ajoutent depuis le téléphone. Le web sert à suivre
              l'activité de vos classes et à corriger vos fiches.
            </li>
            <li>
              <strong>Vous gardez vos contenus.</strong> Ce que vous déposez reste à vous ; le
              publier sur iSkul en autorise la diffusion auprès des élèves.
            </li>
            <li>
              <strong>Les inscriptions peuvent être fermées.</strong> L'équipe ouvre le portail par
              périodes. Si le formulaire refuse votre demande, écrivez-nous.
            </li>
          </ul>

          <p className="signup-contact">
            Une question avant de vous inscrire :{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
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
              <strong>Inscription finalisée</strong>
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
            <span>Rôle : Professeur</span>
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
