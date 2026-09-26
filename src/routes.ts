/** Alle Screens aus KONZEPT Abschnitt 10 an einer Stelle. */
export const routes = {
  start: "/start",
  street: "/street",
  plot: (plotId: string) => `/plot/${plotId}`,
  builder: (plotId: string) => `/builder/${plotId}`,
  neighborhood: "/neighborhood",
  neighborStreet: (streetId: string) => `/neighborhood/${streetId}`,
  share: "/share",
} as const;
