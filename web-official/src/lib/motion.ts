/**
 * Couche de mouvement.
 *
 * Les sites primes pour leur animation s'appuient en general sur GSAP, Lenis
 * et parfois WebGL : deux cents kilo-octets avant la premiere image. iSkul
 * s'adresse a des eleves beninois, souvent sur un Android modeste et une
 * connexion lente. Tout ce qui suit tient donc sur les API natives -- un seul
 * IntersectionObserver, des transformations composees par le GPU, et
 * requestAnimationFrame -- pour quelques kilo-octets.
 *
 * Trois regles tenues partout :
 *   - une preference systeme pour moins d'animation coupe tout, sans exception ;
 *   - rien n'anime la geometrie (largeur, hauteur, marges) : uniquement
 *     `transform` et `opacity`, les deux seules proprietes qui ne declenchent
 *     pas de recalcul de mise en page ;
 *   - un contenu jamais anime reste visible : une animation qui echoue ne doit
 *     pas effacer la page.
 */

const REVEALED = "is-revealed";
const REVEAL_SELECTOR = "[data-reveal]";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* -------------------------------------------------------------------------- */
/* Apparitions au defilement                                                  */
/* -------------------------------------------------------------------------- */

let observer: IntersectionObserver | null = null;
const watched = new WeakSet<Element>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return null;
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add(REVEALED);
        // Le travail est fini : `will-change` libere sa memoire une fois la
        // transition passee, et l'element n'est plus observe.
        window.setTimeout(() => {
          el.style.willChange = "";
        }, 900);
        observer?.unobserve(el);
      }
    },
    {
      // L'element apparait un peu avant d'etre au bord : l'animation a le
      // temps de se jouer pendant que le regard arrive.
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.08,
    }
  );
  return observer;
}

/**
 * Repartit un retard croissant sur les enfants d'un conteneur `data-stagger`.
 * Ecrire ce retard a la main sur chaque carte est la premiere chose qu'on
 * oublie de mettre a jour en ajoutant la sixieme.
 */
function applyStagger(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-stagger]").forEach((group) => {
    const step = Number(group.dataset.stagger) || 70;
    const children = Array.from(group.children) as HTMLElement[];
    children.forEach((child, index) => {
      const target = child.hasAttribute("data-reveal")
        ? child
        : child.querySelector<HTMLElement>(REVEAL_SELECTOR);
      if (!target || target.dataset.revealDelay) return;
      // Au-dela d'une poignee d'elements, l'attente devient une gene : le
      // retard plafonne plutot que de croitre indefiniment.
      target.dataset.revealDelay = String(Math.min(index * step, 420));
    });
  });
}

/**
 * Arme les elements a reveler, y compris ceux qui viennent d'apparaitre apres
 * un changement de route.
 */
export function scanReveals(root: ParentNode = document): void {
  if (typeof document === "undefined") return;

  const elements = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

  if (prefersReducedMotion()) {
    // Pas d'apparition progressive : le contenu est simplement la.
    elements.forEach((el) => el.classList.add(REVEALED));
    return;
  }

  applyStagger(root);
  const io = ensureObserver();

  elements.forEach((el) => {
    if (watched.has(el) || el.classList.contains(REVEALED)) return;
    watched.add(el);

    const delay = Number(el.dataset.revealDelay) || 0;
    if (delay) el.style.transitionDelay = `${delay}ms`;
    el.style.willChange = "transform, opacity";

    if (!io) {
      // Sans observateur, tout s'affiche : mieux vaut un site sans animation
      // qu'un site vide.
      el.classList.add(REVEALED);
      return;
    }
    io.observe(el);
  });
}

/* -------------------------------------------------------------------------- */
/* Parallaxe                                                                  */
/* -------------------------------------------------------------------------- */

type ParallaxItem = { el: HTMLElement; depth: number };

let parallaxItems: ParallaxItem[] = [];
let parallaxFrame = 0;
let parallaxBound = false;

function renderParallax(): void {
  parallaxFrame = 0;
  const viewport = window.innerHeight;
  for (const { el, depth } of parallaxItems) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > viewport + 200) continue;
    // Position de l'element dans la fenetre, de -1 (sorti par le haut) a 1.
    const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
    el.style.transform = `translate3d(0, ${(progress * depth * 100).toFixed(2)}px, 0)`;
  }
}

function requestParallax(): void {
  if (parallaxFrame) return;
  parallaxFrame = window.requestAnimationFrame(renderParallax);
}

/**
 * Fait avancer les plans a des vitesses differentes. `data-parallax` porte la
 * profondeur : negatif pour un plan qui remonte, positif pour un plan qui
 * traine.
 */
export function scanParallax(root: ParentNode = document): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  // La parallaxe au doigt donne un rendu saccade sur les appareils modestes,
  // qui sont precisement ceux de la plupart des eleves.
  if (!window.matchMedia("(hover: hover) and (min-width: 900px)").matches) return;

  parallaxItems = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]")).map((el) => ({
    el,
    depth: Number(el.dataset.parallax) || 0.15,
  }));

  if (!parallaxItems.length) return;

  if (!parallaxBound) {
    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax, { passive: true });
    parallaxBound = true;
  }
  requestParallax();
}

/* -------------------------------------------------------------------------- */
/* Progression de lecture                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ecrit l'avancement de la page dans une variable CSS. Une barre de lecture,
 * un en-tete qui se compacte : tout se decide ensuite en CSS.
 */
export function bindScrollProgress(): () => void {
  if (typeof window === "undefined") return () => {};
  let frame = 0;

  const update = () => {
    frame = 0;
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    doc.style.setProperty("--scroll-progress", ratio.toFixed(4));
    doc.dataset.scrolled = window.scrollY > 24 ? "true" : "false";
  };

  const request = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  update();

  return () => {
    window.removeEventListener("scroll", request);
    window.removeEventListener("resize", request);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

/* -------------------------------------------------------------------------- */
/* Boutons magnetiques                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Le bouton se decale legerement vers le curseur. Reserve au pointeur precis :
 * au doigt, il n'y a pas de survol, et l'effet ne ferait que retarder le tap.
 */
export function bindMagnetic(el: HTMLElement, strength = 0.28): () => void {
  if (typeof window === "undefined") return () => {};
  if (prefersReducedMotion()) return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};

  let frame = 0;

  const move = (event: PointerEvent) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * strength;
      el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    });
  };

  const reset = () => {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    el.style.transform = "";
  };

  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", reset);
  // Un bouton atteint au clavier ne doit pas rester decale.
  el.addEventListener("blur", reset);

  return () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", reset);
    el.removeEventListener("blur", reset);
    reset();
  };
}

/* -------------------------------------------------------------------------- */
/* Comptage                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fait defiler un nombre jusqu'a sa valeur. La courbe ralentit a l'arrivee :
 * une progression lineaire donne l'impression que le compteur s'arrete net.
 */
export function animateCount(
  el: HTMLElement,
  to: number,
  options: { duration?: number; decimals?: number; suffix?: string; prefix?: string } = {}
): void {
  const { duration = 1400, decimals = 0, suffix = "", prefix = "" } = options;

  const render = (value: number) => {
    el.textContent = `${prefix}${value.toLocaleString("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  };

  if (prefersReducedMotion() || typeof window === "undefined") {
    render(to);
    return;
  }

  const start = performance.now();
  const step = (now: number) => {
    const linear = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - linear, 3);
    render(to * eased);
    if (linear < 1) window.requestAnimationFrame(step);
    else render(to);
  };
  window.requestAnimationFrame(step);
}

/* -------------------------------------------------------------------------- */
/* Transitions de page                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Enveloppe un changement de route dans une transition native quand le
 * navigateur la propose, et l'execute directement sinon.
 */
export function withViewTransition(run: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };
  if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    run();
    return;
  }
  doc.startViewTransition(run);
}
