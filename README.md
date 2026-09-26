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

## Stack

React 19 + TypeScript + Vite, PWA via `vite-plugin-pwa`, State mit Zustand,
Routing mit React Router (HashRouter → läuft auf jedem statischen Hosting).

## Projektstruktur

```
src/
  main.tsx                 Einstieg, Service-Worker-Registrierung
  App.tsx                  Routing der 6 Screens + Guards
  routes.ts                Pfade aller Screens
  config/economy.ts        Alle Zahlen (Preise, Mieten, Multiplikatoren) + Rechenfunktionen
  model/types.ts           Datenmodell aus Konzept Abschnitt 9
  repository/
    Repository.ts          Persistenz-Interface (async, später ApiRepository/Symfony)
    LocalRepository.ts     Implementierung über localStorage
  store/gameStore.ts       Zustand-Store: init / claim / tick / collect / buyPlot / reset
  game/
    claimStreet.ts         Straße + Spieler anlegen, Validierung, Grundstücks-Layout
    plots.ts               Kauf-Logik, Preisanstieg
    rent.ts                Miete pro Minute, Offline-Verbuchung, Einsammeln
    templates.ts           Gebäude-Vorlagen (bisher: Start-Kiosk)
    migrate.ts             hebt ältere Spielstände an
    random.ts              seedbarer Zufall (gleiche Straße → gleiches Layout)
    ids.ts                 ID-Erzeugung
  parts/
    catalog.ts             Bausteine (Start-Set) als Inline-SVG
    grid.ts                Fassaden-Raster (Zellen, Dach, Maße je Grundstücksgröße)
  components/
    street/                SVG-Straßen-Ansicht (Layout + Rendering)
    FacadeSvg.tsx          Fassaden-Renderer
    RentBar.tsx            Miete bereit + Einsammeln
    AppLayout.tsx          Münzen-Leiste, Bottom-Nav, Miet-Ticker
  screens/                 Claim, Straße, Grundstück, Baukasten, Nachbarschaft, Teilen
```

| Screen | Route | Stand |
|---|---|---|
| Start / Claim | `#/start` | fertig |
| Meine Straße | `#/street` | SVG-Straße, Miete einsammeln, Offline-Meldung |
| Grundstück | `#/plot/:plotId` | Kaufen; Bauen in M3 |
| Baukasten | `#/builder/:plotId` | Platzhalter (M4) |
| Nachbarschaft | `#/neighborhood` | Platzhalter (M5) |
| Teilen | `#/share` | Platzhalter (M5) |
