export type ChatAttachment = {
  id: string;
  uri: string;
  name: string;
  mime?: string | null;
  size?: number | null;
};

export type Message = {
  id: string;
  fromId: string;
  text?: string | null;
  attachments?: ChatAttachment[];
  atMs: number; // Date.now()
};

export type Thread = {
  id: string;
  // participants
  teacherId: string;
  teacherName?: string;
  studentId: string;
  studentName?: string;
  participants: string[]; // [teacherId, studentId]

  // rattachement facultatif à un cours
  courseId?: string | null;
  courseTitle?: string | null;

  // meta
  createdAtMs: number;
  lastAtMs: number;
  lastFromId: string;
  lastText?: string | null;
  lastReadAtMs?: Record<string, number>; // { [userId]: ms }
};
