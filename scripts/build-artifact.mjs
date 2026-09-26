// Baut eine Vorschau-Version als einzelne HTML-Datei (JS + CSS inline), z. B. zum Teilen als Web-Artifact.
// Aufruf: npm run build:artifact  →  dist-artifact/babo-preview.html (+ icon.svg daneben)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "dist-artifact";
execSync("npx vite build --mode artifact", { stdio: "inherit" });

const html = readFileSync(join(outDir, "index.html"), "utf8");
const asset = (pattern) => {
  const match = html.match(pattern);
  if (!match) throw new Error(`Asset nicht gefunden: ${pattern}`);
  return readFileSync(join(outDir, match[1]), "utf8");
};
const js = asset(/<script[^>]+src="\.\/([^"]+\.js)"/).replace(/<\/script/gi, "<\\/script");
const css = asset(/<link[^>]+href="\.\/([^"]+\.css)"/).replace(/<\/style/gi, "<\\/style");

const page = `<meta charset="utf-8">
<title>Babo Straßen-Game</title>
<meta name="theme-color" content="#ff7a45">
<link rel="icon" type="image/svg+xml" href="./icon.svg">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(join(outDir, "babo-preview.html"), page);
console.log(`→ ${outDir}/babo-preview.html (${(page.length / 1024).toFixed(0)} KB)`);
