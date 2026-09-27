import { useState } from "react";
import { Link } from "react-router-dom";
import { sound } from "../audio/sound";
import { PETS, SPECIES, species, type Species } from "../config/pets";
import { formatCoins, formatDuration, formatRate } from "../format";
import type { Pet } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

const NO_PETS: Pet[] = [];

/** Tierhandlung: Tiere kaufen – sie gehen in der Nachbarschaft spazieren und hinterlassen dort Haufen. */
export function PetShopScreen() {
  // Kein `?? []` im Selektor: ein neues Array bei jedem Aufruf lässt Zustand endlos neu rendern.
  const ownPets = useGameStore((s) => s.player!.pets);
  const pets = ownPets ?? NO_PETS;
  const full = pets.length >= PETS.maxPets;

  return (
    <div className="garage">
      <Link className="btn btn-link back" to={routes.street}>
        ← Zur Straße
      </Link>
      <h1>🐾 Tierhandlung</h1>
      <p className="subtle">
        Deine Tiere gehen regelmäßig in der Nachbarschaft spazieren – und lassen dort etwas liegen. Je größer das Tier, desto größer der
        Haufen. Die Nachbarn werden sich „freuen“.
      </p>

      <h2>
        Deine Tiere ({pets.length}/{PETS.maxPets})
      </h2>
      {pets.length === 0 ? (
        <p className="subtle">Noch keine. Such dir unten eins aus.</p>
      ) : (
        <ul className="garage-list">
          {pets.map((pet) => (
            <OwnedPet key={pet.id} pet={pet} />
          ))}
        </ul>
      )}

      <h2>Zu verkaufen</h2>
      {full && <p className="badge">Mehr als {PETS.maxPets} Tiere passen nicht in deine Straße.</p>}
      <ul className="car-shop">
        {SPECIES.map((sp) => (
          <ShopPet key={sp.id} sp={sp} full={full} />
        ))}
      </ul>
    </div>
  );
}

function OwnedPet({ pet }: { pet: Pet }) {
  const sp = species(pet.speciesId);
  if (!sp) return null;
  const now = Date.now();
  const next = pet.nextOutingAt ?? pet.boughtAt;
  return (
    <li className="card pet-card">
      <span className="pet-emoji" aria-hidden>
        {sp.emoji}
      </span>
      <span className="garage-car-info">
        <strong>{pet.name}</strong>
        <span className="subtle">
          {sp.name} · 💩 {sp.poopPerOuting} pro Ausflug
        </span>
        <span className="subtle">
          {next > now ? `Nächster Spaziergang in ${formatDuration((next - now) / 3_600_000)}` : "Geht gleich spazieren"}
        </span>
      </span>
    </li>
  );
}

function ShopPet({ sp, full }: { sp: Species; full: boolean }) {
  const coins = useGameStore((s) => s.player!.coins);
  const buyPet = useGameStore((s) => s.buyPet);
  const [name, setName] = useState<string | null>(null);
  const [bought, setBought] = useState(false);
  const affordable = coins >= sp.price;

  async function onBuy() {
    if (name === null) return;
    const result = await buyPet(sp.id, name);
    if (result.ok) {
      sound.cash();
      setName(null);
      setBought(true);
      setTimeout(() => setBought(false), 2500);
    } else sound.deny();
  }

  return (
    <li className="card shop-car">
      <div className="shop-car-head">
        <span className="pet-emoji big" aria-hidden>
          {sp.emoji}
        </span>
        <div>
          <strong>{sp.name}</strong>
          <span className="subtle">{sp.blurb}</span>
          <span className="pet-stats">
            💩 {sp.poopPerOuting} Haufen alle {sp.outingEveryHours} Std. bei den Nachbarn · Futter 🪙 {formatRate(sp.upkeepPerHour)}/Std.
          </span>
        </div>
        <strong className="shop-price">🪙 {formatCoins(sp.price)}</strong>
      </div>
      {name !== null ? (
        <form
          className="car-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onBuy();
          }}
        >
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={PETS.nameMaxLength} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Kaufen für 🪙 {formatCoins(sp.price)}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setName(null)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={!affordable || full}
          onClick={() => setName(sp.names[Math.floor(Math.random() * sp.names.length)])}
        >
          {full ? "Kein Platz mehr" : affordable ? "Aussuchen" : `Dir fehlen 🪙 ${formatCoins(sp.price - coins)}`}
        </button>
      )}
      {bought && (
        <p className="honk" role="status">
          🎉 Willkommen zu Hause! Bald geht es auf den ersten Spaziergang.
        </p>
      )}
    </li>
  );
}
