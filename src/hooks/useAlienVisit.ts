import { useEffect, useRef, useState } from "react";
import { sound } from "../audio/sound";
import { ALIENS, alienShowSeconds } from "../config/aliens";
import { UFO_HIT_AT } from "../components/street/UfoAttack";
import { alienDueAt, alienTargets } from "../game/aliens";
import { useGameStore } from "../store/gameStore";

/** Timer, die länger als so lange laufen würden, gar nicht erst stellen (dann kommt das UFO beim nächsten Öffnen). */
const MAX_WAIT_MS = 6 * 3_600_000;

export interface UfoShow {
  plotId: string;
  /** performance.now() beim Start – danach richtet sich die Animation. */
  startedAt: number;
  /** Sprechblase unter der Straße. */
  message: string;
  /** UFO noch in der Luft (danach bleibt nur die Meldung kurz stehen). */
  flying: boolean;
}

/**
 * Ab und zu kommen Aliens: Das UFO erscheint, solange man die eigene Straße ansieht, alle rennen weg,
 * der Laser trifft ein Haus. Beim ersten Mal kurz nach dem Öffnen – jeder soll es einmal sehen.
 */
export function useAlienVisit(): UfoShow | null {
  const player = useGameStore((s) => s.player);
  const alienAttack = useGameStore((s) => s.alienAttack);
  const [show, setShow] = useState<UfoShow | null>(null);
  const openedAt = useRef(Date.now());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Höchstens ein Besuch, solange die Straße offen ist.
  const visited = useRef(false);
  const dueAt = player ? alienDueAt(player, openedAt.current) : null;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (show || dueAt === null || visited.current) return;
    const wait = dueAt - Date.now();
    if (wait > MAX_WAIT_MS) return;

    const start = () => {
      // Nur, wenn man auch hinschaut – sonst etwas später nochmal versuchen.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        timers.current.push(setTimeout(start, 5000));
        return;
      }
      const state = useGameStore.getState();
      if (!state.street || !state.player) return;
      const targets = alienTargets(state.street, state.player.id);
      if (targets.length === 0) return;
      const target = targets[Math.floor(Math.random() * targets.length)];
      visited.current = true;
      const name = target.building!.name;
      const seconds = alienShowSeconds();
      setShow({ plotId: target.id, startedAt: performance.now(), message: "👽 Aliens! Ein UFO über der Straße – alle rennen weg!", flying: true });
      sound.ufo(seconds);
      const at = (s: number, fn: () => void) => timers.current.push(setTimeout(fn, s * 1000));
      at(0.9, () => sound.screams());
      at(ALIENS.timing.flyIn + ALIENS.timing.aim, () => sound.laser());
      at(UFO_HIT_AT, () => {
        sound.boom();
        setShow((s) => s && { ...s, message: `💥 Volltreffer! ${name} ist beschädigt – reparieren kannst du es auf dem Grundstück.` });
        void alienAttack(target.id);
      });
      at(seconds, () => setShow((s) => s && { ...s, flying: false }));
      at(seconds + 4, () => setShow(null));
    };

    const timer = setTimeout(start, Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [dueAt, show, alienAttack]);

  return show;
}
