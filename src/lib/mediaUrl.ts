import { supabase } from "@/lib/supabase";

/**
 * Adresses des fichiers stockes.
 *
 * Le bucket est prive : une adresse publique ne repond plus. Chaque lecture
 * demande une URL signee de courte duree, que le serveur n'accorde que si la
 * politique de `storage.objects` le permet -- publie, depose par soi, ou en
 * relecture pour qui le relit.
 *
 * Les adresses deja enregistrees en base restent des URL publiques completes.
 * On en extrait le chemin plutot que d'exiger une reecriture des donnees : la
 * migration fait de meme cote serveur.
 */

const BUCKET = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || "iskul";

/**
 * Une minute suffit a ouvrir un fichier, et ne laisse pas une adresse
 * circuler. Une video demande plus : la lecture doit tenir jusqu'au bout, et
 * une coupure a mi-parcours serait pire qu'une adresse valable une heure.
 */
const TTL_FILE = 60;
const TTL_VIDEO = 60 * 60;

/** Extrait le chemin d'une adresse Storage, publique ou signee. */
export function storagePathFromUrl(url?: string | null): string | null {
  const value = (url || "").trim();
  if (!value) return null;
  // Un chemin nu a deja la bonne forme.
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  const match = value.match(
    new RegExp(`/object/(?:public|sign)/${BUCKET}/(.+?)(?:\\?|$)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

const cache = new Map<string, { url: string; expiresAtMs: number }>();

/**
 * Rend une adresse lisible pour ce fichier, ou null si le droit manque.
 *
 * L'echec est silencieux et rend null : un fichier qu'on n'a pas le droit de
 * lire n'est pas une erreur a afficher, c'est un contenu absent.
 */
export async function signedMediaUrl(
  urlOrPath?: string | null,
  kind: "file" | "video" = "file"
): Promise<string | null> {
  const path = storagePathFromUrl(urlOrPath);
  if (!path) return null;

  const ttl = kind === "video" ? TTL_VIDEO : TTL_FILE;

  // On garde l'adresse un peu moins longtemps qu'elle n'est valable : une URL
  // qui expire pendant la lecture donnerait une erreur inexplicable.
  const hit = cache.get(path);
  if (hit && hit.expiresAtMs > Date.now()) return hit.url;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
    if (error || !data?.signedUrl) return null;
    cache.set(path, {
      url: data.signedUrl,
      expiresAtMs: Date.now() + (ttl - 20) * 1000,
    });
    return data.signedUrl;
  } catch {
    return null;
  }
}

/** Signe plusieurs fichiers en un appel. Les refus deviennent null. */
export async function signedMediaUrls(
  urls: (string | null | undefined)[],
  kind: "file" | "video" = "file"
): Promise<(string | null)[]> {
  return Promise.all(urls.map((url) => signedMediaUrl(url, kind)));
}

/** Vide le cache. A appeler a la deconnexion : les droits changent. */
export function clearMediaCache(): void {
  cache.clear();
}
