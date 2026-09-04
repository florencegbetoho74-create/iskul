import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, OFFICIAL_WEB_ENV_ERROR } from "../lib/supabase";
import { resolveContactError } from "../lib/errors";
import { isEmail } from "../lib/validation";
import PageHero from "../components/page/PageHero";

export default function ContactPage() {
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
    <div className="page container container--narrow">
      <PageHero
        eyebrow="Contact"
        title="Écrivez-nous."
        lead="Une question sur la plateforme, une collaboration, une demande d'établissement : ce formulaire arrive directement à l'équipe."
      />

      {OFFICIAL_WEB_ENV_ERROR ? (
        <div className="notice danger">
          <p>{OFFICIAL_WEB_ENV_ERROR}</p>
        </div>
      ) : null}

      {sent ? (
        <div className="notice success" data-reveal="up">
          <p>
            Votre message est parti. Nous répondons sous deux jours ouvrés à l'adresse que vous
            avez indiquée.
          </p>
        </div>
      ) : (
        <form className="card stack" onSubmit={submit} data-reveal="up">
          <div className="field">
            <label htmlFor="contact-name">Nom</label>
            <input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              autoComplete="name"
            />
          </div>

          <div className="field">
            <label htmlFor="contact-email">Adresse e-mail</label>
            <span className="field-hint">C'est à cette adresse que nous répondrons.</span>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Dites-nous ce dont vous avez besoin."
              rows={6}
            />
          </div>

          {error ? (
            <div className="notice danger">
              <p>{error}</p>
            </div>
          ) : null}

          <div className="row">
            <button className="btn primary" disabled={disabled}>
              {busy ? "Envoi…" : "Envoyer"}
            </button>
            <Link className="btn ghost" to="/faq">
              Voir la FAQ d'abord
            </Link>
          </div>

          <p className="field-hint">
            Votre adresse ne sert qu'à vous répondre. Elle n'alimente aucune liste de diffusion.
          </p>
        </form>
      )}
    </div>
  );
}
