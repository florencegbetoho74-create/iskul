import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";
import { SUPPORT_EMAIL } from "../config";

/**
 * Mentions légales.
 *
 * La page portait deux défauts que seul un visiteur pouvait voir : une note
 * adressée au développeur ("ce contenu est un minimum, il peut être complété
 * selon votre structure juridique") et, à la place de l'identité de l'éditeur,
 * la mention « informations à compléter ».
 *
 * Les champs que je ne connais pas -- forme juridique, RCCM, siège, hébergeur --
 * sont absents plutôt qu'inventés ou annoncés comme manquants. Une mention
 * légale fausse expose davantage qu'une mention incomplète.
 */
export default function LegalPage() {
  return (
    <div className="page container container--narrow">
      <PageHero
        eyebrow="Mentions légales"
        title="Qui édite iSkul."
        lead="Les informations légales relatives au site iskuledu.space et à l'application mobile iSkul."
      />

      <div className="stack stack--loose">
        <section className="card" data-reveal="up">
          <h2>Éditeur</h2>
          <dl className="legal-list">
            <div>
              <dt>Éditeur</dt>
              <dd>VERIION</dd>
            </div>
            <div>
              <dt>Service édité</dt>
              <dd>
                iSkul — plateforme scolaire du secondaire, application mobile et site public.
              </dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </dd>
            </div>
            <div>
              <dt>Site</dt>
              <dd>
                <a href="https://iskuledu.space">iskuledu.space</a>
              </dd>
            </div>
            <div>
              <dt>Application Android</dt>
              <dd>
                <a
                  href="https://play.google.com/store/apps/details?id=com.iskul.app"
                  target="_blank"
                  rel="noreferrer"
                >
                  com.iskul.app
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card" data-reveal="up">
          <h2>Contenus pédagogiques</h2>
          <p>
            Les cours, quiz et documents publiés sur iSkul sont proposés par des professeurs du
            secondaire. Aucun contenu n'est visible avant d'avoir été validé par un relecteur, qui
            vérifie qu'il correspond à la classe annoncée et au programme béninois.
          </p>
          <p>
            Malgré cette relecture, des erreurs peuvent subsister. Un contenu jugé inexact peut
            être signalé depuis la page <Link to="/contact">Contact</Link> ; il est retiré le temps
            de la vérification.
          </p>
        </section>

        <section className="card" data-reveal="up">
          <h2>Propriété des contenus</h2>
          <p>
            Chaque professeur conserve la propriété des cours et documents qu'il dépose. En les
            publiant sur iSkul, il en autorise la diffusion auprès des élèves de la plateforme.
          </p>
          <p>
            Les épreuves d'examen et les œuvres au programme sont reproduites à des fins
            pédagogiques. Tout ayant droit qui souhaite le retrait d'un document peut en faire la
            demande à <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>

        <section className="card" data-reveal="up">
          <h2>Données personnelles</h2>
          <p>
            Le détail des données traitées, de leur durée de conservation et des droits de chacun
            figure dans la{" "}
            <Link to="/politique-confidentialite">politique de confidentialité</Link>.
          </p>
          <p>
            La suppression d'un compte et de ses données se demande depuis la page{" "}
            <Link to="/delete-account">Suppression de compte</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
