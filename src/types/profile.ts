export type Profile = {
  userId: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  phone?: string;
  school?: string;
  grade?: string;      // ex. "Terminale" (élève)
  subjects?: string[]; // ex. ["Maths", "Physique"] (prof)
  updatedAt: number;
};
