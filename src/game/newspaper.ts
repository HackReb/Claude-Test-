import { capacityOf } from "../config/economy";
import type { Building, NeighborEvent, PaperStats, PaperStory, PaperIssue, Plot, Street } from "../model/types";
import { occupancyOf, streetStats, useOf } from "./life";
import { fromStreet, inStreet, intoStreet } from "./names";
import { hashString, seededRandom } from "./random";
import { plotIncomePerHour, streetIncomePerHour } from "./rent";

type Built = Plot & { building: Building };
const built = (street: Street) => street.plots.filter((p): p is Built => p.purchasedAt !== undefined && !!p.building);

/** Tag im Kalender (Ortszeit) – pro Tag gibt es eine Ausgabe. */
export function paperDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Kennzahlen einer Straße – die Zeitung vergleicht sie mit der letzten Ausgabe. */
export function paperStats(street: Street): PaperStats {
  const stats = streetStats(street);
  const homes = built(street).filter((p) => useOf(p.building) === "residential");
  return {
    residents: homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential") * occupancyOf(street, p), 0),
    places: homes.reduce((sum, p) => sum + capacityOf(p.size, p.building.level, "residential"), 0),
    income: streetIncomePerHour(street),
    litter: stats.litter,
    poop: street.litter?.filter((l) => l.kind === "poop").length ?? 0,
    graffiti: stats.graffiti,
    damaged: stats.damaged,
    homes: stats.homes,
    playgrounds: stats.playgrounds,
  };
}

export interface PaperStreet {
  street: Street;
  /** Wem sie gehört (Vorname bzw. Bot-Name). */
  ownerName: string;
  own: boolean;
}

export interface IssueInput {
  streets: PaperStreet[];
  /** Kennzahlen bei der letzten Ausgabe (fehlt beim ersten Mal). */
  previous: Record<string, PaperStats>;
  /** Neuigkeiten seit der letzten Ausgabe (Neubauten, Bad Boys …). */
  news: NeighborEvent[];
  /** Kontostand des Spielers – bei Minus berichtet die Zeitung. */
  coins: number;
  now: number;
}

/** So viele Artikel passen auf die Titelseite. */
const STORIES = 5;
/** Die eigene Straße ist für den Leser interessanter. */
const OWN_WEIGHT = 1.6;

/**
 * Titelseite des Babo-Anzeigers: besonders Gutes und besonders Schlechtes aus der eigenen Straße und
 * der Nachbarschaft – mit den echten Namen von Häusern und Leuten. Reproduzierbar je Tag.
 */
export function makeIssue({ streets, previous, news, coins, now }: IssueInput): PaperIssue {
  const day = paperDay(now);
  const stories: PaperStory[] = [];
  const add = (street: PaperStreet, kind: string, score: number, tone: PaperStory["tone"], headlines: string[], text: string) => {
    const random = seededRandom(hashString(`${day}|${street.street.id}|${kind}`));
    stories.push({
      id: `${street.street.id}-${kind}`,
      streetId: street.street.id,
      tone,
      score: score * (street.own ? OWN_WEIGHT : 1),
      headline: headlines[Math.floor(random() * headlines.length)],
      text,
    });
  };

  for (const entry of streets) {
    const { street, ownerName } = entry;
    const stats = paperStats(street);
    const before = previous[street.id];
    const name = street.name;

    // Dreck
    if (stats.litter >= 6 && stats.poop >= stats.litter / 2) {
      add(entry, "poop", 6 + stats.poop, "bad", [`${name} versinkt in Hundekacke – Igitt!`, `Tretminen-Alarm ${inStreet(name)}!`, `${name}: Wer räumt das endlich weg?`],
        `${stats.poop} Hundehaufen und insgesamt ${stats.litter}× Dreck zählten unsere Reporter auf den Gehwegen. Die Bewohner halten sich die Nase zu – und packen schon die Umzugskartons.`);
    } else if (stats.litter >= 6) {
      add(entry, "trash", 5 + stats.litter, "bad", [`Müllchaos ${inStreet(name)}`, `${name} wird zur Müllhalde`, `Tüten, Dosen, Kippen: ${name} am Limit`],
        `${stats.litter}× Müll auf den Gehwegen. „So kann man doch nicht wohnen“, sagt eine Anwohnerin. ${ownerName} war für eine Stellungnahme nicht zu erreichen.`);
    }
    if (stats.graffiti >= 2) {
      add(entry, "graffiti", 7 + stats.graffiti, "bad", [`Graffiti-Welle ${inStreet(name)}`, `Farbanschlag! ${name} besprüht`],
        `Gleich ${stats.graffiti} Häuser wurden besprüht. Die Polizei vermutet Sprühdosen-Kevin – mal wieder.`);
    }
    if (stats.damaged >= 1) {
      const broken = built(street).find((p) => p.building.damaged)!;
      add(entry, "damaged", 7, "bad", [`Scherben bei ${broken.building.name}!`, `Fenster eingeworfen ${inStreet(name)}`],
        `Bei ${broken.building.name} ging eine Scheibe zu Bruch. Solange nicht repariert ist, bleiben die Zimmer halb leer.`);
    }

    // Bewohner
    if (stats.places > 0 && stats.residents >= stats.places - 0.5 && stats.litter === 0) {
      add(entry, "full", 6, "good", [`${name}: Ausgebucht!`, `Alle wollen ${intoStreet(name)}`, `Kein Zimmer frei ${inStreet(name)}`],
        `Alle ${Math.round(stats.places)} Plätze belegt, die Straße blitzsauber. ${ownerName} kann sich vor Anfragen kaum retten.`);
    }
    if (before) {
      const moved = stats.residents - before.residents;
      if (moved <= -3 && moved <= -before.residents * 0.15) {
        add(entry, "exodus", 8 + Math.abs(moved) / 2, "bad", [`Massenflucht ${fromStreet(name)}`, `${name}: Die Leute ziehen weg!`, `Umzugswagen-Stau ${inStreet(name)}`],
          `${Math.round(-moved)} Bewohner haben seit gestern die Koffer gepackt. Zurück bleiben leere Wohnungen – und weniger Miete für ${ownerName}.`);
      } else if (moved >= 3) {
        add(entry, "influx", 5 + moved / 2, "good", [`Zuzug ${inStreet(name)}`, `${name} wächst und wächst`, `Neue Nachbarn ${inStreet(name)}`],
          `${Math.round(moved)} neue Bewohner sind eingezogen. Die Nachbarschaft freut sich – die Läden erst recht.`);
      }

      // Geld
      const shops = built(street).filter((p) => useOf(p.building) === "commercial");
      const best = shops.sort((a, b) => plotIncomePerHour(street, b) - plotIncomePerHour(street, a))[0];
      if (before.income > 0.5 && stats.income >= before.income * 1.25 && best) {
        add(entry, "boom", 7, "good", [`${best.building.name} verbucht Rekordumsätze`, `Goldgräberstimmung bei ${best.building.name}`, `Kasse klingelt bei ${best.building.name}`],
          `Die Einnahmen ${inStreet(name)} sind seit gestern um ${Math.round((stats.income / before.income - 1) * 100)} % gestiegen. Am besten läuft ${best.building.name}.`);
      } else if (before.income > 2 && stats.income <= before.income * 0.7) {
        add(entry, "slump", 7, "bad", [`Flaute ${inStreet(name)}`, `${name}: Einnahmen brechen ein`],
          `Minus ${Math.round((1 - stats.income / before.income) * 100)} % seit gestern. Experten raten: aufräumen, Spielplatz bauen, Laden eröffnen.`);
      }
    }

    // Neu im Viertel (erste Ausgabe für den Spieler)
    if (!before && entry.own) {
      add(entry, "welcome", 4, "good", [`Neu im Viertel: ${ownerName} ${inStreet(name)}`, `Willkommen, ${ownerName}!`],
        `Große Pläne ${inStreet(name)}: ${ownerName} will hier bauen, vermieten und kassieren. Die Nachbarn sind gespannt – und die Bad Boys auch.`);
    }

    // Wünsche
    if (stats.homes > 0 && stats.playgrounds === 0 && entry.own) {
      add(entry, "playground", 3, "funny", [`Kinder ${fromStreet(name)} fordern Spielplatz`, `Demo mit Schaufeln und Eimern ${inStreet(name)}`],
        `„Wir wollen schaukeln!“, riefen die Kinder vor dem Rathaus. Ohne Spielplatz bleiben die Wohnhäuser nicht voll.`);
    }
  }

  // Ereignisse seit der letzten Ausgabe: Neubauten, Bad Boys, Wachschutz
  for (const event of news) {
    const entry = streets.find((s) => s.street.id === event.streetId);
    if (!entry) continue;
    const caught = event.emoji === "🛡️";
    const badBoy = !caught && event.emoji && !event.botId && !event.playerName;
    const built = /gebaut|eröffnet|angelegt|ausgebaut/.test(event.text);
    if (caught) {
      add(entry, `caught-${event.at}`, 9, "funny", ["Wachschutz schnappt Bad Boy!", "Auf frischer Tat ertappt!", "Erwischt!"], event.text);
    } else if (badBoy && !event.text.startsWith("Du hast")) {
      add(entry, `attack-${event.at}`, 6, "bad", [`Ärger ${inStreet(entry.street.name)}`, "Bad Boys schlagen wieder zu", `Unruhe ${inStreet(entry.street.name)}`], event.text);
    } else if (built) {
      add(entry, `built-${event.at}`, 4, "good", ["Neueröffnung!", "Es wird gebaut", `Neues aus der ${entry.street.name}`], event.text);
    }
  }

  if (coins < 0) {
    const own = streets.find((s) => s.own);
    if (own)
      add(own, "broke", 9, "bad", [`Pleitegeier über der ${own.street.name}?`, `${own.ownerName} in den roten Zahlen`],
        `Das Konto von ${own.ownerName} steht bei ${Math.floor(coins)} Münzen. Die Bank ist nervös. Solange es im Minus ist, wird nichts gekauft.`);
  }

  const top = stories.sort((a, b) => b.score - a.score).slice(0, STORIES);
  if (top.length === 0) {
    const own = streets.find((s) => s.own);
    if (own)
      top.push({
        id: `${own.street.id}-quiet`,
        streetId: own.street.id,
        tone: "funny",
        score: 0,
        headline: `Ruhiger Tag ${inStreet(own.street.name)}`,
        text: "Keine Skandale, keine Rekorde. Unsere Reporter haben Kaffee getrunken.",
      });
  }
  return { day, at: now, stories: top };
}
