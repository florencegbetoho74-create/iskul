export type LangKey = "fon" | "adja" | "yoruba" | "dindi";

export type Chapter = {
  id: string;
  title: string;
  videoUrl?: string | null;
  order?: number;
  // NEW: vidéos par langue
  videoByLang?: Partial<Record<LangKey, string>>;
};

export type Course = {
  id: string;
  title: string;
  description?: string;
  level: string;
  subject: string;
  coverUrl?: string | null;
  chapters: Chapter[];
  published: boolean;
  ownerId: string;
  ownerName?: string;
  createdAtMs: number;
  updatedAtMs: number;
};
