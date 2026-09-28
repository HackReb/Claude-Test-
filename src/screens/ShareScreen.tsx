import { useEffect, useRef, useState } from "react";
import { AccountCard } from "../components/AccountCard";
import { StreetView } from "../components/street/StreetView";
import { formatRate } from "../format";
import { ownedStreetName } from "../game/names";
import { streetIncomePerHour } from "../game/rent";
import { formatPlace } from "../geo/streetSearch";
import { renderStreetImage } from "../share/streetImage";
import { useGameStore } from "../store/gameStore";

type ShareState = { status: "rendering" } | { status: "ready"; file: File; url: string } | { status: "error" };

export function ShareScreen() {
  const street = useGameStore((s) => s.street)!;
  const player = useGameStore((s) => s.player)!;
  const source = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ShareState>({ status: "rendering" });
  const [notice, setNotice] = useState<string | null>(null);

  const built = street.plots.filter((p) => p.building).length;
  const title = ownedStreetName(player.name, street.name);
  const subtitle = `${formatPlace(street)} · ${built} Gebäude · 🪙 ${formatRate(streetIncomePerHour(street))}/Std.`;
  const text = `Das ist ${title} in ${street.city}! ${built} Gebäude und ich kassier Miete. 🏠`;

  // Bild einmal beim Öffnen erzeugen – aus der aktuellen Straße.
  useEffect(() => {
    const svg = source.current?.querySelector("svg");
    if (!svg) return;
    let url: string | null = null;
    renderStreetImage(svg, title, subtitle)
      .then((blob) => {
        const file = new File([blob], `${street.name.replace(/\s+/g, "-")}.png`, { type: "image/png" });
        url = URL.createObjectURL(blob);
        setState({ status: "ready", file, url });
      })
      .catch((error) => {
        console.error(error);
        setState({ status: "error" });
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
    // Nur beim Öffnen: die Miete tickt sekündlich, das Bild soll nicht ständig neu entstehen.
  }, []);

  const canShareFile = state.status === "ready" && typeof navigator.canShare === "function" && navigator.canShare({ files: [state.file] });

  async function onShare() {
    if (state.status !== "ready") return;
    try {
      await navigator.share({ files: [state.file], title, text });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setNotice("Teilen hat nicht geklappt. Speicher das Bild und schick es selbst.");
    }
  }

  return (
    <div className="share-screen">
      <h1>Teilen</h1>
      <p className="subtle">Zeig deinen Freunden deine Straße.</p>

      <div className="card share-preview">
        {state.status === "rendering" && <p className="subtle">Bild wird gemalt …</p>}
        {state.status === "error" && <p className="error">Das Bild konnte nicht erzeugt werden.</p>}
        {state.status === "ready" && <img src={state.url} alt={`Bild von ${title}`} />}
      </div>

      {state.status === "ready" && (
        <div className="actions">
          {canShareFile && (
            <button type="button" className="btn btn-primary" onClick={() => void onShare()}>
              Teilen
            </button>
          )}
          <a className={`btn${canShareFile ? "" : " btn-primary"}`} href={state.url} download={state.file.name}>
            Bild speichern
          </a>
        </div>
      )}
      <p className="hint left">Klappt Speichern nicht? Bild gedrückt halten (Handy) oder Rechtsklick → „Bild speichern“.</p>
      {notice && <p className="error">{notice}</p>}

      <h2>Dein Konto</h2>
      <AccountCard />

      {/* Vorlage fürs Bild: unsichtbar gerendert, damit das SVG vollständig im DOM steht */}
      <div ref={source} className="share-source" aria-hidden>
        <StreetView street={street} ownerName={player.name} />
      </div>
    </div>
  );
}
