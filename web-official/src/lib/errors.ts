/**
 * Traduction des echecs serveur en phrases lisibles.
 *
 * Un message brut d'API dans une interface publique n'apprend rien a qui le
 * lit et revele parfois la forme du back-office.
 */

export function mapTeacherSignupError(err: unknown): string {
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

export async function resolveTeacherSignupError(err: unknown): Promise<string> {
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

export function mapContactError(err: unknown): string {
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

export async function resolveContactError(err: unknown): Promise<string> {
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

export function mapAccountDeletionRequestError(err: unknown): string {
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

export async function resolveAccountDeletionRequestError(err: unknown): Promise<string> {
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
