import { useEffect, useId, useState } from "react";
import { GEO } from "../config/geo";
import { formatPlace, searchStreets, StreetSearchUnavailable } from "../geo/streetSearch";
import type { StreetLocation } from "../model/types";

type Status = "idle" | "loading" | "done" | "unavailable";

interface Props {
  onSelect: (location: StreetLocation) => void;
  /** Wird angeboten, wenn der Kartendienst nicht erreichbar ist. */
  onManual?: () => void;
  initialQuery?: string;
  label?: string;
}

/** Suchfeld mit Vorschlägen echter Straßen aus OpenStreetMap. */
export function StreetSearch({ onSelect, onManual, initialQuery = "", label = "Deine Straße" }: Props) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StreetLocation[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < GEO.minQueryLength) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        setResults(await searchStreets(trimmed, { signal: controller.signal }));
        setStatus("done");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!(error instanceof StreetSearchUnavailable)) console.error(error);
        setResults([]);
        setStatus("unavailable");
      }
    }, GEO.debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="street-search">
      <label className="field" htmlFor={`${id}-input`}>
        <span>{label}</span>
        <input
          id={`${id}-input`}
          type="search"
          value={query}
          placeholder="z. B. Bahnhofstraße Tuttlingen"
          autoComplete="off"
          enterKeyHint="search"
          aria-controls={`${id}-results`}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div id={`${id}-results`} aria-live="polite">
        {status === "idle" && <p className="hint left">Straße und Ort eintippen – wir suchen sie auf der Karte.</p>}
        {status === "loading" && <p className="hint left">Suche auf der Karte …</p>}
        {status === "done" && results.length === 0 && (
          <p className="hint left">Keine passende Straße gefunden. Prüf die Schreibweise und gib den Ort mit an.</p>
        )}
        {status === "unavailable" && (
          <div className="search-unavailable">
            <p>Die Kartensuche ist gerade nicht erreichbar.</p>
            {onManual && (
              <button type="button" className="btn" onClick={onManual}>
                Straße ohne Prüfung eintragen
              </button>
            )}
          </div>
        )}
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((location) => (
              <li key={location.osm?.key}>
                <button type="button" className="search-result" onClick={() => onSelect(location)}>
                  <strong>{location.name}</strong>
                  <span>{formatPlace(location)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="attribution">Kartendaten © OpenStreetMap-Mitwirkende</p>
    </div>
  );
}
