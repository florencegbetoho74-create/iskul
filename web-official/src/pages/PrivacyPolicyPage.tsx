import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../config";

export default function PrivacyPolicyPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Politique de confidentialite</span>
        <h1>Protection des donnees personnelles sur iSkul</h1>
        <p>
          Derniere mise a jour : 14 avril 2026. Cette politique explique quelles donnees iSkul traite,
          pourquoi elles sont utilisees et comment les utilisateurs peuvent exercer leurs droits.
        </p>
      </header>

      <section className="content-card" data-reveal="up">
        <p className="policy-meta">
          Service concerne : application mobile iSkul, site public iSkul et services associes.
        </p>
        <p className="policy-meta">
          Contact : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou via la page{" "}
          <Link to="/contact">Contact</Link>.
        </p>
        <p>
          iSkul est une plateforme educative qui propose des cours, quiz, bibliotheque pedagogique,
          messagerie et classes live. Certaines fonctionnalites impliquent l'utilisation de donnees de
          compte, de fichiers, de la camera, du microphone ou de notifications.
        </p>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="content-card">
          <h3>1. Donnees que nous collectons</h3>
          <ul className="policy-list">
            <li>Informations de compte : nom, email, role, identifiants techniques de session.</li>
            <li>Donnees d'apprentissage : progression, scores de quiz, regularite, historique de cours et notes.</li>
            <li>Messagerie : contenu des conversations et pieces jointes envoye es dans l'application.</li>
            <li>Fichiers importes : videos, documents pedagogiques, images de profil ou autres contenus soumis par les utilisateurs.</li>
            <li>Donnees live : identifiants techniques de session, participation aux classes live, reactions et questions.</li>
            <li>Notifications : token push Expo si l'utilisateur autorise les notifications.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>2. Camera et microphone</h3>
          <ul className="policy-list">
            <li>La camera et le microphone sont demandes uniquement pour les fonctionnalites de classe live.</li>
            <li>Ces acces servent a permettre la participation audio et video pendant une session en direct.</li>
            <li>Ils ne sont pas necessaires pour consulter les cours, quiz, bibliotheque ou statistiques.</li>
            <li>L'utilisateur peut refuser ces permissions, mais les fonctions live concernees seront limitees.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="content-card">
          <h3>3. Finalites du traitement</h3>
          <ul className="policy-list">
            <li>Fournir l'acces aux cours, quiz, bibliotheque, messagerie et classes live.</li>
            <li>Authentifier les utilisateurs et proteger les acces aux espaces eleve, parent, professeur et admin.</li>
            <li>Suivre la progression, afficher les statistiques et personnaliser l'experience d'apprentissage.</li>
            <li>Permettre l'envoi de messages, le partage de documents et l'organisation pedagogique.</li>
            <li>Envoyer des rappels ou notifications si l'utilisateur a donne son autorisation.</li>
            <li>Detecter, prevenir et corriger les incidents techniques ou de securite.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>4. Bases d'acces et controles utilisateur</h3>
          <ul className="policy-list">
            <li>Les acces a la camera, au microphone et aux notifications reposent sur le consentement donne via l'appareil.</li>
            <li>Les donnees de compte et de progression sont traitees pour executer le service demande par l'utilisateur.</li>
            <li>Les permissions peuvent etre retirees a tout moment dans les reglages du telephone.</li>
            <li>Le vidage du cache local est disponible dans l'application pour supprimer les donnees conservees sur l'appareil.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="content-card">
          <h3>5. Partage avec des prestataires</h3>
          <ul className="policy-list">
            <li>Supabase est utilise pour l'authentification, la base de donnees, le stockage et certaines fonctions backend.</li>
            <li>Agora est utilise pour les classes live audio et video.</li>
            <li>Expo peut etre utilise pour certaines fonctions applicatives, notamment les notifications push.</li>
          </ul>
          <p className="policy-note">
            Nous ne vendons pas les donnees personnelles. Les prestataires techniques sont utilises pour fournir le service.
          </p>
        </article>

        <article className="content-card">
          <h3>6. Conservation</h3>
          <ul className="policy-list">
            <li>Les donnees de compte sont conservees tant que le compte reste actif ou tant que cela est necessaire au service.</li>
            <li>Les messages, documents et contenus pedagogiques sont conserves selon les besoins de fonctionnement de la plateforme.</li>
            <li>Les donnees locales de l'application peuvent rester sur l'appareil jusqu'a deconnexion, suppression du cache ou desinstallation.</li>
          </ul>
        </article>
      </section>

      <section className="policy-grid" data-reveal="up">
        <article className="content-card">
          <h3>7. Droits des utilisateurs</h3>
          <ul className="policy-list">
            <li>Demander l'acces, la rectification ou la suppression de certaines donnees.</li>
            <li>
              Demander la fermeture du compte via l'application iSkul ou la page{" "}
              <Link to="/delete-account">Suppression de compte</Link>.
            </li>
            <li>Retirer les permissions appareil pour la camera, le micro ou les notifications.</li>
            <li>Nous contacter via <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> ou la page <Link to="/contact">Contact</Link>.</li>
          </ul>
        </article>

        <article className="content-card">
          <h3>8. Securite</h3>
          <p>
            iSkul met en oeuvre des controles d'authentification, de permissions applicatives et de restriction
            d'acces aux donnees afin de limiter les acces non autorises. Aucun dispositif n'offrant une securite
            absolue, les utilisateurs doivent aussi proteger leurs identifiants et leurs appareils.
          </p>
          <p>
            Cette politique peut etre mise a jour pour refleter l'evolution du service, des obligations legales ou
            des prestataires techniques.
          </p>
        </article>
      </section>
    </div>
  );
}
