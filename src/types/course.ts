export type Chapter = {
  id: string;
  title: string;
  videoUrl?: string;
  order?: number;
};

export type Course = {
  id: string;
  title: string;
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
