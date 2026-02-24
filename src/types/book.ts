export type Book = {
  id: string;
  title: string;
  subject?: string;
  level?: string;
  price?: number;           // 0 ou undefined => Gratuit
  coverUrl?: string | null; // miniature
  fileUrl: string;          // lien Storage (PDF/EPUB)
  ownerId: string;
  ownerName?: string;
  published?: boolean;

  createdAt?: any;          // serverTimestamp
  updatedAt?: any;          // serverTimestamp
  createdAtMs?: number;     // tri client
  updatedAtMs?: number;     // tri côté client
};
