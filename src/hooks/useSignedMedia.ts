import { useEffect, useState } from "react";

import { signedMediaUrl } from "@/lib/mediaUrl";

/**
 * Resout l'adresse d'un fichier stocke.
 *
 * Le bucket est prive : rien ne s'affiche sans une URL signee de courte duree.
 * Le crochet rend null tant qu'il n'a pas de reponse, et null aussi quand le
 * droit manque -- un fichier qu'on n'a pas le droit de voir est un contenu
 * absent, pas une erreur a afficher.
 */
export function useSignedMedia(
  url?: string | null,
  kind: "file" | "video" = "file"
): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    void signedMediaUrl(url, kind).then((next) => {
      if (active) setResolved(next);
    });
    return () => {
      active = false;
    };
  }, [url, kind]);

  return resolved;
}
