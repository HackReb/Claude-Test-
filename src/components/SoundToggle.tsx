import { useEffect, useState } from "react";
import { sound } from "../audio/sound";

/** Ton an/aus – gilt für Effekte und Straßengeräusche. */
export function SoundToggle() {
  const [muted, setMuted] = useState(sound.isMuted);
  useEffect(() => sound.onMuteChange(setMuted), []);
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? "Ton einschalten" : "Ton ausschalten"}
      onClick={() => sound.setMuted(!muted)}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
