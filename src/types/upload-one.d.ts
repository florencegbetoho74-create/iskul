declare module "@/lib/upload" {
  export type UploadOut = {
    url: string;
    path: string;
    name: string;
    fullPath: string;
    bucket: string;
  };

  export function uploadOne(
    file: { uri: string; name: string; contentType?: string },
    path: string
  ): Promise<UploadOut>;

  // Overload optionnel (pour la progression)
  export function uploadOne(
    file: { uri: string; name: string; contentType?: string },
    path: string,
    opts?: { onProgress?: (pct: number) => void }
  ): Promise<UploadOut>;
}
