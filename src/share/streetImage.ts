/** Rendert die SVG-Straßenansicht als PNG mit Titelzeile – zum Teilen oder Speichern. */

const SCALE = 1.5;
const PAD = 32;
const HEADER = 120;
const FOOTER = 56;
const FONT = '"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export async function renderStreetImage(svg: SVGSVGElement, title: string, subtitle: string): Promise<Blob> {
  const { width: vbWidth, height: vbHeight } = svg.viewBox.baseVal;
  const width = Math.round(vbWidth * SCALE);
  const height = Math.round(vbHeight * SCALE);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("font-family", FONT);
  clone.removeAttribute("style");
  const source = new XMLSerializer().serializeToString(clone);

  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width + 2 * PAD;
  canvas.height = HEADER + height + FOOTER;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");

  ctx.fillStyle = "#fff7e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff7a45";
  ctx.fillRect(0, 0, canvas.width, HEADER - 16);
  ctx.fillStyle = "#2b2118";
  ctx.fillRect(0, HEADER - 20, canvas.width, 4);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 46px ${FONT}`;
  ctx.fillText(title, PAD, 58);
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(subtitle, PAD, 90);

  ctx.drawImage(image, PAD, HEADER, width, height);

  ctx.fillStyle = "#7a6a5a";
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText("Gebaut mit Babo – claim deine echte Straße!", PAD, HEADER + height + 36);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erzeugt werden"))), "image/png"),
  );
}
