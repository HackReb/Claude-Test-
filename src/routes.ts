/** Alle Screens aus KONZEPT Abschnitt 10 an einer Stelle. */
export const routes = {
  start: "/start",
  street: "/street",
  plot: (plotId: string) => `/plot/${plotId}`,
  builder: (plotId: string) => `/builder/${plotId}`,
  neighborhood: "/neighborhood",
  neighborStreet: (streetId: string) => `/neighborhood/${streetId}`,
  neighborPlot: (streetId: string, plotId: string) => `/neighborhood/${streetId}/plot/${plotId}`,
  neighborBuilder: (streetId: string, plotId: string) => `/neighborhood/${streetId}/builder/${plotId}`,
  share: "/share",
  paper: "/zeitung",
  garage: "/garage",
  pets: "/tiere",
} as const;
