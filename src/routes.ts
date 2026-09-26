/** Alle Screens aus KONZEPT Abschnitt 10 an einer Stelle. */
export const routes = {
  start: "/start",
  street: "/street",
  plot: (plotId: string) => `/plot/${plotId}`,
  builder: (plotId: string) => `/builder/${plotId}`,
  neighborhood: "/neighborhood",
  share: "/share",
} as const;
