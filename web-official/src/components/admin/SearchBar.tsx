type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

/**
 * Recherche d'une liste de la console.
 *
 * La saisie n'est pas differee : les procedures filtrent cote serveur et une
 * liste d'administration compte des centaines de lignes, pas des millions.
 * Un debounce ajouterait un delai perceptible pour economiser une requete
 * qui coute peu.
 */
export default function SearchBar({ value, onChange, placeholder, label }: Props) {
  return (
    <div className="console-search">
      <label className="visually-hidden" htmlFor="console-search-input">
        {label}
      </label>
      <input
        id="console-search-input"
        className="input"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button type="button" className="btn ghost small" onClick={() => onChange("")}>
          Effacer
        </button>
      ) : null}
    </div>
  );
}
