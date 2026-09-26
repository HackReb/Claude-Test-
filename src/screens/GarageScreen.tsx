import { useState } from "react";
import { Link } from "react-router-dom";
import { sound } from "../audio/sound";
import { CarSvg, carLength } from "../components/cars/CarSvg";
import { CAR_COLORS, CAR_MODELS, CARS, carModel, type CarModel } from "../config/cars";
import { formatCoins } from "../format";
import { defaultCarName, defaultPlate } from "../game/cars";
import type { Car } from "../model/types";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Autohaus: eigene Autos verwalten, neue kaufen. */
export function GarageScreen() {
  const player = useGameStore((s) => s.player)!;
  const cars = player.cars ?? [];
  const full = cars.length >= CARS.maxCars;

  return (
    <div className="garage">
      <Link className="btn btn-link back" to={routes.street}>
        ← Zur Straße
      </Link>
      <h1>🚗 Autohaus Babo</h1>
      <p className="subtle">Deine Autos fahren auf deiner Straße herum. Antippen = hupen!</p>

      <h2>
        Deine Garage ({cars.length}/{CARS.maxCars})
      </h2>
      {cars.length === 0 ? (
        <p className="subtle">Noch leer. Such dir unten was Schönes aus.</p>
      ) : (
        <ul className="garage-list">
          {cars.map((car) => (
            <OwnedCar key={car.id} car={car} />
          ))}
        </ul>
      )}

      <h2>Neuwagen</h2>
      {full && <p className="badge">Deine Garage ist voll – mehr als {CARS.maxCars} Autos passen nicht auf deine Straße.</p>}
      <ul className="car-shop">
        {CAR_MODELS.map((model) => (
          <ShopCar key={model.id} model={model} garageFull={full} />
        ))}
      </ul>
    </div>
  );
}

/** Deutsches Nummernschild mit blauem EU-Streifen. */
export function Plate({ text }: { text: string }) {
  return (
    <span className="plate" aria-label={`Kennzeichen ${text}`}>
      <span className="plate-eu" aria-hidden>
        D
      </span>
      <span>{text}</span>
    </span>
  );
}

function CarPreview({ model, color, plate, onClick }: { model: CarModel; color: string; plate?: string; onClick?: () => void }) {
  const length = carLength(model.type);
  return (
    <svg
      className="car-preview"
      viewBox={`-6 -54 ${length + 12} 60`}
      role={onClick ? "button" : "img"}
      aria-label={`${model.brand} ${model.model}${onClick ? " – hupen" : ""}`}
      onClick={onClick}
    >
      <rect x={-6} y={-2} width={length + 12} height={8} fill="#4a4a5a" />
      <CarSvg type={model.type} color={color} plate={plate} />
    </svg>
  );
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {CAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Farbe ${color}`}
          className={`swatch${value === color ? " selected" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function OwnedCar({ car }: { car: Car }) {
  const updateCar = useGameStore((s) => s.updateCar);
  const model = carModel(car.modelId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(car.name);
  const [plate, setPlate] = useState(car.plate);
  if (!model) return null;

  return (
    <li className="card garage-car">
      <CarPreview model={model} color={car.color} plate={car.plate} onClick={() => sound.horn(model.horn)} />
      <div className="garage-car-info">
        <strong>{car.name}</strong>
        <span className="subtle">
          {model.brand} {model.model}
        </span>
        <Plate text={car.plate} />
      </div>
      {editing ? (
        <form
          className="car-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await updateCar(car.id, { name, plate })) {
              sound.tap();
              setEditing(false);
            }
          }}
        >
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={CARS.carNameMaxLength} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Nummernschild</span>
            <input
              value={plate}
              maxLength={CARS.plateMaxLength}
              autoCapitalize="characters"
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
            />
          </label>
          <ColorPicker label="Neu lackieren" value={car.color} onChange={(color) => void updateCar(car.id, { color })} />
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              Speichern
            </button>
            <button type="button" className="btn btn-link" onClick={() => setEditing(false)}>
              Fertig
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-link" onClick={() => setEditing(true)}>
          ✏️ Name, Schild & Farbe
        </button>
      )}
    </li>
  );
}

function ShopCar({ model, garageFull }: { model: CarModel; garageFull: boolean }) {
  const player = useGameStore((s) => s.player)!;
  const city = useGameStore((s) => s.street!.city);
  const buyCar = useGameStore((s) => s.buyCar);
  const [color, setColor] = useState<string>(CAR_COLORS[0]);
  const [checkout, setCheckout] = useState<{ name: string; plate: string } | null>(null);
  const [bought, setBought] = useState(false);
  const affordable = player.coins >= model.price;

  async function onBuy() {
    if (!checkout) return;
    const result = await buyCar({ modelId: model.id, color, ...checkout });
    if (result.ok) {
      sound.cash();
      setTimeout(() => sound.horn(model.horn), 500);
      setCheckout(null);
      setBought(true);
      setTimeout(() => setBought(false), 2500);
    } else {
      sound.deny();
    }
  }

  return (
    <li className="card shop-car">
      <CarPreview model={model} color={color} onClick={() => sound.horn(model.horn)} />
      <div className="shop-car-head">
        <div>
          <strong>
            {model.brand} {model.model}
          </strong>
          <span className="subtle">„{model.slogan}“</span>
        </div>
        <strong className="shop-price">🪙 {formatCoins(model.price)}</strong>
      </div>
      <ColorPicker label={`Farbe für ${model.brand} ${model.model}`} value={color} onChange={setColor} />

      {checkout ? (
        <form
          className="car-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onBuy();
          }}
        >
          <label className="field">
            <span>Name</span>
            <input value={checkout.name} maxLength={CARS.carNameMaxLength} onChange={(e) => setCheckout({ ...checkout, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Nummernschild</span>
            <input
              value={checkout.plate}
              maxLength={CARS.plateMaxLength}
              autoCapitalize="characters"
              onChange={(e) => setCheckout({ ...checkout, plate: e.target.value.toUpperCase() })}
            />
          </label>
          <Plate text={checkout.plate || "…"} />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={!checkout.name.trim() || !checkout.plate.trim()}>
              Kaufen für 🪙 {formatCoins(model.price)}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setCheckout(null)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={!affordable || garageFull}
          onClick={() =>
            setCheckout({
              name: defaultCarName(player.name, model.id),
              plate: defaultPlate(city, player.name, 1 + Math.floor(Math.random() * 999)),
            })
          }
        >
          {garageFull ? "Garage voll" : affordable ? "Aussuchen" : `Dir fehlen 🪙 ${formatCoins(model.price - player.coins)}`}
        </button>
      )}
      {bought && (
        <p className="honk" role="status">
          🎉 Gekauft! Dein {model.brand} fährt jetzt auf deiner Straße.
        </p>
      )}
    </li>
  );
}
