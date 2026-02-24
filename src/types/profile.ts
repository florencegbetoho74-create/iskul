export type Profile = {
  userId: string;
  role?: "student" | "teacher";
  name?: string;
  avatarUrl?: string;
  bio?: string;
  email?: string;
  phone?: string;
  school?: string;
  grade?: string;      // ex. "Terminale" (eleve)
  subjects?: string[]; // ex. ["Maths", "Physique"] (prof)
  expoPushTokens?: string[];
  lastSeenMs?: number;
  updatedAt: number;
};