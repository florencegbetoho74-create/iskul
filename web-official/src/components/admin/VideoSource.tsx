/**
 * La source vidéo d'un chapitre, telle qu'un relecteur doit la voir.
 *
 * Certains professeurs déposent le fichier, d'autres collent un lien de
 * partage cloud. Ce n'est pas un détail de confort : un lien Google Drive ou
 * Dropbox ne se lit pas davantage dans l'application que dans ce lecteur. Un
 * chapitre ainsi renseigné s'ouvrira sur une page vide pour l'élève.
 *
 * Le composant distingue donc trois cas, et le troisième est un motif de
 * renvoi que la file ne montrait pas.
 */

type Verdict = "direct" | "hls" | "forbidden" | "indirect" | "missing";

function classify(url: string | null | undefined): Verdict {
  const value = (url || "").trim();
  if (!value) return "missing";
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(value)) return "forbidden";
  if (/\.(m3u8)(\?|$)/i.test(value)) return "hls";
  if (/\.(mp4|m4v|mov|webm|mpd)(\?|$)/i.test(value)) return "direct";
  return "indirect";
}

export default function VideoSource({ url }: { url: string | null | undefined }) {
  const verdict = classify(url);
  const value = (url || "").trim();

  if (verdict === "missing") {
    return (
      <p className="source-verdict is-blocking">
        Aucune vidéo sur ce chapitre. Un élève ouvrirait une page vide.
      </p>
    );
  }

  if (verdict === "forbidden") {
    return (
      <div className="source-verdict is-blocking">
        <strong>Lien YouTube.</strong> L'application ne les lit pas : ce chapitre ne fonctionnera
        pas. Demandez au professeur d'importer le fichier ou de fournir un lien direct.
      </div>
    );
  }

  if (verdict === "indirect") {
    return (
      <div className="source-verdict is-warning">
        <p>
          <strong>Lien de partage cloud.</strong> Il ne pointe pas directement vers un fichier
          vidéo (.mp4, .m3u8, .mpd). L'application ne saura pas le lire — l'élève verra un lecteur
          vide.
        </p>
        {/* Le relecteur doit pouvoir verifier ce que le lien contient avant de
            trancher. C'est la console d'administration, pas l'application :
            ouvrir un lien fait partie du travail. */}
        <a className="btn ghost small" href={value} target="_blank" rel="noreferrer">
          Ouvrir le lien pour vérifier
        </a>
      </div>
    );
  }

  return (
    <>
      <video className="review-video" src={value} controls preload="metadata" />
      {verdict === "hls" ? (
        <p className="source-verdict is-note">
          Flux HLS. L'application le lit ; ce navigateur ne le fait qu'avec Safari.{" "}
          <a href={value} target="_blank" rel="noreferrer">
            Ouvrir la source
          </a>
        </p>
      ) : null}
    </>
  );
}
