# Straßen-Game (Arbeitstitel „Babo") – Konzept & Bauauftrag für Claude Code

Version 0.1 · Stand: 26.09.2026 · Ziel: **spielbarer Prototyp (MVP), kein fertiges Produkt**

---

## 1. Was das Spiel ist (in einem Satz)

Ein simples Aufbauspiel fürs Handy, in dem man **seine echte Straße claimt**, dort Grundstücke kauft, mit einem **Fassaden-Baukasten** verrückte oder normale Gebäude baut, damit Miete verdient und seine Straße Freunden zeigt.

Mischung aus Monopoly (Grundstücke, Geld), SimCity (Aufbau) und Farmville (Idle-Einnahmen, Sammeln) – bewusst einfach, in 10 Sekunden verständlich.

## 2. Zielgruppe & Ton

- Alle, die gern was Eigenes bauen und zeigen – vom Gelegenheitsspieler bis zum Bastler.
- Ton: lustig, bunt, leicht albern. Gummibärchenschloss neben Dönerbude ist gewollt.
- Identifikation über die echte Nachbarschaft ist der virale Hebel.

## 3. Kernschleife (Core Loop)

1. Straße claimen (echte Straße, per Eingabe von Name + Ort).
2. Grundstück kaufen (S / M / L, unterschiedliche Preise).
3. Gebäude draufstellen: Vorlage wählen, Zufallsgenerator würfeln lassen oder selbst im Baukasten bauen.
4. Gebäude erzeugt laufend Miete (auch offline, Idle-Prinzip).
5. Mit Miete: neue Grundstücke, Bausteine für den Baukasten, Upgrades kaufen.
6. Straße anschauen, Nachbarstraßen (Bots) anschauen, eigene Straße teilen.

## 4. Spielwelt & Darstellung

- **Perspektive:** 2D, leicht schräg von oben (Vogelperspektive wie Farmville). Kein 3D, kein Herumlaufen.
- **Straße:** eine horizontale Straße, links und rechts Grundstücke als Kacheln in einer Reihe. Scrollbar.
- **Gebäude:** flache 2D-Fassaden (Vorderansicht) stehen auf den Grundstücken.
- **Nachbarschaft:** eine Karte mit der eigenen Straße in der Mitte und 4–6 Nachbarstraßen drumherum, die von Bots bespielt werden. Antippen öffnet die Straßenansicht des Nachbarn (nur ansehen).

## 5. Grundstücke

| Größe | Breite in Kacheln | Preis (Start) | Max. Fassadenbreite | Beispiel-Vorlagen |
|---|---|---|---|---|
| S | 1 | 500 | schmal | Kiosk, Imbiss, Friseur, Hüpfburg |
| M | 2 | 1.500 | mittel | Bäckerei, Wohnhaus, Dönerbude, Eisdiele |
| L | 3 | 4.000 | breit | Freizeitpark, Gummibärchenschloss, Kläranlage, Schwimmbad |

- Eine Straße hat ca. 12 Grundstückplätze (je 6 pro Seite), gemischt aus S/M/L.
- Der Spieler startet mit 1.000 Münzen und einem geschenkten S-Grundstück.
- Mieteinnahme = Basiswert der Größe × Anzahl/Wert der verbauten Teile × Upgrade-Stufe.

## 6. Gebäude bauen – drei Wege

Alle drei erzeugen dasselbe Datenformat (siehe Abschnitt 9), damit alles gleich dargestellt wird.

### 6.1 Vorlage (schnell)
Fertige Gebäude aus einer Bibliothek, gefiltert nach Grundstücksgröße. Ein Tap, fertig.

### 6.2 Zufallsgenerator (lustig)
„Würfeln"-Button: baut aus den Bausteinen automatisch eine gültige Fassade. Regeln: genau ein Grundkörper, genau ein Dach, mindestens eine Tür, 1–4 Fenster, 0–3 Deko-Teile. Beliebig oft neu würfeln.

### 6.3 Fassaden-Baukasten (kreativ)
Der Spieler setzt seine Fassade selbst zusammen – wie ein Sticker-Album auf einem Raster:

- **Grundkörper** (Pflicht): Wandfläche in Farbe/Material (Stein, Holz, Schokolade, Gummibärchen, Eis, Glas …)
- **Dach** (Pflicht): Spitzdach, Flachdach, Kuppel, Turmspitze, Zuckerguss …
- **Türen & Fenster**: verschiedene Formen
- **Deko**: Schild mit eigenem Text, Schokobrunnen, Zuckerstangen-Zaun, Palme, Neonschrift, Antenne, Flagge …
- **Ebenen**: 1–3 Stockwerke je nach Grundstücksgröße

Bausteine werden mit Münzen freigeschaltet (Geldsenke). Start-Set: ca. 5 Grundkörper, 4 Dächer, 3 Türen, 3 Fenster, 6 Deko-Teile. Alle Bausteine sind einfache SVG-Grafiken in einem einheitlichen Cartoon-Stil.

### 6.4 Werkbank (später, Phase 2)
Feste Rezepte wie bei Minecraft: z. B. 2× Schokolade + 1× Brunnen → Schokobrunnen-Deko. Erweitert den Baukasten um seltene Teile.

### 6.5 Gemeinsame Bibliothek (später, Phase 2/3)
Jedes selbstgebaute Gebäude landet automatisch in einer gemeinsamen Vorlagen-Bibliothek, aus der andere Spieler es übernehmen können. Optional später: verkaufen gegen Credits.

## 7. Bots (Nachbarn)

- Jede Nachbarstraße gehört einem Bot mit Name, Avatar und „Charakter" (z. B. Süßigkeiten-Fan, Beton-Liebhaber, Chaot).
- Bots kaufen in Abständen Grundstücke und stellen per Zufallsgenerator (mit Charakter-Vorlieben) Gebäude drauf, sodass sich Nachbarstraßen sichtbar entwickeln.
- Im MVP laufen Bots lokal beim App-Start („was ist seit dem letzten Besuch passiert").

## 8. Wirtschaft (Startwerte, alles per Config anpassbar)

- Miete wird pro Minute berechnet und beim Öffnen der App gutgeschrieben (max. 8 h Offline-Zeit).
- Basismiete: S = 10/min, M = 30/min, L = 90/min.
- Jedes verbaute Deko-Teil +5 %, jedes Stockwerk +20 %.
- Upgrade-Stufen 1–3 je Gebäude: ×1 / ×1,5 / ×2,2, Kosten 50 % / 100 % des Grundstückpreises.
- Grundstückpreise steigen mit jedem gekauften Grundstück um 15 %.
- Ziel: erstes Grundstück nach ~5 Min, Straße in ~1–2 Wochen gelegentlichen Spielens voll.

## 9. Datenmodell (MVP)

```ts
type PlotSize = "S" | "M" | "L";

interface Street {
  id: string;
  name: string;        // z. B. "Bahnhofstraße"
  city: string;        // z. B. "Tuttlingen"
  ownerId: string;     // Spieler oder Bot
  plots: Plot[];
}

interface Plot {
  id: string;
  size: PlotSize;
  side: "left" | "right";
  index: number;
  price: number;
  building?: Building;
  purchasedAt?: number;
}

interface Building {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  facade: Facade;
  createdBy: "template" | "random" | "player";
}

interface Facade {
  base: PartRef;       // Grundkörper
  roof: PartRef;
  floors: 1 | 2 | 3;
  parts: PlacedPart[]; // Türen, Fenster, Deko mit Rasterposition
}

interface PlacedPart { partId: string; x: number; y: number; text?: string; }
interface PartRef { partId: string; color?: string; }

interface Part {
  id: string;
  category: "base" | "roof" | "door" | "window" | "deco";
  svg: string;         // Inline-SVG-Symbol
  price: number;       // 0 = Start-Set
  rentBonus: number;   // z. B. 0.05
}

interface Player {
  id: string;
  name: string;
  coins: number;
  unlockedParts: string[];
  streetId: string;
  lastSeen: number;
}
```

## 10. Screens (MVP)

1. **Start / Claim:** Name eingeben, Straße + Ort eingeben → Straße wird angelegt.
2. **Meine Straße:** Hauptscreen. Straße von schräg oben, Grundstücke antippbar, Münzstand oben, Miete-einsammeln-Button.
3. **Grundstück:** kaufen / Gebäude wählen (Vorlage · Würfeln · Selbst bauen) / upgraden.
4. **Baukasten:** Fassaden-Editor mit Kategorien-Leiste unten, Vorschau oben, Live-Mietanzeige.
5. **Nachbarschaft:** Karte mit Nachbarstraßen der Bots, antippen → deren Straße ansehen.
6. **Teilen:** Screenshot der eigenen Straße als Bild exportieren / Web-Share-API.

## 11. Technik

- **Stack:** React + TypeScript + Vite, PWA (installierbar auf Handy, läuft auch am PC).
- **State:** Zustand (oder vergleichbar), Persistenz im MVP über `localStorage`/IndexedDB.
- **Rendering:** Straße und Fassaden als SVG (skaliert sauber, einfach zu komponieren). Kein Canvas/3D nötig.
- **Bausteine:** SVG-Symbole in `/src/parts/*.svg` + Katalog `parts.json`.
- **Config:** alle Zahlen (Preise, Mieten, Multiplikatoren) in `config/economy.ts`.
- **Mobile-first:** Touch-Bedienung, Hochformat, große Buttons.
- **Vorbereitung für Multiplayer:** State-Schicht so bauen, dass die Persistenz später durch eine API (geplant: Symfony) ersetzt werden kann – ein `Repository`-Interface mit `LocalRepository` heute, `ApiRepository` später.

## 12. Bewusst NICHT im MVP

- Echter Multiplayer / Server / Accounts
- Werkbank-Rezepte, gemeinsame Gebäude-Bibliothek, Handel mit Credits
- KI-generierte Bilder
- Eingriffe in fremde Straßen (Graffiti, Klauen), Straßenzeitung – Ideen für später
- Echte Kartendaten (Straßen werden nur als Text eingegeben)

## 13. Meilensteine für Claude Code

**M1 – Gerüst (1. Sitzung)**
- Vite + React + TS + PWA aufsetzen, Routing für die 6 Screens, State + LocalRepository, Config-Datei.
- Start-Screen: Straße claimen, Spieler mit 1.000 Münzen anlegen.

**M2 – Straße & Grundstücke**
- Straßen-Ansicht als SVG mit 12 Grundstücken (S/M/L), Kauf-Logik, Preisanstieg.
- Idle-Miete mit Offline-Berechnung, Einsammeln-Button.

**M3 – Gebäude**
- Parts-Katalog mit Start-Set (ca. 20 SVG-Teile), Facade-Renderer.
- Vorlagen-Bibliothek (min. 3 je Größe) und Zufallsgenerator mit Gültigkeitsregeln.

**M4 – Baukasten**
- Fassaden-Editor: Kategorien, Rasterplatzierung, Text auf Schildern, Live-Mietvorschau, Bausteine freischalten.

**M5 – Nachbarn & Teilen**
- 5 Bot-Nachbarn mit Charakter, Entwicklung beim App-Start, Nachbarschaftskarte, Straßen-Ansicht der Bots.
- Screenshot/Share der eigenen Straße. Upgrades.

**Definition of Done für den Prototyp:** Ein neuer Spieler versteht das Spiel ohne Erklärung, kauft in 5 Minuten sein erstes Grundstück, baut ein Gummibärchenschloss und kann seine Straße als Bild verschicken.

---

## Startprompt für Claude Code

> Lies KONZEPT-Strassen-Game.md vollständig. Setze Meilenstein M1 um: Vite + React + TypeScript + PWA, Routing für die sechs Screens aus Abschnitt 10, das Datenmodell aus Abschnitt 9 als Typen, ein Repository-Interface mit LocalRepository (localStorage), die Wirtschafts-Config aus Abschnitt 8 und den Start-Screen zum Claimen einer Straße. Mobile-first, Hochformat. Zeige mir danach eine Übersicht der Projektstruktur und was als Nächstes für M2 ansteht.
