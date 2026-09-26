/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// `--mode artifact`: Vorschau-Build für eine eingebettete Einzelseite (ohne Service Worker, alles in einem Chunk).
export default defineConfig(({ mode }) => ({
  // Relative base so the build also works from a sub-path (e.g. GitHub Pages).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      disable: mode === "artifact",
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Babo – Deine Straße",
        short_name: "Babo",
        description: "Claim deine echte Straße, bau verrückte Häuser und kassier Miete.",
        lang: "de",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#fff7e8",
        theme_color: "#ff7a45",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: mode === "artifact" ? { outDir: "dist-artifact", cssCodeSplit: false, modulePreload: false } : {},
  test: {
    environment: "node",
  },
}));
