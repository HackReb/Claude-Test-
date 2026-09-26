/** Straßensuche über Photon (OpenStreetMap-Daten, für Suche beim Tippen gedacht). */
export const GEO = {
  photonUrl: "https://photon.komoot.io/api/",
  photonReverseUrl: "https://photon.komoot.io/reverse",
  /** Suchradius für Nachbarstraßen in km. */
  neighborRadiusKm: 0.6,
  language: "de",
  maxResults: 8,
  /** Erst ab so vielen Zeichen suchen. */
  minQueryLength: 3,
  /** Wartezeit nach dem letzten Tastendruck, bevor gesucht wird (schont den kostenlosen Dienst). */
  debounceMs: 350,
  timeoutMs: 8000,
} as const;
