// src/lib/uploadSupabase.ts
import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import mime from "mime";

type UploadVideoArgs = {
  folder: string;
  filename: string;
  contentType?: string;
  onProgress?: (pct: number) => void;
};

type UploadVideoOut = {
  url: string;
  path: string;
  bucket: string;
};

function getEnv(key: string) {
  return (process.env as any)?.[key] as string | undefined;
}

function getSupabaseConfig() {
  const url = getEnv("EXPO_PUBLIC_SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");

  const key =
    getEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");

  const bucket = getEnv("EXPO_PUBLIC_SUPABASE_BUCKET") || "public";

  if (!url) throw new Error("Supabase env manquante: EXPO_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Supabase env manquante: EXPO_PUBLIC_SUPABASE_ANON_KEY (ou PUBLISHABLE_DEFAULT_KEY).");

  return { url, key, bucket };
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function isYouTubeUrl(s: string) {
  return /(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(s);
}

function isDirectMediaUrl(s: string) {
  return /\.(mp4|m3u8|mpd)(\?.*)?$/i.test(s);
}

function joinPath(folder: string, filename: string) {
  const f = (folder || "").replace(/^\/+|\/+$/g, "");
  return f ? `${f}/${filename}` : filename;
}

async function resolvePublicOrSignedUrl(bucket: string, path: string): Promise<string> {
  const pub = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = pub?.data?.publicUrl || "";

  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { method: "HEAD" });
      if (res.ok) return publicUrl;
    } catch {
      // ignore and fallback to signed URL
    }
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Upload OK mais URL introuvable: ${signed.error?.message || "signed URL missing"}`);
  }
  return signed.data.signedUrl;
}

/**
 * Copie un uri content:// vers un fichier dans le cache (Android),
 * sinon retourne l'uri original.
 */
async function ensureFileUri(inputUri: string, filenameForCache: string) {
  if (inputUri.startsWith("content://")) {
    const dest = (FileSystem.cacheDirectory || FileSystem.documentDirectory || "") + filenameForCache;
    if (!dest) throw new Error("Impossible de résoudre cacheDirectory/documentDirectory pour copier le fichier.");
    await FileSystem.copyAsync({ from: inputUri, to: dest });
    return dest; // file://...
  }
  return inputUri;
}

function guessContentType(filename: string, fallback: string) {
  return mime.getType(filename) || fallback;
}

function isNetworkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || "");
  return /network request failed|failed to fetch|networkerror/i.test(msg);
}

function isFileSystemUnavailable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || "");
  return err instanceof Error && (err.name === "UnavailabilityError" || /uploadAsync/i.test(msg));
}

async function uploadViaSignedUrl(args: {
  bucket: string;
  path: string;
  contentType: string;
  fileUri: string;
  onProgress?: (pct: number) => void;
}) {
  if (typeof FileSystem.createUploadTask !== "function") {
    throw new Error("uploadAsync not available");
  }

  const signed = await supabase.storage.from(args.bucket).createSignedUploadUrl(args.path, { upsert: true });
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error || new Error("Signed upload URL missing.");
  }

  args.onProgress?.(0);

  const task = FileSystem.createUploadTask(
    signed.data.signedUrl,
    args.fileUri,
    {
      httpMethod: "PUT",
      headers: {
        "Content-Type": args.contentType,
        "x-upsert": "true",
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    (evt) => {
      if (!args.onProgress) return;
      const total = evt.totalBytesExpectedToSend || 0;
      if (total > 0) {
        const pct = Math.round((evt.totalBytesSent / total) * 100);
        args.onProgress(Math.max(0, Math.min(100, pct)));
      }
    }
  );

  const result = await task.uploadAsync();
  const status = result?.status ?? 0;
  if (status < 200 || status >= 300) {
    const body = (result?.body || "").trim();
    throw new Error(`Upload Supabase echoue: HTTP ${status}${body ? " " + body : ""}`);
  }

  args.onProgress?.(100);
}

/**
 * Ping Supabase (stable)
 * -> On utilise l'endpoint santé + header apikey uniquement.
 * -> NE PAS mettre Authorization: Bearer <sb_publishable_...> (ce n'est pas un JWT user).
 */
export async function pingSupabaseOrThrow() {
  const { url, key } = getSupabaseConfig();

  const res = await fetch(`${url}/auth/v1/health`, {
    method: "GET",
    headers: { apikey: key },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ping Supabase non OK (HTTP ${res.status}). ${body}`.trim());
  }
}

/**
 * Upload principal (local) + cloud en secondaire.
 * - Local: upload dans Supabase Storage.
 * - Cloud: accepte uniquement un lien DIRECT mp4/m3u8/mpd.
 * - YouTube: interdit.
 */
export async function uploadVideoSupabase(uri: string, args: UploadVideoArgs): Promise<UploadVideoOut> {
  const { bucket } = getSupabaseConfig();

  // 1) Cloud en secondaire : lien direct uniquement + pas de YouTube
  if (isHttpUrl(uri)) {
    if (isYouTubeUrl(uri)) {
      throw new Error(
        "Liens YouTube interdits. Uploade un fichier local (principal) ou fournis un lien cloud DIRECT (.mp4/.m3u8/.mpd)."
      );
    }
    if (!isDirectMediaUrl(uri)) {
      throw new Error(
        "Lien cloud non valide. Fournis un lien DIRECT vers .mp4/.m3u8/.mpd (Drive/Dropbox/OneDrive doivent être en lien direct)."
      );
    }
    args.onProgress?.(100);
    return { url: uri, path: "", bucket: "external" };
  }

  // 2) Vérif session (upload doit être authentifié dans ton design)
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("Session requise pour uploader. Reconnecte-toi puis reessaye.");
  }

  const path = joinPath(args.folder, args.filename);
  let contentType = args.contentType || guessContentType(args.filename, "application/octet-stream");

  // ⚠️ IMPORTANT: on enverra à Supabase un Blob ou un ArrayBuffer (PAS Uint8Array)
  let payload: ArrayBuffer | null = null;
  // Use ArrayBuffer to avoid RN FormData/Blob 0-byte uploads.

  // (Optionnel) active logs de debug
  const DEBUG = false;

  try {
    await pingSupabaseOrThrow();
  } catch (e) {
    if (DEBUG) console.log("[uploadVideoSupabase] ping failed", e);
  }

  // 3) Normaliser l'uri (Android content:// -> file:// en cache)
  const normalizedUri = await ensureFileUri(uri, args.filename);

  // 3b) Prefer native upload (signed URL) when available to avoid fetch body issues.
  try {
    await uploadViaSignedUrl({
      bucket,
      path,
      contentType,
      fileUri: normalizedUri,
      onProgress: args.onProgress,
    });
    // Upload OK -> skip JS payload path
    const url = await resolvePublicOrSignedUrl(bucket, path);
    return { url, path, bucket };
  } catch (e) {
    if (!isFileSystemUnavailable(e)) {
      if (isNetworkError(e)) {
        throw new Error("Upload echoue: reseau indisponible. Verifie la connexion et l'URL Supabase.");
      }
      throw e;
    }
  }

  args.onProgress?.(0);

  // Essai 1: fetch -> blob (souvent OK pour file:// sur iOS/Android)
  try {
    const fileRes = await fetch(normalizedUri);
    if (!fileRes.ok) throw new Error(`Impossible de lire le fichier local (HTTP ${fileRes.status}).`);
    const blob = await fileRes.blob();

    if (blob.size > 0) {
      if (typeof (blob as any).arrayBuffer !== "function") {
        throw new Error("blob.arrayBuffer missing");
      }
      const buf = await blob.arrayBuffer();
      if (buf.byteLength > 0) {
        payload = buf;
        contentType = args.contentType || blob.type || contentType;
        if (DEBUG) console.log("[uploadVideoSupabase] buffer(bytes)", buf.byteLength, "type", contentType);
      } else {
        if (DEBUG) console.log("[uploadVideoSupabase] buffer.byteLength=0, fallback FileSystem");
      }
    } else {
      if (DEBUG) console.log("[uploadVideoSupabase] blob.size=0, fallback FileSystem");
    }
  } catch (e) {
    if (DEBUG) console.log("[uploadVideoSupabase] fetch(blob) failed, fallback FileSystem", e);
  }

  // Essai 2: lecture via FileSystem + Buffer (fallback robuste)
  if (!payload) {
    const info = await FileSystem.getInfoAsync(normalizedUri);
    if (!info.exists) {
      throw new Error("Fichier introuvable sur l'appareil.");
    }

    const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Buffer plus fiable que atob en RN/Expo
    const buf = Buffer.from(base64, "base64");

    if (!buf.length) {
      throw new Error("Lecture du fichier vide (0 byte). Vérifie les permissions ou le chemin.");
    }

    // Keep exact bytes to avoid 0-byte payloads.
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    payload = arrayBuffer;

    if (DEBUG) console.log("[uploadVideoSupabase] buffer(bytes)", payload.byteLength);
  }

  if (!payload || payload.byteLength === 0) {
    throw new Error("Impossible de préparer le fichier pour l'upload (payload vide).");
  }

  // 4) Upload Supabase
  const { error } = await supabase.storage.from(bucket).upload(path, payload, {
    contentType,
    upsert: true,
  });

  if (error) {
    const msg = error.message || "Erreur inconnue";

    if (isNetworkError(error)) {
      throw new Error("Upload echoue: reseau indisponible. Verifie la connexion et l'URL Supabase.");
    }

    if (/row-level security|violates row-level security|42501/i.test(msg)) {
      throw new Error(
        [
          "Upload Supabase échoué: RLS bloque l'upload (policy manquante).",
          `Bucket: ${bucket}.`,
          `Path: ${path}.`,
          "Fix: créer une policy INSERT sur storage.objects avec bucket_id = '" + bucket + "'.",
        ].join(" ")
      );
    }

    throw new Error(`Upload Supabase échoué: ${msg}`);
  }

  // 5) URL publique si bucket public, sinon signed URL
  const url = await resolvePublicOrSignedUrl(bucket, path);

  args.onProgress?.(100);

  return { url, path, bucket };
}





