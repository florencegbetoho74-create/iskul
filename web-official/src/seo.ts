import { useEffect } from "react";

type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type SeoRoute = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  breadcrumb: string;
  ogType: "website" | "article";
  noIndex?: boolean;
  includeInSitemap?: boolean;
  changeFrequency: ChangeFrequency;
  priority: number;
};

type JsonLdObject = Record<string, unknown>;

const DEFAULT_SITE_URL = "https://iskul-ten.vercel.app";
const JSON_LD_ID = "iskul-seo-jsonld";
const INDEX_ROBOTS = "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex,nofollow,max-snippet:-1,max-image-preview:none,max-video-preview:-1";
const THEME_COLOR = "#0b6aff";

// NB: c'est un email support (ok d'être public). L'email akpiricardo@gmail.com reste côté serveur (contact-message).
const SUPPORT_EMAIL = String(import.meta.env.VITE_SUPPORT_EMAIL || "support@iskul.app").trim();

function normalizeSiteUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return DEFAULT_SITE_URL;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function normalizePath(pathname: string): string {
  const noQuery = pathname.split("?")[0]?.split("#")[0] || "/";
  const withLeadingSlash = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  const compact = withLeadingSlash.replace(/\/{2,}/g, "/");
  if (compact.length > 1 && compact.endsWith("/")) return compact.slice(0, -1);
  return compact || "/";
}

const SITE_URL = normalizeSiteUrl(String(import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL));
const SITE_ROOT_URL = `${SITE_URL}/`;
const OG_IMAGE_URL = new URL("/og-image.png", SITE_ROOT_URL).toString();

/** Mots-clés communs — plus naturels et "produit" */
const COMMON_KEYWORDS = [
  "iSkul",
  "EdTech",
  "éducation",
  "apprentissage",
  "vidéos de cours",
  "quiz de compréhension",
  "statistiques de progression",
  "Afrique francophone",
  "cours en ligne",
  "plateforme éducative",
];

/** SEO par route */
const ROUTE_SEO: Record<string, SeoRoute> = {
  "/": {
    path: "/",
    title: "iSkul — Comprendre ses cours avec vidéos, quiz et statistiques",
    description:
      "iSkul aide les élèves à mieux comprendre leurs cours grâce à des vidéos par chapitre (en français et langues locales), des quiz par séquence et un suivi de progression. Open Classroom en live et bibliothèque pédagogique.",
    keywords: [
      ...COMMON_KEYWORDS,
      "Open Classroom",
      "bibliothèque pédagogique",
      "langues locales",
      "cours bilingues",
    ],
    breadcrumb: "Accueil",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 1,
  },

  "/cours": {
    path: "/cours",
    title: "Cours & Quiz — iSkul",
    description:
      "Des cours structurés pour comprendre avant de mémoriser : vidéo par chapitre, quiz de compréhension par séquence et statistiques de progression.",
    keywords: [
      ...COMMON_KEYWORDS,
      "cours & quiz",
      "vidéo par chapitre",
      "quiz par séquence",
      "révisions",
      "collège",
      "lycée",
    ],
    breadcrumb: "Cours & Quiz",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.9,
  },

  "/bibliotheque": {
    path: "/bibliotheque",
    title: "Bibliothèque — iSkul",
    description:
      "Bibliothèque iSkul : documents pédagogiques, supports de révision et ressources utiles pour apprendre, consolider et approfondir.",
    keywords: [
      ...COMMON_KEYWORDS,
      "bibliothèque",
      "documents pédagogiques",
      "supports de cours",
      "livres",
      "ressources éducatives",
    ],
    breadcrumb: "Bibliothèque",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.8,
  },

  "/open-classroom": {
    path: "/open-classroom",
    title: "Open Classroom (Live) — iSkul",
    description:
      "Planning Open Classroom iSkul : sessions live interactives, questions-réponses, méthodologie et replays pour réviser à son rythme.",
    keywords: [
      ...COMMON_KEYWORDS,
      "Open Classroom",
      "cours en direct",
      "sessions live",
      "questions-réponses",
      "replays",
    ],
    breadcrumb: "Open Classroom",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "daily",
    priority: 0.8,
  },

  "/parents": {
    path: "/parents",
    title: "Espace parents — iSkul",
    description:
      "Espace parents iSkul : consultez les statistiques liées à l’élève (progression, scores, régularité) pour suivre sans pression inutile.",
    keywords: [
      ...COMMON_KEYWORDS,
      "espace parents",
      "suivi parental",
      "progression",
      "scores",
      "statistiques",
    ],
    breadcrumb: "Espace parents",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "daily",
    priority: 0.85,
  },

  "/a-propos": {
    path: "/a-propos",
    title: "À propos — iSkul",
    description:
      "Découvrez iSkul : une plateforme EdTech qui remet la compréhension au centre grâce aux vidéos, quiz et statistiques, en français et langues locales.",
    keywords: [
      ...COMMON_KEYWORDS,
      "mission",
      "vision",
      "éducation inclusive",
      "langues locales",
    ],
    breadcrumb: "À propos",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "monthly",
    priority: 0.7,
  },

  "/inscription-professeur": {
    path: "/inscription-professeur",
    title: "Devenir professeur — iSkul",
    description:
      "Inscription professeur iSkul : créez votre compte enseignant. Sur le web, consultez des statistiques détaillées ; l’expérience complète de création/organisation se fait dans l’application iSkul.",
    keywords: [
      ...COMMON_KEYWORDS,
      "devenir professeur",
      "inscription enseignant",
      "portail professeur",
      "statistiques enseignants",
    ],
    breadcrumb: "Devenir professeur",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.75,
  },

  "/espace-professeur": {
    path: "/espace-professeur",
    title: "Espace professeur — iSkul",
    description:
      "Espace professeur iSkul : indicateurs et statistiques détaillées. Pour créer et organiser les contenus, utilisez l’application iSkul.",
    keywords: [
      ...COMMON_KEYWORDS,
      "espace professeur",
      "statistiques",
      "performance",
      "engagement",
    ],
    breadcrumb: "Espace professeur",
    ogType: "website",
    noIndex: true,
    includeInSitemap: false,
    changeFrequency: "weekly",
    priority: 0.3,
  },

  "/contact": {
    path: "/contact",
    title: "Contact — iSkul",
    description:
      "Contactez l’équipe iSkul via le formulaire : questions, partenariats, demandes institutionnelles. Réponse dès que possible.",
    keywords: [
      ...COMMON_KEYWORDS,
      "contact",
      "partenariat",
      "support",
      "institution",
    ],
    breadcrumb: "Contact",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "monthly",
    priority: 0.5,
  },

  "/faq": {
    path: "/faq",
    title: "FAQ — iSkul",
    description:
      "FAQ iSkul : disponibilité de l’application, langues, fonctionnement des quiz, espace parents et espace professeur.",
    keywords: [
      ...COMMON_KEYWORDS,
      "FAQ",
      "questions fréquentes",
      "aide",
      "support",
    ],
    breadcrumb: "FAQ",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "monthly",
    priority: 0.45,
  },

  "/mentions-legales": {
    path: "/mentions-legales",
    title: "Mentions légales — iSkul",
    description:
      "Mentions légales et informations relatives au site iSkul.",
    keywords: [
      ...COMMON_KEYWORDS,
      "mentions légales",
      "informations légales",
      "confidentialité",
    ],
    breadcrumb: "Mentions légales",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "yearly",
    priority: 0.3,
  },
};

const DEFAULT_ROUTE = ROUTE_SEO["/"];

function resolveRouteSeo(pathname: string): SeoRoute {
  const normalizedPath = normalizePath(pathname);
  const route = ROUTE_SEO[normalizedPath];
  if (route) return route;
  return {
    ...DEFAULT_ROUTE,
    path: normalizedPath,
    // Par défaut : on indexe, mais si tu veux éviter d’indexer les 404 virtuelles,
    // tu peux ajouter noIndex: true ici.
  };
}

function toCanonicalUrl(pathname: string): string {
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === "/") return SITE_ROOT_URL;
  return `${SITE_URL}${normalizedPath}`;
}

function upsertMeta(kind: "name" | "property", key: string, content: string) {
  const selector = `meta[${kind}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(kind, key);
    document.head.append(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let tag = document.head.querySelector<HTMLLinkElement>(selector);
  if (!tag) {
    tag = document.createElement("link");
    document.head.append(tag);
  }
  Object.entries(attributes).forEach(([name, value]) => {
    tag?.setAttribute(name, value);
  });
}

function upsertJsonLd(id: string, payload: JsonLdObject[]) {
  const selector = `script#${id}[type="application/ld+json"]`;
  let tag = document.head.querySelector<HTMLScriptElement>(selector);
  if (!tag) {
    tag = document.createElement("script");
    tag.id = id;
    tag.type = "application/ld+json";
    document.head.append(tag);
  }
  tag.textContent = JSON.stringify(payload);
}

function buildBreadcrumbSchema(route: SeoRoute, canonicalUrl: string): JsonLdObject {
  const items: JsonLdObject[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Accueil",
      item: SITE_ROOT_URL,
    },
  ];

  if (route.path !== "/") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: route.breadcrumb,
      item: canonicalUrl,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function buildStructuredData(route: SeoRoute, canonicalUrl: string): JsonLdObject[] {
  const organizationSchema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ROOT_URL}#organization`,
    name: "iSkul",
    url: SITE_ROOT_URL,
    logo: {
      "@type": "ImageObject",
      url: OG_IMAGE_URL,
    },
    // Support public ok. (Ton email privé de réception contact reste côté serveur.)
    email: `mailto:${SUPPORT_EMAIL}`,
  };

  const websiteSchema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ROOT_URL}#website`,
    url: SITE_ROOT_URL,
    name: "iSkul",
    inLanguage: "fr-FR",
    publisher: {
      "@id": `${SITE_ROOT_URL}#organization`,
    },
  };

  const webPageSchema: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: route.title,
    description: route.description,
    inLanguage: "fr-FR",
    isPartOf: {
      "@id": `${SITE_ROOT_URL}#website`,
    },
    about: route.keywords,
  };

  return [organizationSchema, websiteSchema, webPageSchema, buildBreadcrumbSchema(route, canonicalUrl)];
}

export function getSitemapRoutes(): SeoRoute[] {
  return Object.values(ROUTE_SEO).filter((route) => route.includeInSitemap !== false && !route.noIndex);
}

export function useRouteSeo(pathname: string) {
  useEffect(() => {
    const route = resolveRouteSeo(pathname);
    const canonicalUrl = toCanonicalUrl(route.path);
    const robots = route.noIndex ? NOINDEX_ROBOTS : INDEX_ROBOTS;

    document.documentElement.lang = "fr";
    document.title = route.title;

    upsertMeta("name", "description", route.description);
    upsertMeta("name", "keywords", route.keywords.join(", "));
    upsertMeta("name", "robots", robots);
    upsertMeta("name", "googlebot", robots);
    upsertMeta("name", "theme-color", THEME_COLOR);
    upsertMeta("name", "author", "iSkul");
    upsertMeta("name", "application-name", "iSkul");

    upsertMeta("property", "og:locale", "fr_FR");
    upsertMeta("property", "og:type", route.ogType);
    upsertMeta("property", "og:site_name", "iSkul");
    upsertMeta("property", "og:title", route.title);
    upsertMeta("property", "og:description", route.description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", OG_IMAGE_URL);
    upsertMeta("property", "og:image:alt", "Logo iSkul");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", route.title);
    upsertMeta("name", "twitter:description", route.description);
    upsertMeta("name", "twitter:image", OG_IMAGE_URL);

    upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
    upsertLink('link[rel="alternate"][hreflang="fr"]', {
      rel: "alternate",
      hreflang: "fr",
      href: canonicalUrl,
    });
    upsertLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: "alternate",
      hreflang: "x-default",
      href: canonicalUrl,
    });

    upsertJsonLd(JSON_LD_ID, buildStructuredData(route, canonicalUrl));
  }, [pathname]);
}