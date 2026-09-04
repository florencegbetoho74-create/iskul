import type { ReactNode } from "react";

import { SplitText } from "../motion";

type Props = {
  eyebrow: string;
  title: string;
  lead: string;
  /** Ce que le visiteur peut faire tout de suite, s'il y a lieu. */
  actions?: ReactNode;
};

/**
 * Entete de page.
 *
 * Les trois pages de presentation ouvraient chacune avec un balisage different
 * pour un resultat identique. Une seule entete leur donne le meme rythme, et
 * evite que la quatrieme invente encore une variante.
 */
export default function PageHero({ eyebrow, title, lead, actions }: Props) {
  return (
    <header className="page-hero">
      <span className="eyebrow" data-reveal="up">
        {eyebrow}
      </span>
      <SplitText as="h1" text={title} />
      <p className="lead" data-reveal="up" data-reveal-delay="200">
        {lead}
      </p>
      {actions ? (
        <div className="page-hero-actions" data-reveal="up" data-reveal-delay="280">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
