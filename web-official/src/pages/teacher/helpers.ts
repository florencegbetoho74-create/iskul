/**
 * Fonctions de l'espace professeur qui ne dependent d'aucun etat.
 *
 * Elles etaient melees au composant, entre deux declarations de useState.
 */

import type { QuizEditorQuestion, QuizForm, QuizRawQuestion } from "./types";

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function safeNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function createLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEmptyQuestion(): QuizEditorQuestion {
  return {
    localId: createLocalId("q"),
    prompt: "",
    options: ["", ""],
    correctIndex: 0,
  };
}

export function makeEmptyQuizForm(): QuizForm {
  return {
    id: null,
    scope: "standalone",
    courseId: "",
    chapterId: "",
    title: "",
    description: "",
    level: "",
    subject: "",
    published: false,
    questions: [makeEmptyQuestion()],
  };
}

export function toErrorMessage(error: unknown): string {
  const anyError = error as { message?: string; code?: string };
  const code = String(anyError?.code || "");
  const message = String(anyError?.message || "");
  const lower = message.toLowerCase();

  if (code === "PGRST202") return "Backend indisponible. Verifiez les migrations Supabase.";
  if (code === "23505") return "Un quiz existe deja pour cette lecon.";
  if (lower.includes("invalid login credentials")) return "Identifiants invalides.";
  if (lower.includes("row-level security")) return "Action refusee par la politique de securite.";
  if (lower.includes("networkerror") || lower.includes("failed to fetch")) {
    return "Connexion reseau impossible. Verifiez votre connexion puis reessayez.";
  }
  return message || "Une erreur est survenue.";
}

export function toDateLabel(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}

export function toDatetimeLocalInput(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return "";
  const offsetMs = new Date(ms).getTimezoneOffset() * 60000;
  return new Date(ms - offsetMs).toISOString().slice(0, 16);
}

export function parseDatetimeLocalInput(value: string) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

export function normalizeQuizQuestions(raw: unknown): QuizEditorQuestion[] {
  if (!Array.isArray(raw)) return [makeEmptyQuestion()];

  const result = raw
    .map((item) => {
      const q = (item || {}) as QuizRawQuestion;
      const prompt = String(q.prompt || "").trim();
      const baseOptions = Array.isArray(q.options)
        ? q.options.map((opt) => String(opt || ""))
        : [];
      const options = baseOptions.length >= 2 ? baseOptions : [...baseOptions, "", ""].slice(0, 2);

      const correctFromArray = Array.isArray(q.correctIndices)
        ? q.correctIndices
            .map((idx) => Number(idx))
            .filter((idx) => Number.isFinite(idx))
            .map((idx) => Math.floor(idx))
            .filter((idx) => idx >= 0 && idx < options.length)
        : [];

      const singleRaw = Number(q.correctIndex);
      const correctFromSingle =
        Number.isFinite(singleRaw) && singleRaw >= 0 && singleRaw < options.length
          ? Math.floor(singleRaw)
          : null;

      const correctIndex = correctFromArray[0] ?? correctFromSingle ?? 0;

      return {
        localId: q.id ? String(q.id) : createLocalId("q"),
        prompt,
        options,
        correctIndex,
      } as QuizEditorQuestion;
    })
    .filter((question) => question.prompt || question.options.some((option) => option.trim().length > 0));

  return result.length ? result : [makeEmptyQuestion()];
}

export function prepareQuizQuestions(
  questions: QuizEditorQuestion[]
): { ok: true; value: Array<{ id: string; prompt: string; options: string[]; correctIndices: number[] }> } | { ok: false; error: string } {
  const prepared: Array<{ id: string; prompt: string; options: string[]; correctIndices: number[] }> = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const prompt = question.prompt.trim();

    if (!prompt) {
      return { ok: false, error: `La question ${index + 1} n'a pas d'intitule.` };
    }

    const optionMap = new Map<number, number>();
    const cleanedOptions: string[] = [];

    question.options.forEach((option, optionIndex) => {
      const trimmed = option.trim();
      if (!trimmed) return;
      optionMap.set(optionIndex, cleanedOptions.length);
      cleanedOptions.push(trimmed);
    });

    if (cleanedOptions.length < 2) {
      return { ok: false, error: `La question ${index + 1} doit avoir au moins 2 options.` };
    }

    const mappedCorrect = optionMap.get(question.correctIndex);
    if (mappedCorrect === undefined) {
      return { ok: false, error: `La reponse correcte de la question ${index + 1} est invalide.` };
    }

    prepared.push({
      id: question.localId || createLocalId("q"),
      prompt,
      options: cleanedOptions,
      correctIndices: [mappedCorrect],
    });
  }

  return { ok: true, value: prepared };
}

export function dayLabel(dayKey: string) {
  const parsed = new Date(`${dayKey}T00:00:00`);
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function polylinePoints(values: number[], maxValue: number, width: number, height: number) {
  if (!values.length || maxValue <= 0) return "";
  if (values.length === 1) return `0,${height / 2}`;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (Math.max(0, value) / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}
