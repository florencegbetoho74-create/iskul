import { Link } from "react-router-dom";
import PageHero from "../components/page/PageHero";
import { SUPPORT_EMAIL } from "../config";

export default function PrivacyPolicyPage() {
  return (
    <div className="page container container--narrow">
      <PageHero
        eyebrow="Confidentialité"
        title="Ce que nous savons de vous."
        lead="Quelles données iSkul traite, pourquoi, combien de temps, et comment reprendre la main dessus. Dernière mise à jour le 14 avril 2026."
      />

      <section className="card" data-reveal="up">
        <p className="policy-meta">
          Service concerne : application mobile iSkul, site public iSkul et services associés.
        </p>
        <p className="policy-meta">
          Contact : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou via la page{" "}
          <Link to="/contact">Contact</Link>.
        </p>
        <p>
          iSkul est une plateforme éducative qui propose des cours, quiz, bibliothèque pédagogique,
          messagerie et classes live. Certaines fonctionnalités impliquent l'utilisation de données de
          compte, de fichiers, de la camera, du microphone ou de notifications.
        </p>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="card">
          <h3>1. Données que nous collectons</h3>
          <ul className="policy-list">
            <li>Informations de compte : nom, email, rôle, identifiants techniques de session.</li>
            <li>Données d'apprentissage : progression, scores de quiz, régularité, historique de cours et notes.</li>
            <li>Messagerie : contenu des conversations et pièces jointes envoyées dans l'application.</li>
            <li>Fichiers importés : vidéos, documents pédagogiques, images de profil ou autres contenus soumis par les utilisateurs.</li>
            <li>Données live : identifiants techniques de session, participation aux classes live, réactions et questions.</li>
            <li>Notifications : token push Expo si l'utilisateur autorise les notifications.</li>
          </ul>
        </article>

        <article className="card">
          <h3>2. Caméra et microphone</h3>
          <ul className="policy-list">
            <li>La caméra et le microphone sont demandés uniquement pour les fonctionnalités de classe live.</li>
            <li>Ces accès servent a permettre la participation audio et vidéo pendant une session en direct.</li>
            <li>Ils ne sont pas nécessaires pour consulter les cours, quiz, bibliothèque ou statistiques.</li>
            <li>L'utilisateur peut refuser ces permissions, mais les fonctions live concernées seront limitées.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="card">
          <h3>3. Finalites du traitement</h3>
          <ul className="policy-list">
            <li>Fournir l'accès aux cours, quiz, bibliothèque, messagerie et classes live.</li>
            <li>Authentifier les utilisateurs et protéger les accès aux espaces élève, parent, professeur et admin.</li>
            <li>Suivre la progression, afficher les statistiques et personnaliser l'expérience d'apprentissage.</li>
            <li>Permettre l'envoi de messages, le partage de documents et l'organisation pédagogique.</li>
            <li>Envoyer des rappels ou notifications si l'utilisateur a donne son autorisation.</li>
            <li>Détecter, prévenir et corriger les incidents techniques ou de sécurité.</li>
          </ul>
        </article>

        <article className="card">
          <h3>4. Bases d'accès et contrôles utilisateur</h3>
          <ul className="policy-list">
            <li>Les accès a la caméra, au microphone et aux notifications reposent sur le consentement donne via l'appareil.</li>
            <li>Les données de compte et de progression sont traitées pour exécuter le service demande par l'utilisateur.</li>
            <li>Les permissions peuvent être retirées a tout moment dans les réglages du telephone.</li>
            <li>Le vidage du cache local est disponible dans l'application pour supprimer les données conservées sur l'appareil.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="card">
          <h3>5. Partage avec des prestataires</h3>
          <ul className="policy-list">
            <li>Supabase est utilise pour l'authentification, la base de données, le stockage et certaines fonctions backend.</li>
            <li>Agora est utilise pour les classes live audio et vidéo.</li>
            <li>Expo peut être utilise pour certaines fonctions applicatives, notamment les notifications push.</li>
          </ul>
          <p className="policy-note">
            Nous ne vendons pas les données personnelles. Les prestataires techniques sont utilises pour fournir le service.
          </p>
        </article>

        <article className="card">
          <h3>6. Conservation</h3>
          <ul className="policy-list">
            <li>Les données de compte sont conservées tant que le compte reste actif ou tant que cela est nécessaire au service.</li>
            <li>Les messages, documents et contenus pédagogiques sont conserves selon les besoins de fonctionnement de la plateforme.</li>
            <li>Les données locales de l'application peuvent rester sur l'appareil jusqu'a deconnexion, suppression du cache ou desinstallation.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="card">
          <h3>7. Droits des utilisateurs</h3>
          <ul className="policy-list">
            <li>Demander l'accès, la rectification ou la suppression de certaines données.</li>
            <li>
              Demander la fermeture du compte via l'application iSkul ou la page{" "}
              <Link to="/delete-account">Suppression de compte</Link>.
            </li>
            <li>Retirer les permissions appareil pour la caméra, le micro ou les notifications.</li>
            <li>Nous contacter via <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou la page <Link to="/contact">Contact</Link>.</li>
          </ul>
        </article>

        <article className="card">
          <h3>8. Sécurité</h3>
          <p>
            iSkul met en oeuvre des controles d'authentification, de permissions applicatives et de restriction
            d'accès aux données afin de limiter les accès non autorisés. Aucun dispositif n'offrant une sécurité
            absolue, les utilisateurs doivent aussi proteger leurs identifiants et leurs appareils.
          </p>
          <p>
            Cette politique peut être mise a jour pour refléter l'évolution du service, des obligations légales ou
            des prestataires techniques.
          </p>
        </article>
      </section>
    </div>
  );
}
