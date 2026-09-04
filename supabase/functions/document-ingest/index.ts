// Edge Function : transforme un PDF depose en document structure iSkul.
//
// Invocation attendue toutes les minutes, comme push-dispatch. Un secret
// partage est exige : la fonction consomme des appels factures et ecrit dans la
// bibliotheque.
//
// Un travail par invocation. Une epreuve de plusieurs pages demande souvent
// plus d'une minute au modele, et la duree d'execution d'une Edge Function est
// bornee : le travail part en tache de fond et la reponse est rendue tout de
// suite. Le planificateur rappelle la fonction tant que la file n'est pas vide.
//
// Le modele lit le PDF nativement, texte compose comme page scannee : il n'y a
// pas d'etape de classification prealable ni d'OCR a installer. En revanche il
// decrit les figures sans pouvoir les decouper -- chaque figure devient un bloc
// vide que la relecture vient completer.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.71.0";
import { z } from "npm:zod@3.25.76";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.71.0/helpers/zod";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const MODEL = "claude-opus-5";

// L'API refuse au-dela de 32 Mo de requete ; le PDF encode en base64 pese un
// tiers de plus que le fichier. On s'arrete avant pour rendre une erreur
// lisible plutot qu'un rejet de l'API.
const MAX_PDF_BYTES = 22 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/* -------------------------------------------------------------------------- */
/* Ce que le modele doit rendre                                               */
/* -------------------------------------------------------------------------- */
// Tous les champs sont presents et annulables : un schema strict n'accepte pas
// qu'une cle manque, et un bloc de texte n'a pas de lignes de tableau.
const BlockSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "heading",
    "paragraph",
    "instruction",
    "exercise",
    "question",
    "list",
    "table",
    "figure",
    "formula",
  ]),
  label: z.string().nullable(),
  text: z.string().nullable(),
  points: z.number().nullable(),
  parentId: z.string().nullable(),
  level: z.number().nullable(),
  ordered: z.boolean().nullable(),
  items: z.array(z.string()).nullable(),
  rows: z.array(z.array(z.string())).nullable(),
  headerRow: z.boolean().nullable(),
  latex: z.string().nullable(),
  caption: z.string().nullable(),
  description: z.string().nullable(),
  pageIndex: z.number().nullable(),
});

const ExtractionSchema = z.object({
  pageCount: z.number(),
  blocks: z.array(BlockSchema),
  reference: z.object({
    institution: z
      .object({ name: z.string().nullable(), city: z.string().nullable() })
      .nullable(),
    schoolYear: z.string().nullable(),
    session: z.string().nullable(),
    series: z.string().nullable(),
    author: z.string().nullable(),
  }),
});

type Extraction = z.infer<typeof ExtractionSchema>;

const INSTRUCTIONS = `Tu transcris un document scolaire beninois en blocs structures.

DECOUPAGE
Chaque unite de lecture devient un bloc, dans l'ordre de la page.
- exercise : une partie numerotee. label porte l'etiquette imprimee ("Exercice 2", "Partie A"), points le bareme s'il est annonce.
- question : une question ou sous-question. label porte sa numerotation ("1", "1.a", "3.2"), parentId l'id de l'exercice qui la contient.
- instruction : une consigne qui s'applique a ce qui suit ("Repondre par vrai ou faux", "Toute reponse doit etre justifiee").
- paragraph : un texte suivi, un enonce, un extrait d'oeuvre.
- heading : un titre de section qui n'est pas un exercice. level de 1 a 3.
- list : une enumeration. items contient chaque element, ordered indique si elle est numerotee.
- table : un tableau. rows contient les lignes, headerRow indique si la premiere est un en-tete.
- formula : une expression mathematique isolee. latex porte sa notation LaTeX.
- figure : un schema, un graphique, une figure geometrique, une carte, une photo.

REGLES
- id : une chaine courte et unique dans le document ("e1", "q1a", "f2").
- Conserve la numerotation imprimee telle quelle dans label. Ne renumerote jamais.
- Une formule courte dans une phrase reste dans le texte de la phrase. N'isole en bloc formula que ce qui est ecrit sur sa propre ligne.
- Ne resume pas, ne corrige pas, ne complete pas un enonce incomplet. Tu transcris.
- Si un passage est illisible, transcris ce que tu lis et marque le reste par [illisible].
- Laisse null tout champ qui ne s'applique pas au bloc.

FIGURES
Tu ne peux pas extraire l'image. Pour chaque figure :
- description : ce que la figure represente, assez precisement pour qu'un relecteur la retrouve sur la page et pour servir de texte alternatif.
- caption : la legende imprimee sous la figure, si elle existe.
- pageIndex : la page ou elle se trouve, la premiere valant 0.
N'invente pas de figure pour un simple encadre ou un trait de separation.

FICHE DE REFERENCE
Cherche dans l'en-tete et le pied de page :
- institution : l'etablissement qui fait passer l'epreuve, avec sa ville.
- schoolYear : l'annee scolaire, sous la forme "2023-2024".
- session : "Session normale", "Juin", "Rattrapage"...
- series : la serie du lycee (A, B, C, D). null au college.
- author : le redacteur, s'il est nomme.
Laisse null ce que le document ne dit pas. N'infere jamais un etablissement ni une annee : une reference inventee est pire qu'une reference absente.

pageCount : le nombre de pages du document.`;

/* -------------------------------------------------------------------------- */
/* Outils                                                                     */
/* -------------------------------------------------------------------------- */
// btoa sur une chaine construite d'un coup depasse la pile sur un fichier de
// plusieurs megaoctets : on encode par tranches.
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Texte brut du document, pour la recherche. Reprend documentPlainText. */
function plainText(blocks: Extraction["blocks"]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.label) parts.push(b.label);
    if (b.text) parts.push(b.text);
    if (b.items?.length) parts.push(b.items.join(" "));
    if (b.rows?.length) parts.push(b.rows.map((r) => r.join(" ")).join(" "));
    if (b.caption) parts.push(b.caption);
    if (b.description) parts.push(b.description);
  }
  return parts.join("\n").trim();
}

/** Retire les champs nuls : le format ne garde que ce qui s'applique. */
function compact(block: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  // Une figure part sans image : la relecture la fournira.
  if (out.kind === "figure") out.assetPath = null;
  return out;
}

/* -------------------------------------------------------------------------- */
/* Traitement d'un document                                                   */
/* -------------------------------------------------------------------------- */
async function processJob(
  admin: ReturnType<typeof createClient>,
  anthropic: Anthropic,
  job: { id: string; bookId: string; sourceUrl: string; maxPages: number }
): Promise<void> {
  try {
    const file = await fetch(job.sourceUrl);
    if (!file.ok) {
      throw new Error(`Le fichier source est introuvable (HTTP ${file.status}).`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error("Le fichier source est vide.");
    }
    if (bytes.length > MAX_PDF_BYTES) {
      throw new Error(
        `Le fichier pese ${Math.round(bytes.length / 1024 / 1024)} Mo. La limite est de ${
          MAX_PDF_BYTES / 1024 / 1024
        } Mo.`
      );
    }

    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 32000,
      system: INSTRUCTIONS,
      output_config: { format: zodOutputFormat(ExtractionSchema, "document") },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: toBase64(bytes),
              },
            },
            {
              type: "text",
              text: `Transcris ce document. Il ne doit pas depasser ${job.maxPages} pages ; s'il est plus long, transcris les ${job.maxPages} premieres.`,
            },
          ],
        },
      ],
    });

    // Un refus arrive en HTTP 200 : sans ce test on lirait un contenu absent.
    if (response.stop_reason === "refusal") {
      throw new Error(
        "Le modele a refuse de traiter ce document. Verifiez qu'il s'agit bien d'un document scolaire."
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Le document est trop long pour une seule extraction. Decoupez-le avant de le redeposer."
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("La reponse du modele n'a pas pu etre lue.");
    }

    const blocks = parsed.blocks.map(compact);
    if (blocks.length === 0) {
      throw new Error("Aucun contenu n'a pu etre extrait de ce fichier.");
    }

    const { error } = await admin.rpc("complete_document_ingestion", {
      p_job_id: job.id,
      p_content: { version: 1, blocks },
      p_reference: parsed.reference,
      p_content_text: plainText(parsed.blocks),
      p_page_count: Math.round(parsed.pageCount) || null,
      p_model: MODEL,
      p_input_tokens: response.usage.input_tokens ?? null,
      p_output_tokens: response.usage.output_tokens ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Echec inconnu.";
    await admin.rpc("fail_document_ingestion", { p_job_id: job.id, p_error: message });
  }
}

/* -------------------------------------------------------------------------- */
/* Entree                                                                     */
/* -------------------------------------------------------------------------- */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "methode_non_autorisee" }, 405);
  }

  const secret = Deno.env.get("INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return json({ error: "non_autorise" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!url || !serviceKey) {
    return json({ error: "configuration_supabase_absente" }, 500);
  }
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY absente" }, 500);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("claim_document_ingestion");
  if (error) {
    return json({ error: error.message }, 500);
  }
  const job = data as
    | { state: "none" }
    | { id: string; bookId: string; sourceUrl: string; maxPages: number };

  if (!job || (job as { state?: string }).state === "none") {
    return json({ claimed: 0 });
  }

  const claimed = job as { id: string; bookId: string; sourceUrl: string; maxPages: number };
  const anthropic = new Anthropic({ apiKey });

  // L'extraction depasse souvent la duree d'une requete : elle se poursuit
  // apres la reponse. Le travail est deja marque en cours en base, donc une
  // invocation concurrente ne le reprendra pas.
  const work = processJob(admin, anthropic, claimed);
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return json({ claimed: 1, jobId: claimed.id, bookId: claimed.bookId });
});
