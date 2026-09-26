const coins = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const rate = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Münzbetrag, abgerundet auf ganze Münzen. */
export const formatCoins = (value: number) => coins.format(Math.floor(value));

/** Miete pro Minute mit max. einer Nachkommastelle. */
export const formatRate = (value: number) => rate.format(value);

/** Grobe Zeitangabe, z. B. "vor 3 Std." */
export function formatAgo(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}
