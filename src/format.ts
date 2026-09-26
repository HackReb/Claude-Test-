const coins = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const rate = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Münzbetrag, abgerundet auf ganze Münzen. */
export const formatCoins = (value: number) => coins.format(Math.floor(value));

/** Miete pro Minute mit max. einer Nachkommastelle. */
export const formatRate = (value: number) => rate.format(value);
