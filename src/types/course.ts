import type { ContentStatus } from "@/lib/contentStatus";

export type LangKey = "fon" | "adja" | "yoruba" | "dendi";

export type Chapter = {
  id: string;
  title: string;
  videoUrl?: string | null;
  order?: number;
  videoByLang?: Partial<Record<LangKey, string>>;
};

export type Course = {
  id: string;
  title: string;
  description?: string;
  level: string;
  subject: string;
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  coverUrl?: string | null;
  chapters: Chapter[];
  published: boolean;
  status: ContentStatus;
  reviewNote?: string | null;
  ownerId: string;
  ownerName?: string;
  createdAtMs: number;
  updatedAtMs: number;
};
