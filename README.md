# Babo – Straßen-Game (Prototyp)

Claim deine echte Straße, kauf Grundstücke, bau verrückte Fassaden und kassier Miete.
Konzept & Meilensteine: [KONZEPT-Strassen-Game.md](./KONZEPT-Strassen-Game.md).

## Loslegen

```bash
npm install
npm run dev        # Dev-Server (http://localhost:5173)
npm test           # Unit-Tests (Vitest)
npm run build      # Typecheck + Produktions-Build inkl. Service Worker (dist/)
npm run preview    # gebauten Stand lokal ansehen (PWA installierbar)
npm run build:artifact  # Vorschau als einzelne HTML-Datei (dist-artifact/babo-preview.html)
```

## Als PWA bereitstellen

`npm run build` erzeugt in `dist/` eine installierbare PWA (Manifest, App-Icons, Service Worker,
offline spielbar). Sie läuft auf jedem statischen Hosting, auch in einem Unterpfad.

**GitHub Pages (Workflow liegt bei):** `.github/workflows/deploy.yml` baut und veröffentlicht bei
jedem Push auf `Main` (bzw. `main`). Einmalig: *Settings → Pages → Source: „GitHub Actions“*. Pages für private
Repos braucht einen kostenpflichtigen GitHub-Plan; sonst Repo öffentlich machen oder ein anderes
Hosting nehmen (Netlify, Cloudflare Pages, Vercel: Build `npm run build`, Ausgabe `dist`).

Installieren: Android/Chrome → Menü „App installieren“; iPhone/Safari → Teilen → „Zum Home-Bildschirm“.

App-Icons neu erzeugen (nach Änderungen an `public/icon*.svg`):
`npx -y -p playwright node scripts/generate-icons.mjs`

## Stack

React 19 + TypeScript + Vite, PWA via `vite-plugin-pwa`, State mit Zustand,
Routing mit React Router (HashRouter → läuft auf jedem statischen Hosting).

## Echte Straßen (OpenStreetMap)

Beim Claimen sucht die App die Straße über [Photon](https://photon.komoot.io) (OpenStreetMap-Daten,
für Suche beim Tippen gedacht). Gewählte Straßen bekommen eine stabile Kennung (`Street.osm.key` aus
Land, PLZ, Ort und Name), an der auch das Grundstücks-Layout hängt. Ist der Dienst nicht erreichbar,
kann man die Straße manuell eintragen; sie gilt dann als *ungeprüft* und lässt sich später auf der
Karte bestätigen. Einstellungen: `src/config/geo.ts`.

Hinweise: Die Artifact-Vorschau blockiert externe Anfragen – dort ist die Suche immer „nicht
erreichbar“. Für den Echtbetrieb mit vielen Nutzern sollte eine eigene Photon-Instanz laufen
(der öffentliche Dienst ist ein Fair-Use-Angebot).

## Projektstruktur

```
src/
  main.tsx                 Einstieg, Service-Worker-Registrierung
  App.tsx                  Routing der 6 Screens + Guards
  routes.ts                Pfade aller Screens
  config/economy.ts        Alle Zahlen (Preise, Mieten, Multiplikatoren) + Rechenfunktionen
  model/types.ts           Datenmodell aus Konzept Abschnitt 9 (+ OSM-Verweis)
  config/geo.ts            Straßensuche (Photon-URL, Debounce, Timeout, Nachbar-Radius)
  config/bots.ts           Bot-Personas, Tempo, Vorlieben je Charakter
  config/life.ts           Müll-Raten, Miet-Abzug, Spielplatz, Kundschaft, Belohnungen
  config/cars.ts           Autohaus: 8 Fantasie-Modelle (keine echten Marken), Farben, Verkehr
  audio/sound.ts           Soundeffekte + Straßengeräusche (Web Audio, synthetisch)
  audio/ambience.ts        Geräusch-Mix passend zum sichtbaren Straßenabschnitt
  geo/streetSearch.ts      Photon-Abfrage, Filter auf echte Straßen, Kennung, Zusammenfassen
  geo/neighbors.ts         echte Nachbarstraßen (Photon reverse)
  share/streetImage.ts     Straße als PNG mit Titelzeile
  repository/
    Repository.ts          Persistenz-Interface (async, später ApiRepository/Symfony)
    LocalRepository.ts     Implementierung über localStorage
  store/gameStore.ts       Zustand-Store: init / claim / tick / collect / buyPlot / build … – für jede Straße
  store/useStreetContext.ts  „In welcher Straße bin ich?“ (eigene oder Nachbarstraße) für Screens
  game/
    claimStreet.ts         Straße + Spieler anlegen, Validierung, Grundstücks-Layout
    plots.ts               Kauf-Logik, Preisanstieg
    rent.ts                Miete pro Minute, Offline-Verbuchung, Einsammeln
    templates.ts           Vorlagen-Bibliothek (≥3 je Größe, u. a. Gummibärchenschloss)
    randomBuilding.ts      Zufallsgenerator („Würfeln“) nach den Regeln aus Konzept 6.2
    unlock.ts              Bausteine gegen Münzen freischalten
    names.ts               Besitz-Namen („Kalles Kiosk“, „Hans’ Bahnhofstraße“), Gebäudenamen bereinigen
    life.ts                Wohnen/Gewerbe, Müll & Hundehaufen, Spielplatz, Miet-Modifikatoren, Stimmen der Bewohner
    cars.ts                Autos kaufen, Name/Nummernschild/Farbe ändern
    bots.ts                Nachbarschaft anlegen, Bot-Aktionen, Simulation seit letztem Besuch
    migrate.ts             hebt ältere Spielstände an
    random.ts              seedbarer Zufall (gleiche Straße → gleiches Layout)
    ids.ts                 ID-Erzeugung
  parts/
    catalog.ts             22 Bausteine (5 Grundkörper, 5 Dächer, 3 Türen, 3 Fenster, 6+ Deko) als Inline-SVG
    grid.ts                Fassaden-Raster (Zellen, Dach, Maße je Grundstücksgröße)
    rules.ts               Gültigkeitsregeln einer Fassade (validateFacade)
    editor.ts              Baukasten-Schritte: Teil setzen/entfernen, Stockwerke, Schild-Text
  components/
    street/                SVG-Straßen-Ansicht (Layout + Rendering)
    FacadeSvg.tsx          Fassaden-Renderer (+ FacadePreview für Einzelbilder)
    BuildPicker.tsx        Vorlage wählen / Würfeln
    builder/               Editor-Raster (EditorCanvas) und Paletten-Vorschaubilder
    NeighborhoodMap.tsx    Karte mit Bot-Straßen in ihrer Himmelsrichtung
    street/StreetLife.tsx  Leute, Kinder, Hund auf den Gehwegen (lassen live Dreck fallen)
    street/Litter.tsx      Müll & Hundehaufen zum Wegtippen
    street/Traffic.tsx     Verkehr: eigene Autos (mit Namen) + fremde, Rechtsverkehr, Hupen
    cars/CarSvg.tsx        8 Karosserieformen in Seitenansicht mit Nummernschild
    Voices.tsx, UsePicker.tsx, SoundToggle.tsx
    RentBar.tsx            Miete bereit + Einsammeln
    StreetSearch.tsx       Suchfeld mit Straßen-Vorschlägen
    AppLayout.tsx          Münzen-Leiste, Bottom-Nav, Miet-Ticker
  screens/                 Claim, Straße, Grundstück, Baukasten, Nachbarschaft, Teilen
```

| Screen | Route | Stand |
|---|---|---|
| Start / Claim | `#/start` | echte Straße per OSM-Suche, Fallback manuell |
| Meine Straße | `#/street` | SVG-Straße, Miete einsammeln, Offline-Meldung |
| Grundstück | `#/plot/:plotId` | Kaufen, Bauen per Vorlage oder Würfeln, Umbauen, Ausbauen (Stufe 1–3) |
| Baukasten | `#/builder/:plotId` | Fassaden-Editor, Schild-Text, Live-Miete, Bausteine freischalten |
| Nachbarschaft | `#/neighborhood` | Karte mit 5 Bot-Straßen, Neuigkeiten seit letztem Besuch |
| Bot-Straße | `#/neighborhood/:streetId` | Straße eines Nachbarn ansehen, freie Grundstücke kaufen |
| Grundstück beim Nachbarn | `#/neighborhood/:streetId/plot/:plotId` | Kaufen (+25 %), bauen, ausbauen, umbenennen |
| Teilen | `#/share` | Straße als Bild, Web-Share bzw. Speichern |
| Autohaus | `#/garage` | Autos kaufen, Farbe, Name & Nummernschild |
