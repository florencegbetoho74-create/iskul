import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, OFFICIAL_WEB_ENV_ERROR } from "../lib/supabase";
import { resolveContactError } from "../lib/errors";
import { isEmail } from "../lib/validation";

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
