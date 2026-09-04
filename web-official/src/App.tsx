import { Navigate, Route, Routes } from "react-router-dom";

import ScrollToTop from "./components/layout/ScrollToTop";
import SeoHead from "./components/layout/SeoHead";
import SiteHeader from "./components/layout/SiteHeader";
import SiteFooter from "./components/layout/SiteFooter";
import { ScrollProgress, useMotionRuntime } from "./components/motion";

import HomePage from "./pages/HomePage";
import CoursesPage from "./pages/CoursesPage";
import LibraryPage from "./pages/LibraryPage";
import OpenClassroomPage from "./pages/OpenClassroomPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FaqPage from "./pages/FaqPage";
import DeleteAccountPage from "./pages/DeleteAccountPage";
import LegalPage from "./pages/LegalPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TeacherSignupPage from "./pages/TeacherSignupPage";
import ParentTrackingPage from "./pages/ParentTrackingPage";
import TeacherWorkspacePage from "./pages/TeacherWorkspacePage";

import "./styles.css";

/**
 * Ossature du site.
 *
 * Ce fichier portait autrefois les treize pages, leurs donnees et leurs
 * helpers -- mille six cent quatre-vingt-six lignes. Il ne fait plus que ce que
 * son nom annonce : assembler la coquille et distribuer les routes.
 */
export function App() {
  useMotionRuntime();

  return (
    <div className="site-root">
      <ScrollToTop />
      <SeoHead />
      <ScrollProgress />

      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>

      <SiteHeader />

      <main id="contenu" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cours" element={<CoursesPage />} />
          <Route path="/bibliotheque" element={<LibraryPage />} />
          <Route path="/open-classroom" element={<OpenClassroomPage />} />
          <Route path="/parents" element={<ParentTrackingPage />} />
          <Route path="/a-propos" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />

          <Route path="/inscription-professeur" element={<TeacherSignupPage />} />
          <Route path="/espace-professeur" element={<TeacherWorkspacePage />} />

          <Route path="/politique-confidentialite" element={<PrivacyPolicyPage />} />
          <Route path="/mentions-legales" element={<LegalPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  );
}
