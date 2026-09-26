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
  store/gameStore.ts       Zustand-Store: init / claim / reset
  game/
    claimStreet.ts         Straße + Spieler anlegen, Validierung, Grundstücks-Layout
    random.ts              seedbarer Zufall (gleiche Straße → gleiches Layout)
    ids.ts                 ID-Erzeugung
  components/              AppLayout (Münzen-Leiste, Bottom-Nav), Guards, Platzhalter
  screens/                 Claim, Straße, Grundstück, Baukasten, Nachbarschaft, Teilen
```

| Screen | Route | Stand |
|---|---|---|
| Start / Claim | `#/start` | fertig |
| Meine Straße | `#/street` | Entwurf (Kachel-Liste), SVG in M2 |
| Grundstück | `#/plot/:plotId` | Infos, Aktionen in M2/M3 |
| Baukasten | `#/builder/:plotId` | Platzhalter (M4) |
| Nachbarschaft | `#/neighborhood` | Platzhalter (M5) |
| Teilen | `#/share` | Platzhalter (M5) |
