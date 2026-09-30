/**
 * Aliens: Ab und zu fliegt ein UFO über die eigene Straße und schießt mit dem Laser auf ein Haus
 * (Fenster kaputt – wie bei den Knallfröschen). Jeder bekommt es mindestens einmal zu sehen.
 */
export const ALIENS = {
  /** Erster Besuch: so viele Sekunden, nachdem man die eigene Straße geöffnet hat. */
  firstVisitAfterSeconds: 45,
  /** Danach kommen sie frühestens bzw. spätestens nach so vielen Stunden wieder. */
  minHoursBetween: 48,
  maxHoursBetween: 120,
  /** Ist ein Besuch fällig, kommt das UFO so viele Sekunden nach dem Öffnen der Straße. */
  arriveAfterSeconds: 20,
  /** Ablauf in Sekunden: anfliegen, zielen, Laser, abhauen. */
  timing: { flyIn: 2.4, aim: 0.9, laser: 1.3, flyOut: 2.2 },
} as const;

export const alienShowSeconds = () => ALIENS.timing.flyIn + ALIENS.timing.aim + ALIENS.timing.laser + ALIENS.timing.flyOut;
