import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, OFFICIAL_WEB_ENV_ERROR } from "../lib/supabase";
import { resolveAccountDeletionRequestError } from "../lib/errors";
import { isEmail } from "../lib/validation";

export default function DeleteAccountPage() {
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
          Utilisez ce formulaire si vous n'avez plus accès a l'application. Si vous etes connecte dans l'app iSkul,
          utilisez en priorite le menu <strong>Réglages &gt; Supprimer mon compte</strong>.
        </p>
      </header>

      <section className="content-card" data-reveal="up">
        <h3>Ce que traite cette demande</h3>
        <ul className="policy-list">
          <li>fermeture du compte utilisateur iSkul concerne ;</li>
          <li>suppression ou anonymisation des données associees, sous réservé des obligations legales ou de securite ;</li>
          <li>prise en charge par l'équipe iSkul a partir de l'email fourni.</li>
        </ul>
        <p className="policy-note">
          Pour toute autre question, utilisez aussi la page <Link to="/contact">Contact</Link> ou consultez la{" "}
          <Link to="/politique-confidentialite">Politique de confidentialite</Link>.
        </p>
      </section>

      {OFFICIAL_WEB_ENV_ERROR ? <p className="notice error">{OFFICIAL_WEB_ENV_ERROR}</p> : null}

      {sent ? (
        <p className="notice success">
          Votre demande de suppression a bien été enregistree. Nous reviendrons vers vous si une vérification
          supplementaire est nécessaire.
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
            <span>Je confirme être autorise a demander la suppression de ce compte et comprendre que cette action est irreversible une fois traitee.</span>
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
