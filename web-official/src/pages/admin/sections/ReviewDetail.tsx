import { useEffect, useState } from "react";

import {
  getContentDetail,
  getReviewDetail,
  type ReviewDetail as Detail,
  type ReviewQuestion,
} from "../../../lib/admin";
import VideoSource from "../../../components/admin/VideoSource";

const LANG_LABEL: Record<string, string> = {
  fon: "Fon",
  adja: "Adja",
  yoruba: "Yoruba",
  dendi: "Dendi",
};

/**
 * Ce que le relecteur doit voir avant de trancher.
 *
 * La file demandait une décision sur un titre et un nom d'auteur. On ne juge
 * pas la qualité d'un cours sur sa fiche : les vidéos se regardent, les
 * questions se lisent avec leurs bonnes réponses, le document se parcourt.
 */
export default function ReviewDetail({
  kind,
  id,
  /** `moderation` ouvre aussi le publie et le renvoye, pas seulement l'attente. */
  mode = "review",
}: {
  kind: string;
  id: string;
  mode?: "review" | "moderation";
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    const load = mode === "moderation" ? getContentDetail : getReviewDetail;
    void load(kind, id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Lecture impossible."));
    return () => {
      alive = false;
    };
  }, [kind, id, mode]);

  if (error) {
    return (
      <div className="notice danger">
        <p>{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="stack" aria-busy="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line short" />
      </div>
    );
  }

  if (detail.kind === "course") {
    const chapters = detail.chapters ?? [];
    return (
      <div className="review-detail stack">
        {detail.description ? <p>{detail.description}</p> : null}

        {!chapters.length ? (
          <div className="notice warning">
            <p>
              Ce cours ne contient aucun chapitre. Il n'y a rien à regarder — c'est en soi un motif
              de renvoi.
            </p>
          </div>
        ) : null}

        {chapters.map((chapter, index) => {
          const langs = Object.entries(chapter.videoByLang ?? {}).filter(([, v]) => !!v);
          const chosen = lang[chapter.id];
          const source = chosen ? chapter.videoByLang?.[chosen] : chapter.videoUrl;

          return (
            <article key={chapter.id} className="review-chapter">
              <header className="review-chapter-head">
                <span className="review-chapter-num">{String(index + 1).padStart(2, "0")}</span>
                <h4>{chapter.title || "Chapitre sans titre"}</h4>
              </header>

              {langs.length ? (
                <div className="console-filters" role="group" aria-label="Version linguistique">
                  <button
                    type="button"
                    className={!chosen ? "chip-btn active" : "chip-btn"}
                    onClick={() => setLang((p) => ({ ...p, [chapter.id]: "" }))}
                  >
                    Français
                  </button>
                  {langs.map(([code]) => (
                    <button
                      key={code}
                      type="button"
                      className={chosen === code ? "chip-btn active" : "chip-btn"}
                      onClick={() => setLang((p) => ({ ...p, [chapter.id]: code }))}
                    >
                      {LANG_LABEL[code] ?? code}
                    </button>
                  ))}
                </div>
              ) : null}

              <VideoSource url={source} />
            </article>
          );
        })}
      </div>
    );
  }

  if (detail.kind === "quiz") {
    const questions = detail.questions ?? [];
    return (
      <div className="review-detail stack">
        {detail.description ? <p>{detail.description}</p> : null}
        <p className="muted">
          {questions.length} question{questions.length > 1 ? "s" : ""} · la bonne réponse est
          soulignée.
        </p>

        {questions.map((question, index) => (
          <Question key={index} index={index} question={question} />
        ))}
      </div>
    );
  }

  // Document
  const blocks = readBlocks(detail.content);
  const reference = detail.reference as Record<string, unknown> | null;
  const institution = (reference?.institution ?? null) as Record<string, unknown> | null;

  return (
    <div className="review-detail stack">
      <dl className="legal-list">
        <div>
          <dt>Établissement</dt>
          <dd>
            {institution?.name
              ? `${institution.name}${institution.city ? ` — ${institution.city}` : ""}`
              : "Non renseigné"}
          </dd>
        </div>
        <div>
          <dt>Année / session</dt>
          <dd>
            {[reference?.schoolYear, reference?.session].filter(Boolean).join(" · ") ||
              "Non renseignée"}
          </dd>
        </div>
        <div>
          <dt>Examen</dt>
          <dd>
            {[detail.examName, detail.examYear, detail.examSession].filter(Boolean).join(" · ") ||
              "—"}
          </dd>
        </div>
      </dl>

      {!blocks.length ? (
        <div className="notice warning">
          <p>
            Ce document n'a pas encore de contenu structuré. Il n'y a rien à relire tant que
            l'extraction n'est pas passée.
          </p>
        </div>
      ) : (
        <div className="review-document">
          {blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Question({ index, question }: { index: number; question: ReviewQuestion }) {
  const prompt = question.prompt ?? question.question ?? "Question sans énoncé";
  const options = question.options ?? question.choices ?? [];
  const answer = question.answerIndex ?? question.correctIndex;

  return (
    <article className="review-question">
      <h4>
        <span className="review-chapter-num">{index + 1}</span> {prompt}
      </h4>
      {options.length ? (
        <ol className="review-options">
          {options.map((option, i) => (
            <li key={i} className={i === answer ? "is-answer" : undefined}>
              {option}
            </li>
          ))}
        </ol>
      ) : (
        <p className="cell-error">Aucune proposition de réponse.</p>
      )}
      {question.explanation ? <p className="muted">{question.explanation}</p> : null}
    </article>
  );
}

type Block = Record<string, unknown>;

/** Le format des blocs est décrit dans src/lib/documentFormat.ts côté application. */
function readBlocks(content: unknown): Block[] {
  if (!content || typeof content !== "object") return [];
  const raw = (content as Record<string, unknown>).blocks;
  return Array.isArray(raw) ? (raw as Block[]) : [];
}

function Block({ block }: { block: Block }) {
  const kind = String(block.kind ?? "");
  const label = block.label ? String(block.label) : "";
  const text = block.text ? String(block.text) : "";

  if (kind === "exercise") {
    return (
      <h4 className="review-block-exercise">
        {label} {block.points ? <span className="badge">{String(block.points)} pts</span> : null}
      </h4>
    );
  }
  if (kind === "question") {
    return (
      <p className="review-block-question">
        <strong>{label}</strong> {text}
      </p>
    );
  }
  if (kind === "figure") {
    return (
      <p className="review-block-figure">
        Figure — {String(block.description ?? block.caption ?? "sans description")}
        {block.assetPath ? null : <span className="badge warning">image à fournir</span>}
      </p>
    );
  }
  if (kind === "list" && Array.isArray(block.items)) {
    return (
      <ul>
        {(block.items as string[]).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  if (kind === "heading") {
    return <h4>{text}</h4>;
  }
  return <p>{text || label}</p>;
}
