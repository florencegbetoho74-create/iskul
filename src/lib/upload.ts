// src/lib/upload.ts - Supabase Storage wrapper (Expo / React Native)
import { uploadVideoSupabase } from "@/lib/uploadSupabase";

export type UploadInput = { uri: string; name: string; contentType?: string };
export type UploadOut = { url: string; path: string; name: string; fullPath: string; bucket: string };
export type UploadOpts = { onProgress?: (pct: number) => void };

function safeName(name: string) {
  const normalized = (name || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "_");
}

function getExt(name: string) {
  const m = (name || "").match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? `.${m[1]}` : "";
}

export async function uploadOne(input: UploadInput, destFolder: string, opts?: UploadOpts): Promise<UploadOut> {
  const clean = safeName(input.name || "file");
  const ext = getExt(clean);
  const base = ext ? clean.slice(0, -ext.length) : clean;

  const filename = `${Date.now()}-${base}${ext}`;

  const result = await uploadVideoSupabase(input.uri, {
    folder: destFolder,
    filename,
    contentType: input.contentType,
    onProgress: opts?.onProgress,
  });

  return {
    url: result.url,
    path: result.path,
    name: input.name,
    fullPath: result.path,
    bucket: result.bucket,
  };
}
