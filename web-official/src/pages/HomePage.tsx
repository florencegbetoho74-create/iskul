import { Link } from "react-router-dom";

import iskulLogo from "../assets/iskul-logo.png";
import StoreButton from "../components/brand/StoreButton";
import Photo from "../components/ui/Photo";
import { Marquee, SplitText, useMagnetic } from "../components/motion";
import {
  HERO_STATS,
  LEVELS,
  OPEN_CLASSROOM_EVENTS,
  PHOTOS,
  PILLARS,
  STEPS,
  SUBJECTS,
  TESTIMONIALS,
} from "../content/site";

/**
 * Accueil.
 *
 * Le mouvement suit la lecture : chaque section se decouvre au moment ou le
 * regard l'atteint, et le retard entre elements d'une meme rangee se calcule
 * tout seul depuis `data-stagger`. Rien n'anime la geometrie -- seulement
 * `transform` et `opacity` -- pour que la page tienne soixante images par
 * seconde sur un telephone d'entree de gamme.
 */
export default function HomePage() {
  const ctaRef = useMagnetic<HTMLAnchorElement>(0.22);

  return (
    <div className="home2">
      <section className="hero2 container">
        <div className="hero2-copy">
          <span className="eyebrow" data-reveal="up">
            Plateforme scolaire · Bénin
          </span>

          <SplitText as="h1" className="hero2-title" text="Le secondaire, enfin compris." />

          <p className="hero2-lead" data-reveal="up" data-reveal-delay="260">
            De la 6ᵉ à la terminale, iSkul explique chaque chapitre en vidéo — en français et en
            langues locales — puis vérifie la compréhension par un quiz et suit la progression
            jusqu'au BEPC et au BAC.
          </p>

          <div className="hero2-badges store-badges" data-reveal="up" data-reveal-delay="340">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
          </div>

          <ul className="hero2-points" data-stagger="90">
            <li data-reveal="left">Vidéos par chapitre, alignées sur le programme béninois</li>
            <li data-reveal="left">Quiz de compréhension après chaque séquence</li>
            <li data-reveal="left">Suivi de progression pour l'élève et le parent</li>
          </ul>
        </div>

        <div className="hero2-media">
          {/* Le volet decouvre la photo par le bas : un cadre qui s'ouvre,
              plutot qu'une image qui apparait. */}
          <div data-reveal="clip" data-parallax="-0.06">
            <Photo
              src={PHOTOS.hero}
              alt="Élèves du secondaire en cours au Bénin"
              className="hero2-photo"
            />
          </div>

          {/* Les deux cartes avancent moins vite que la photo : c'est cet
              ecart, et non leur ombre, qui cree la profondeur. */}
          <div className="hero2-floatcard" data-reveal="scale" data-reveal-delay="420" data-parallax="0.12">
            <span className="hero2-floatcard-label">Cette semaine</span>
            <strong className="hero2-floatcard-value">Spécial BEPC</strong>
            <span className="hero2-floatcard-sub">Révisions PCT &amp; SVT · samedi 10h</span>
          </div>

          <div className="hero2-langchip" data-reveal="scale" data-reveal-delay="520" data-parallax="0.2">
            Fon · Yoruba · Dendi
          </div>
        </div>
      </section>

      {/* Le bandeau enonce l'etendue du programme sans en faire une liste de
          plus a lire. */}
      <section className="section--tight" aria-label="Matières couvertes">
        <Marquee items={SUBJECTS} duration={42} className="subject-marquee" />
      </section>

      <section className="container">
        <div className="stats-strip" data-stagger="80">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="stat" data-reveal="up">
              <strong className="stat-value">{stat.value}</strong>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec container">
        <div className="split">
          <div className="split-copy">
            <span className="eyebrow" data-reveal="up">
              Pourquoi iSkul
            </span>
            <SplitText
              as="h2"
              className="sec-title"
              text="Quand la langue devient un mur, la compréhension s'effondre."
            />
            <p className="sec-text" data-reveal="up" data-reveal-delay="180">
              Trop d'élèves finissent par réciter sans comprendre. iSkul remet la compréhension au
              centre, avec des explications accessibles, des quiz immédiats et un suivi clair —
              adaptés à la réalité des classes au Bénin.
            </p>
            <div className="pillars" data-stagger="110">
              {PILLARS.map((pillar) => (
                <article key={pillar.title} className="pillar" data-reveal="up">
                  <h3>{pillar.title}</h3>
                  <p>{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>
          <div data-reveal="clip" data-parallax="-0.05">
            <Photo
              src={PHOTOS.understand}
              alt="Élèves qui révisent ensemble"
              className="split-media"
            />
          </div>
        </div>
      </section>

      <section className="sec container">
        <div className="sec-head">
          <span className="eyebrow" data-reveal="up">
            Comment ça marche
          </span>
          <SplitText
            as="h2"
            className="sec-title"
            text="Apprendre, se tester, progresser — en trois temps."
          />
        </div>
        <div className="steps" data-stagger="130">
          {STEPS.map((step) => (
            <article key={step.num} className="step" data-reveal="up">
              <span className="step-num">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="sec-actions" data-reveal="up">
          <Link className="btn primary" to="/cours">
            Découvrir Cours &amp; Quiz
          </Link>
          <Link className="btn ghost" to="/bibliotheque">
            Explorer la bibliothèque
          </Link>
        </div>
      </section>

      <section className="sec container">
        <div className="curriculum" data-reveal="up">
          <div className="curriculum-head">
            <span className="eyebrow">Programme béninois</span>
            <h2 className="sec-title">Tout le secondaire, du collège au lycée.</h2>
            <p className="sec-text">
              Des contenus organisés par classe et par matière, pour réviser exactement ce qui est vu
              en cours et se préparer aux examens nationaux.
            </p>
          </div>

          <div className="curriculum-block">
            <span className="curriculum-label">Niveaux</span>
            <div className="chips" data-stagger="45">
              {LEVELS.map((level) => (
                <span key={level} className="chip" data-reveal="scale">
                  {level}
                </span>
              ))}
              <span className="chip chip-exam" data-reveal="scale">
                BEPC
              </span>
              <span className="chip chip-exam" data-reveal="scale">
                BAC
              </span>
            </div>
          </div>

          <div className="curriculum-block">
            <span className="curriculum-label">Matières</span>
            <div className="chips" data-stagger="45">
              {SUBJECTS.map((subject) => (
                <span key={subject} className="chip" data-reveal="scale">
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sec container">
        <div className="live-board" data-reveal="up">
          <div className="live-copy">
            <span className="eyebrow eyebrow-light">Open Classroom · en direct</span>
            <h2 className="sec-title">Des sessions live pour débloquer les points difficiles.</h2>
            <p className="sec-text-light">
              Explications, questions-réponses, méthodologie et entraînements. Les replays restent
              disponibles pour revoir un chapitre à son rythme.
            </p>
            <div className="live-list" data-stagger="90">
              {OPEN_CLASSROOM_EVENTS.map((event) => (
                <div key={`${event.day}-${event.hour}`} className="live-row" data-reveal="right">
                  <span className="live-when">
                    <strong>{event.day}</strong>
                    <small>{event.hour}</small>
                  </span>
                  <span className="live-topic">
                    {event.topic}
                    <small>{event.teacher}</small>
                  </span>
                </div>
              ))}
            </div>
            <Link className="btn secondary" to="/open-classroom">
              Voir tout le planning
            </Link>
          </div>
          <div data-reveal="clip" data-reveal-delay="160">
            <Photo src={PHOTOS.live} alt="Session live avec des élèves" className="live-media" />
          </div>
        </div>
      </section>

      <section className="sec container">
        <div className="split split-reverse">
          <div data-reveal="clip" data-parallax="-0.05">
            <Photo
              src={PHOTOS.parents}
              alt="Élèves du secondaire béninois en classe"
              className="split-media"
            />
          </div>
          <div className="split-copy">
            <span className="eyebrow" data-reveal="up">
              Parents &amp; professeurs
            </span>
            <SplitText as="h2" className="sec-title" text="Accompagner, sans surveiller." />
            <p className="sec-text" data-reveal="up" data-reveal-delay="180">
              Les parents suivent la progression de leur enfant — scores, régularité, points faibles
              — d'un coup d'œil, sans pression inutile. Les professeurs, eux, créent leurs contenus
              et suivent l'engagement de leurs classes.
            </p>
            <div className="duo-actions" data-reveal="up" data-reveal-delay="240">
              <Link className="btn primary" to="/parents">
                Espace parents
              </Link>
              <Link className="btn ghost" to="/inscription-professeur">
                Devenir professeur
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec container">
        <div className="sec-head">
          <span className="eyebrow" data-reveal="up">
            Ils utilisent iSkul
          </span>
          <SplitText
            as="h2"
            className="sec-title"
            text="Des élèves, des parents, des profs — au Bénin."
          />
        </div>
        <div className="quotes" data-stagger="120">
          {TESTIMONIALS.map((item) => (
            <figure key={item.name} className="quote" data-reveal="up">
              <blockquote>« {item.quote} »</blockquote>
              <figcaption>
                <span className="quote-avatar" aria-hidden="true">
                  {item.name.replace(/^(M\.|Mme)\s*/, "").charAt(0)}
                </span>
                <span className="quote-id">
                  <strong>{item.name}</strong>
                  <small>
                    {item.role} · {item.place}
                  </small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="sec container">
        <div className="download" data-reveal="up">
          <div className="download-copy">
            <span className="eyebrow eyebrow-light">Application iSkul</span>
            <h2 className="download-title">Téléchargez iSkul et révisez où que vous soyez.</h2>
            <p>
              Vidéos, quiz et suivi de progression, directement sur votre téléphone. Gratuit, léger
              et pensé pour le terrain — même avec une connexion limitée.
            </p>
            <div className="store-badges">
              <StoreButton platform="android" variant="primary" />
              <StoreButton platform="ios" variant="secondary" />
            </div>
            <p className="download-note">
              Disponible dès maintenant sur Google Play · iOS bientôt disponible.
            </p>
            <Link ref={ctaRef} className="btn ghost magnetic download-cta" to="/cours">
              Voir ce que contient un cours
            </Link>
          </div>
          <div className="download-art" aria-hidden="true" data-parallax="0.1">
            <img src={iskulLogo} alt="" className="download-logo" />
          </div>
        </div>
      </section>
    </div>
  );
}
