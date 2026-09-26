import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { sound } from "./audio/sound";
import "./styles.css";

// Im Artifact-Build (eingebettete Vorschau) gibt es keinen Service Worker.
if (import.meta.env.MODE !== "artifact") registerSW({ immediate: true });

// Browser erlauben Ton erst nach der ersten Berührung.
const unlockAudio = () => sound.unlock();
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
