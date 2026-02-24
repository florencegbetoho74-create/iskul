import * as FileSystem from "expo-file-system/legacy";
import { ChatAttachment } from "@/types/chat";

const DIR = FileSystem.documentDirectory + "attachments";

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR!, { intermediates: true });
  }
}

function safeName(name?: string) {
  const base = (name || "fichier").replace(/[^\w.\-]/g, "_");
  return `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${base}`;
}

export type PickedFileInput = {
  uri: string;
  name?: string;
  mime?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

/** Copie les fichiers choisis dans le sandbox de l'app et renvoie des Attachments persistés */
export async function persistAttachments(files: PickedFileInput[]): Promise<ChatAttachment[]> {
  await ensureDir();
  const out: ChatAttachment[] = [];
  for (const f of files) {
    const filename = safeName(f.name);
    const dest = `${DIR}/${filename}`;
    try {
      await FileSystem.copyAsync({ from: f.uri, to: dest });
      out.push({
        id: filename,
        uri: dest,
        name: f.name || "fichier",
        mime: f.mime || undefined,
        size: f.size || undefined,
        width: f.width || undefined,
        height: f.height || undefined
      });
    } catch {
      // fallback: on garde l'URI source si la copie échoue (ex: content:// non copiable)
      out.push({
        id: filename,
        uri: f.uri,
        name: f.name || "fichier",
        mime: f.mime || undefined,
        size: f.size || undefined,
        width: f.width || undefined,
        height: f.height || undefined
      });
    }
  }
  return out;
}
