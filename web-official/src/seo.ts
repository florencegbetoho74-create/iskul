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

const COMMON_KEYWORDS = [
  "iSkul",
  "education",
  "edtech",
  "plateforme educative",
  "cours bilingues",
  "apprentissage en ligne",
  "Afrique francophone",
];

const ROUTE_SEO: Record<string, SeoRoute> = {
  "/": {
    path: "/",
    title: "iSkul | Plateforme EdTech bilingue pour eleves, parents et enseignants",
    description:
      "iSkul aide les eleves a mieux comprendre leurs cours en francais et en langues locales avec quiz, bibliotheque et sessions live.",
    keywords: [...COMMON_KEYWORDS, "open classroom", "suivi parental", "bibliotheque numerique"],
    breadcrumb: "Accueil",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 1,
  },
  "/cours": {
    path: "/cours",
    title: "Cours iSkul | Catalogue pedagogique bilingue",
    description:
      "Decouvrez les cours iSkul en francais et langues locales: mathematiques, sciences, communication et parcours adaptes au niveau de l'eleve.",
    keywords: [...COMMON_KEYWORDS, "cours en ligne", "mathematiques", "sciences", "francais"],
    breadcrumb: "Nos cours",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  "/bibliotheque": {
    path: "/bibliotheque",
    title: "Bibliotheque iSkul | E-books et resumes scolaires",
    description:
      "Accedez a la bibliotheque iSkul: e-books, resumes intelligents et ressources pedagogiques gratuites ou premium pour progresser rapidement.",
    keywords: [...COMMON_KEYWORDS, "bibliotheque numerique", "ebooks scolaires", "resumes de cours"],
    breadcrumb: "La bibliotheque",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  "/parents": {
    path: "/parents",
    title: "Espace Parents iSkul | Suivi scolaire en temps reel",
    description:
      "Suivez la progression des enfants avec des donnees claires: temps d'etude, quiz, lives et activite quotidienne dans l'espace parents iSkul.",
    keywords: [...COMMON_KEYWORDS, "suivi parental", "performance scolaire", "statistiques eleves"],
    breadcrumb: "Espace parents",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "daily",
    priority: 0.85,
  },
  "/open-classroom": {
    path: "/open-classroom",
    title: "Open Classroom iSkul | Sessions live educatives",
    description:
      "Consultez le planning Open Classroom iSkul: sessions live interactives, questions-reponses et replays pour reviser a votre rythme.",
    keywords: [...COMMON_KEYWORDS, "open classroom", "cours en direct", "sessions live"],
    breadcrumb: "Open Classroom",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "daily",
    priority: 0.8,
  },
  "/a-propos": {
    path: "/a-propos",
    title: "A propos de iSkul | Mission et vision EdTech",
    description:
      "Decouvrez la mission de iSkul: rendre l'excellence scolaire accessible en respectant la langue, la culture et le rythme de chaque eleve.",
    keywords: [...COMMON_KEYWORDS, "mission iSkul", "edtech afrique", "education inclusive"],
    breadcrumb: "A propos",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  "/inscription-professeur": {
    path: "/inscription-professeur",
    title: "Inscription professeur iSkul | Creer un compte enseignant",
    description:
      "Portail officiel d'inscription professeur iSkul: creation de compte enseignant, verification et activation securisee.",
    keywords: [...COMMON_KEYWORDS, "inscription enseignant", "portail professeur", "compte enseignant"],
    breadcrumb: "Inscription professeur",
    ogType: "website",
    includeInSitemap: true,
    changeFrequency: "weekly",
    priority: 0.75,
  },
  "/espace-professeur": {
    path: "/espace-professeur",
    title: "Espace professeur iSkul | Workspace enseignant",
    description:
      "Workspace enseignant iSkul pour gerer cours, livres, lives et quiz dans un espace pedagogique securise.",
    keywords: [...COMMON_KEYWORDS, "workspace enseignant", "gestion pedagogique", "console professeur"],
    breadcrumb: "Espace professeur",
    ogType: "website",
    noIndex: true,
    includeInSitemap: false,
    changeFrequency: "weekly",
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
