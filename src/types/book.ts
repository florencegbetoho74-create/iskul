export type Book = {
  id: string;
  title: string;
  subject?: string;
  level?: string;
  countryCode?: string | null;
  gradeLevelId?: string | null;
  subjectId?: string | null;
  price?: number;           // 0 ou undefined => Gratuit
  coverUrl?: string | null; // miniature
  fileUrl: string;          // lien Storage (PDF/EPUB)
  ownerId: string;
  ownerName?: string;
  published?: boolean;

  createdAtMs?: number;
  updatedAtMs?: number;
};
