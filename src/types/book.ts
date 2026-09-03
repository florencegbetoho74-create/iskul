import type { ContentStatus } from "@/lib/contentStatus";

export type Book = {
  id: string;
  title: string;
  subject?: string;
  level?: string;
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  documentTypeId?: string | null;
  examName?: string | null;
  examYear?: number | null;
  examSession?: string | null;
  author?: string | null;
  price?: number;           // 0 ou undefined => Gratuit
  coverUrl?: string | null; // miniature
  fileUrl: string;          // lien Storage (PDF/EPUB)
  ownerId: string;
  ownerName?: string;
  published?: boolean;
  status?: ContentStatus;
  reviewNote?: string | null;

  createdAtMs?: number;
  updatedAtMs?: number;
};
