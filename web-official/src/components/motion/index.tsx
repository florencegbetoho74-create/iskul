import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  animateCount,
  bindMagnetic,
  bindScrollProgress,
  prefersReducedMotion,
  scanParallax,
  scanReveals,
} from "../../lib/motion";

/**
 * Les objets animes du site.
 *
 * Chacun se contente de poser les attributs que la couche de mouvement
 * observe. Aucun n'anime quoi que ce soit lui-meme : c'est ce qui permet a une
 * page ecrite en HTML nu de beneficier des memes effets sans importer un
 * composant.
 */

/* -------------------------------------------------------------------------- */
/* Amorçage                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Rearme les effets a chaque changement de route.
 *
 * Le rendu de la nouvelle page n'a pas encore eu lieu au moment ou l'URL
 * change : le balayage attend une image, sans quoi il ne trouve que l'ancien
 * contenu.
 */
export function useMotionRuntime(): void {
  const location = useLocation();

  useEffect(() => bindScrollProgress(), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scanReveals();
      scanParallax();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);
}

/** Barre fine indiquant l'avancement dans la page. */
export function ScrollProgress() {
  return <div className="scroll-progress" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Apparition                                                                 */
/* -------------------------------------------------------------------------- */

type RevealKind = "up" | "down" | "left" | "right" | "scale" | "clip" | "fade";

type RevealProps = {
  children: React.ReactNode;
  kind?: RevealKind;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
};

export function Reveal({ children, kind = "up", delay, className, as = "div" }: RevealProps) {
  const Tag = as;
  return (
    <Tag
      className={className}
      data-reveal={kind}
      data-reveal-delay={delay ? String(delay) : undefined}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Titre revele mot a mot                                                     */
/* -------------------------------------------------------------------------- */

type SplitTextProps = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  /** Retard entre deux mots, en millisecondes. */
  step?: number;
  delay?: number;
};

/**
 * Chaque mot monte derriere un masque.
 *
 * Le texte complet est porte par `aria-label` et les fragments sont masques
 * aux technologies d'assistance : lus un a un, ils donneraient une phrase
 * hachee.
 */
export function SplitText({
  text,
  as: Tag = "h2",
  className,
  step = 42,
  delay = 0,
}: SplitTextProps) {
  const words = text.split(" ").filter(Boolean);

  return (
    <Tag
      className={["split-text", className].filter(Boolean).join(" ")}
      data-reveal="fade"
      data-reveal-delay={delay ? String(delay) : undefined}
      aria-label={text}
    >
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="split-word" aria-hidden="true">
            <span style={{ ["--word-delay" as string]: `${delay + index * step}ms` }}>{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Compteur                                                                   */
/* -------------------------------------------------------------------------- */

type CounterProps = {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
};

/** Le nombre ne defile qu'une fois entre dans le champ. */
export function Counter({ to, prefix = "", suffix = "", decimals = 0, className }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      animateCount(el, to, { decimals, prefix, suffix });
      setDone(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        animateCount(el, to, { decimals, prefix, suffix });
        setDone(true);
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, prefix, suffix, decimals, done]);

  // La valeur finale est ecrite des le rendu : sans script, le nombre est la.
  return (
    <span ref={ref} className={className}>
      {`${prefix}${to.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Bandeau defilant                                                           */
/* -------------------------------------------------------------------------- */

type MarqueeProps = {
  items: string[];
  /** Duree d'un tour complet, en secondes. */
  duration?: number;
  className?: string;
};

/**
 * Le contenu est double : la seconde copie prend la place de la premiere quand
 * elle sort, ce qui donne une boucle sans rupture. La copie est masquee aux
 * technologies d'assistance pour ne pas enoncer deux fois la meme liste.
 */
export function Marquee({ items, duration = 38, className }: MarqueeProps) {
  const track = (hidden: boolean) => (
    <div className="marquee__track" aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="marquee__item">
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={["marquee", className].filter(Boolean).join(" ")}
      style={{ ["--marquee-duration" as string]: `${duration}s` }}
    >
      {track(false)}
      {track(true)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bouton magnetique                                                          */
/* -------------------------------------------------------------------------- */

/** Attache l'effet magnetique a un element. Sans effet au doigt. */
export function useMagnetic<T extends HTMLElement>(strength?: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ref.current) return;
    return bindMagnetic(ref.current, strength);
  }, [strength]);
  return ref;
}
