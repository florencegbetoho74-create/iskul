import React from "react";

import { useAuth } from "@/providers/AuthProvider";
import StudentHome from "@/components/home/StudentHome";
import TeacherHome from "@/components/home/TeacherHome";

/**
 * Accueil.
 *
 * Eleve et professeur n'ont plus le meme ecran : l'un reprend son cours,
 * l'autre suit ses classes. Les melanger dans un seul fichier de 1 368 lignes
 * pilote par des conditions rendait les deux mediocres.
 */
export default function Home() {
  const { user } = useAuth();
  const isTeacher = String(user?.role || "") === "teacher";
  return isTeacher ? <TeacherHome /> : <StudentHome />;
}
