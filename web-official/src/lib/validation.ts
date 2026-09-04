/** Verifications de saisie partagees par les formulaires. */

export type PasswordStrength = {
  score: number;
  label: string;
  tone: "weak" | "medium" | "strong";
  percent: number;
};

/** ---------------------------
 *  CONFIG / ENV
 *  --------------------------*/

/** ---------------------------
 *  HELPERS
 *  --------------------------*/
export function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function getPasswordStrength(password: string): PasswordStrength {
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
