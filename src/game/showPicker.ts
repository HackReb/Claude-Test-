import { SHOWS, type ShowKind } from "../config/streetLife";

/**
 * Welche Show als Nächstes kommt – über das Wechseln der Seiten und das Neuladen hinweg:
 * Der Zirkus eröffnet nur beim allerersten Mal, danach wird aus einem gemischten Stapel gezogen
 * (jede Show einmal, dann neu gemischt; nie zweimal dieselbe hintereinander).
 */
export interface ShowMemory {
  circusSeen: boolean;
  bag: ShowKind[];
  last: ShowKind | null;
}

const STORAGE_KEY = "babo:shows";

export function nextShowKind(memory: ShowMemory, random: () => number = Math.random): { kind: ShowKind; memory: ShowMemory } {
  if (!memory.circusSeen) return { kind: SHOWS.order[0], memory: { circusSeen: true, bag: memory.bag, last: SHOWS.order[0] } };
  let bag = memory.bag.filter((k) => SHOWS.order.includes(k));
  if (bag.length === 0) bag = shuffle([...SHOWS.order], random);
  // Nicht dieselbe Show wie eben: dann die nächste aus dem Stapel vorziehen.
  if (bag[0] === memory.last && bag.length > 1) bag = [bag[1], bag[0], ...bag.slice(2)];
  else if (bag[0] === memory.last) bag = shuffle(SHOWS.order.filter((k) => k !== memory.last), random);
  const [kind, ...rest] = bag;
  return { kind, memory: { circusSeen: true, bag: rest, last: kind } };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Zwischen den Seiten (ohne Neuladen): wann frühestens die nächste Show kommt. */
let nextShowAt = 0;
let session: ShowMemory | null = null;

export function loadShowMemory(): ShowMemory {
  if (session) return session;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ShowMemory> | null;
    session = { circusSeen: !!stored?.circusSeen, bag: Array.isArray(stored?.bag) ? stored!.bag : [], last: stored?.last ?? null };
  } catch {
    session = { circusSeen: false, bag: [], last: null };
  }
  return session;
}

export function saveShowMemory(memory: ShowMemory) {
  session = memory;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Speicher gesperrt – dann gilt es nur bis zum Neuladen.
  }
}

/** Sekunden bis zur nächsten Show, wenn die Straße jetzt (wieder) geöffnet wird. */
export function secondsUntilNextShow(now: number = Date.now()): number {
  return Math.max(SHOWS.firstAfterSeconds, (nextShowAt - now) / 1000);
}

export function showPlayed(durationSeconds: number, gapSeconds: number, now: number = Date.now()) {
  nextShowAt = now + (durationSeconds + gapSeconds) * 1000;
}
