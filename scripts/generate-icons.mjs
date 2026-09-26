// Erzeugt die PNG-App-Icons aus den SVGs in public/ (einmalig bzw. nach Icon-Änderungen).
// Aufruf: npx -y -p playwright node scripts/generate-icons.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const targets = [
  { svg: "public/icon.svg", out: "public/pwa-192x192.png", size: 192 },
  { svg: "public/icon.svg", out: "public/pwa-512x512.png", size: 512 },
  { svg: "public/icon-maskable.svg", out: "public/maskable-512x512.png", size: 512 },
  // iOS rundet selbst ab und mag keine Transparenz → randlose Variante
  { svg: "public/icon-maskable.svg", out: "public/apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { svg, out, size } of targets) {
  const markup = readFileSync(svg, "utf8").replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator("svg").screenshot({ path: out, omitBackground: true });
  console.log(`→ ${out}`);
}
await browser.close();
