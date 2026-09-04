/**
 * Onglet books de l'espace professeur.
 *
 * Extrait d'un composant de mille sept cents lignes. La liste de
 * proprietes ci-dessous n'est pas courte : elle dit ce que cet onglet
 * partage reellement avec les autres, ce qu'aucune lecture du fichier
 * d'origine ne montrait.
 */

import type { ReactNode, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../lib/supabase";
import { safeNumber } from "../helpers";
import { EMPTY_BOOK_FORM } from "../constants";
import type { BookForm, BookRow } from "../types";

type Props = {
  bookForm: BookForm;
  bookSearch: string;
  books: BookRow[];
  busy: boolean;
  editBook: (...args: any[]) => any;
  filteredBooks: BookRow[];
  handleBookSubmit: (...args: any[]) => any;
  onDelete: (...args: any[]) => any;
  runAction: (...args: any[]) => any;
  setBookForm: Dispatch<SetStateAction<BookForm>>;
  setBookSearch: Dispatch<SetStateAction<string>>;
};

export default function BooksPanel({
  bookForm,
  bookSearch,
  books,
  busy,
  editBook,
  filteredBooks,
  handleBookSubmit,
  onDelete,
  runAction,
  setBookForm,
  setBookSearch,
}: Props): ReactNode {
  return (
    <section className="teacher-layout-grid">
      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>{bookForm.id ? "Modifier le document" : "Nouveau document"}</h2>
          {bookForm.id ? (<button className="btn ghost" type="button" onClick={() => setBookForm(EMPTY_BOOK_FORM)} disabled={busy}>Annuler</button>) : null}
        </div>

        <form className="teacher-form-grid" onSubmit={handleBookSubmit}>
          <label className="teacher-field">Titre
            <input value={bookForm.title} onChange={(event) => setBookForm((prev) => ({ ...prev, title: event.target.value }))} />
          </label>
          <label className="teacher-field">Niveau
            <input value={bookForm.level} onChange={(event) => setBookForm((prev) => ({ ...prev, level: event.target.value }))} />
          </label>
          <label className="teacher-field">Matière
            <input value={bookForm.subject} onChange={(event) => setBookForm((prev) => ({ ...prev, subject: event.target.value }))} />
          </label>
          <label className="teacher-field">Prix (FCFA)
            <input type="number" min="0" value={bookForm.price} onChange={(event) => setBookForm((prev) => ({ ...prev, price: event.target.value }))} />
          </label>
          <label className="teacher-field teacher-field-wide">URL couverture (optionnel)
            <input value={bookForm.coverUrl} onChange={(event) => setBookForm((prev) => ({ ...prev, coverUrl: event.target.value }))} placeholder="https://..." />
          </label>
          <label className="teacher-field teacher-field-wide">URL du fichier
            <input value={bookForm.fileUrl} onChange={(event) => setBookForm((prev) => ({ ...prev, fileUrl: event.target.value }))} placeholder="https://..." />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>{bookForm.id ? "Mettre a jour" : "Ajouter le document"}</button>
        </form>
      </article>

      <article className="teacher-panel">
        <div className="teacher-panel-head">
          <h2>Mes documents</h2>
          <input className="teacher-search-input" placeholder="Rechercher un document..." value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} />
        </div>

        {filteredBooks.length ? (
          <div className="teacher-list">
            {filteredBooks.map((book) => (
              <article key={book.id} className="teacher-item-card">
                <div className="teacher-item-title">
                  <h3>{book.title}</h3>
                  <p>{book.level || "-"} - {book.subject || "-"}</p>
                  <div className="teacher-meta-row">
                    <span className="teacher-pill">{book.published ? "Publie" : "Brouillon"}</span>
                    <span>{safeNumber(book.price).toLocaleString("fr-FR")} FCFA</span>
                    <a className="teacher-link" href={book.file_url} target="_blank" rel="noreferrer">Ouvrir le fichier</a>
                  </div>
                </div>
                <div className="teacher-item-actions">
                  <button className="btn ghost" type="button" onClick={() => editBook(book)} disabled={busy}>Modifier</button>
                  <button className="btn ghost" type="button" onClick={() =>
                    void runAction(async () => {
                      const { error } = book.published
                          ? await supabase.rpc("review_content", {
                              p_kind: "book",
                              p_content_id: book.id,
                              p_decision: "rejected",
                              p_note: "Depublie depuis l'espace professeur.",
                            })
                          : await supabase.rpc("submit_content_for_review", {
                              p_kind: "book",
                              p_content_id: book.id,
                            });
                      if (error) throw error;
                    }, "Publication du document mise a jour.")
                  } disabled={busy}>{book.published ? "Depublier" : "Publier"}</button>
                  <button className="btn ghost danger-outline" type="button" onClick={() =>
                    onDelete(`le document "${book.title}"`, async () => {
                      const { error } = await supabase.from("books").delete().eq("id", book.id);
                      if (error) throw error;
                    }, "Document supprime.")
                  } disabled={busy}>Supprimer</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="teacher-empty">Aucun document correspondant.</p>
        )}
      </article>
    </section>
  );
}
