import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { sound } from "../audio/sound";
import { App } from "./App";
import "./styles.css";

// Browser erlauben Ton erst nach der ersten Berührung.
const unlockAudio = () => sound.unlock();
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
