import { storage } from "@/lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import * as FileSystem from "expo-file-system";

/** Types */
export type UploadInput = { uri: string; name: string; contentType?: string };
export type UploadOut = { url: string; path: string; name: string; fullPath: string };

/** Helpers */
function inferContentType(name: string, fallback = "application/octet-stream") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return fallback;
  }
}
function safePath(s: string) {
  return s.replace(/[^\w.\-\/]/g, "_");
}
/** Android: transforme content:// en file:// lisible */
async function ensureFileUriReadable(uri: string, name?: string) {
  if (uri.startsWith("content://")) {
    const to = `${FileSystem.cacheDirectory}${Date.now()}-${name || "upload.bin"}`;
    await FileSystem.copyAsync({ from: uri, to });
    return to;
  }
  return uri;
}

/** Upload via base64 (100% compatible Expo Go) */
export async function uploadOne(
  file: UploadInput,
  destFolder: string
): Promise<UploadOut> {
  let { uri, name, contentType } = file;
  uri = await ensureFileUriReadable(uri, name);
  contentType = contentType || inferContentType(name);

  // 1) lire le fichier en base64
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

  // 2) envoyer en base64 (pas de Blob/ArrayBuffer)
  const path = safePath(`${destFolder}/${Date.now()}-${name.replace(/\s+/g, "_")}`);
  const r = ref(storage, path);

  await uploadString(r, base64, "base64", {
    contentType,
    cacheControl: "public,max-age=3600",
    contentDisposition: `inline; filename="${name.replace(/"/g, "_")}"`
  });

  // 3) URL publique
  const url = await getDownloadURL(r);
  return { url, path, name, fullPath: r.fullPath };
}
