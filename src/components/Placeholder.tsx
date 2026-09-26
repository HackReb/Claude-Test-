import type { ReactNode } from "react";

/** Platzhalter für Screens, die in späteren Meilensteinen gebaut werden. */
export function Placeholder({ title, milestone, children }: { title: string; milestone: string; children?: ReactNode }) {
  return (
    <section className="placeholder">
      <h1>{title}</h1>
      <p className="badge">Kommt in {milestone}</p>
      {children}
    </section>
  );
}
