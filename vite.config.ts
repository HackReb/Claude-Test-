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
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "./",
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
        categories: ["games", "entertainment"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // App-Hülle komplett offline verfügbar; die Straßensuche braucht natürlich Netz.
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  build: mode === "artifact" ? { outDir: "dist-artifact", cssCodeSplit: false, modulePreload: false } : {},
  test: {
    environment: "node",
  },
}));
