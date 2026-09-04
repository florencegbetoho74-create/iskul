/**
 * Contenu editorial du site.
 *
 * Sorti des pages : ces listes changent souvent, et les chercher au milieu du
 * balisage est la premiere raison pour laquelle elles finissent dupliquees.
 */

/** ---------------------------
 *  NAVIGATION
 *  --------------------------*/
/**
 * Navigation.
 *
 * Huit entrees a plat melangeaient trois choses : des pages qui racontent le
 * produit, deux applications qui demandent une connexion, et un lien "Accueil"
 * que le logo fait deja. Un visiteur qui cliquait "Espace professeur" attendait
 * une presentation et tombait sur un formulaire.
 *
 * Le contenu est desormais a gauche, les acces a droite. Ce sont deux gestes
 * differents : on lit, ou on entre.
 */
export type NavLeaf = { to: string; label: string; hint?: string; end?: boolean };
export type NavEntry = NavLeaf & { children?: NavLeaf[] };

export const NAV_CONTENT: NavEntry[] = [
  {
    to: "/cours",
    label: "La plateforme",
    children: [
      { to: "/cours", label: "Cours & quiz", hint: "Chaque chapitre en video, puis un quiz" },
      { to: "/bibliotheque", label: "Bibliotheque", hint: "Epreuves, oeuvres et fiches de revision" },
      { to: "/open-classroom", label: "Open Classroom", hint: "Des seances en direct avec un professeur" },
    ],
  },
  { to: "/inscription-professeur", label: "Enseigner sur iSkul" },
  { to: "/a-propos", label: "A propos" },
  { to: "/faq", label: "Aide" },
];

/** Les espaces qui demandent un compte. Separes du contenu, jamais melanges. */
export const NAV_ACCOUNTS: NavLeaf[] = [
  { to: "/parents", label: "Espace parents", hint: "Suivre la progression de mon enfant" },
  { to: "/espace-professeur", label: "Espace professeur", hint: "Mes cours, mes quiz, mes seances" },
];

/** Photographie (élèves du secondaire) — traitée en duotone de marque côté CSS.
 *  Remplaçable par de vraies photos d'élèves béninois aux mêmes emplacements. */

/** Photographie (élèves du secondaire) — traitée en duotone de marque côté CSS.
 *  Remplaçable par de vraies photos d'élèves béninois aux mêmes emplacements. */
export const PHOTOS = {
  hero: "https://images.pexels.com/photos/34162714/pexels-photo-34162714.jpeg?auto=compress&cs=tinysrgb&w=1300",
  understand: "https://images.pexels.com/photos/34526416/pexels-photo-34526416.jpeg?auto=compress&cs=tinysrgb&w=1100",
  classroom: "https://images.pexels.com/photos/34526414/pexels-photo-34526414.jpeg?auto=compress&cs=tinysrgb&w=1100",
  live: "https://images.pexels.com/photos/34211750/pexels-photo-34211750.jpeg?auto=compress&cs=tinysrgb&w=1100",
  parents: "https://images.pexels.com/photos/34211744/pexels-photo-34211744.jpeg?auto=compress&cs=tinysrgb&w=1100",
} as const;

export const LEVELS = ["6ᵉ", "5ᵉ", "4ᵉ", "3ᵉ", "2ⁿᵈᵉ", "1ʳᵉ", "Tˡᵉ"];

export const SUBJECTS = [
  "Mathématiques",
  "PCT",
  "SVT",
  "Français",
  "Anglais",
  "Histoire-Géographie",
  "Philosophie",
  "Espagnol",
];

export const HERO_STATS = [
  { value: "6ᵉ → Tˡᵉ", label: "Tout le secondaire" },
  { value: "8+", label: "Matières du programme" },
  { value: "BEPC · BAC", label: "Préparation aux examens" },
  { value: "FR + langues", label: "Fon, Yoruba, Dendi…" },
];

export const PILLARS = [
  {
    title: "La langue n'est plus un mur",
    text: "Des explications en français et en langues locales (Fon, Yoruba, Dendi…) pour vraiment comprendre, pas seulement mémoriser.",
  },
  {
    title: "Le programme béninois, chapitre par chapitre",
    text: "Du collège à la terminale, aligné sur ce que l'élève voit réellement en classe au Bénin.",
  },
  {
    title: "Prêt pour le BEPC et le BAC",
    text: "Quiz d'entraînement, annales et révisions ciblées pour aborder les examens nationaux en confiance.",
  },
];

export const STEPS = [
  {
    num: "01",
    title: "Je regarde la vidéo",
    text: "Chaque chapitre est expliqué clairement, avec des exemples concrets, en français et en langues locales.",
  },
  {
    num: "02",
    title: "Je fais le quiz",
    text: "Des questions par séquence vérifient ce que j'ai vraiment compris — la compréhension, pas la chance.",
  },
  {
    num: "03",
    title: "Je suis ma progression",
    text: "Scores, régularité et points faibles : je sais exactement quoi réviser avant le BEPC ou le BAC.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "Avant, je récitais sans comprendre. Avec les explications en fon, les maths sont enfin devenues claires.",
    name: "Awa",
    role: "Élève en 3ᵉ",
    place: "Cotonou",
  },
  {
    quote:
      "Je vois où mon fils bloque sans avoir à le surveiller. Les statistiques sont simples à lire.",
    name: "M. Hounkpatin",
    role: "Parent",
    place: "Porto-Novo",
  },
  {
    quote:
      "Je crée mes quiz et je suis l'engagement de mes classes. Un vrai gain de temps au quotidien.",
    name: "Mme Adjovi",
    role: "Professeure de SVT",
    place: "Abomey",
  },
];

export const OPEN_CLASSROOM_EVENTS = [
  { day: "Lundi", hour: "18h00", topic: "Maths 3ᵉ — Théorème de Thalès et applications", teacher: "Équipe iSkul Maths" },
  { day: "Mercredi", hour: "19h00", topic: "Français Tˡᵉ — Méthode du commentaire de texte", teacher: "Équipe iSkul Lettres" },
  { day: "Samedi", hour: "10h00", topic: "Spécial BEPC — Révisions PCT et SVT", teacher: "Mentors iSkul" },
];

/** ---------------------------
 *  HELPERS
 *  --------------------------*/
