export type Live = {
  id: string;
  title: string;
  description?: string;
  startAt: number;
  streamingUrl?: string;
  teacherId: string;
  teacherName: string;
  status?: "scheduled" | "live" | "ended";
};
