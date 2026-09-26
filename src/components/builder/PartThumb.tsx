import type { Part } from "../../model/types";

const VIEWBOX: Record<Part["category"], string> = {
  base: "0 0 40 50",
  roof: "-4 -4 108 48",
  door: "-4 -4 48 58",
  window: "-4 -4 48 58",
  // Deko ragt teils über die Zelle hinaus (Masten, Palmwedel)
  deco: "-6 -16 52 70",
};

/** Kleines Vorschaubild eines Bausteins für die Palette. */
export function PartThumb({ part }: { part: Part }) {
  return (
    <svg
      className="part-thumb"
      viewBox={VIEWBOX[part.category]}
      preserveAspectRatio={part.category === "roof" ? "none" : "xMidYMid meet"}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: part.svg }}
    />
  );
}
