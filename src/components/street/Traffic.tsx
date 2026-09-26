import { useEffect, useMemo, useRef, useState } from "react";
import { CAR_COLORS, CAR_MODELS, CARS, carModel, type CarModel } from "../../config/cars";
import { hashString, seededRandom } from "../../game/random";
import type { Car } from "../../model/types";
import { CarSvg, carLength } from "../cars/CarSvg";

type Lane = "top" | "bottom";

interface Vehicle {
  key: string;
  model: CarModel;
  color: string;
  /** Eigenes Auto des Spielers (hat Namen und Schild). */
  car?: Car;
  lane: Lane;
  x: number;
  speed: number;
  /** Wartet am Rand, bis es (wieder) losfährt. */
  waitUntil: number;
  spin: number;
}

interface Props {
  seed: string;
  width: number;
  /** Radlinie je Fahrspur (y). Oben wird nach links gefahren, unten nach rechts. */
  laneY: Record<Lane, number>;
  cars: Car[];
  /** Anzahl fremder Autos. */
  trafficCount: number;
  onTap?: (vehicle: { model: CarModel; car?: Car }) => void;
}

const MARGIN = 110;
/** Autos etwas größer als „echt“, damit man sie neben den Häusern gut sieht. */
const CAR_SCALE = 1.2;
const dirOf = (lane: Lane): 1 | -1 => (lane === "bottom" ? 1 : -1);

/** Autos auf der Fahrbahn: eigene (mit Schild) und normaler Verkehr. */
export function Traffic({ seed, width, laneY, cars, trafficCount, onTap }: Props) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const carsKey = cars.map((c) => `${c.id}:${c.modelId}:${c.color}:${c.plate}:${c.name}`).join("|");
  const vehicles = useMemo(() => {
    const random = seededRandom(hashString(`traffic:${seed}`));
    const list: Vehicle[] = [];
    const now = performance.now() / 1000;
    cars.forEach((car, i) => {
      const model = carModel(car.modelId);
      if (!model) return;
      const lane: Lane = i % 2 === 0 ? "bottom" : "top";
      list.push({ key: car.id, model, color: car.color, car, lane, x: 60 + random() * (width - 120), speed: model.speed, waitUntil: 0, spin: 0 });
    });
    for (let i = 0; i < Math.min(CARS.trafficMax, trafficCount); i++) {
      const model = CAR_MODELS[Math.floor(random() * CAR_MODELS.length)];
      const lane: Lane = random() < 0.5 ? "top" : "bottom";
      list.push({
        key: `npc-${i}`,
        model,
        color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
        lane,
        x: -MARGIN,
        speed: model.speed * (0.8 + random() * 0.4),
        waitUntil: now + random() * 8,
        spin: 0,
      });
    }
    return list;
    // carsKey fasst die relevanten Auto-Eigenschaften zusammen
  }, [seed, width, carsKey, trafficCount]);

  const state = useRef(vehicles);
  const [, setFrame] = useState(0);

  useEffect(() => {
    state.current = vehicles.map((v) => ({ ...v }));
    if (reduced) {
      setFrame((f) => f + 1);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const v of state.current) {
        if (t < v.waitUntil) continue;
        const dir = dirOf(v.lane);
        v.x += dir * v.speed * dt;
        v.spin = (v.spin + dir * v.speed * dt * 8) % 360;
        const gone = dir === 1 ? v.x > width + MARGIN : v.x < -MARGIN - carLength(v.model.type);
        if (gone) {
          // Am anderen Ende wieder einfahren; fremder Verkehr mit kurzer Pause
          v.x = dir === 1 ? -MARGIN : width + MARGIN;
          v.waitUntil = v.car ? t + 1 : t + 1 + Math.random() * 7;
        }
      }
      if (now - lastRender > 33) {
        lastRender = now;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vehicles, reduced, width]);

  return (
    <g className="traffic">
      {state.current.map((v) => {
        const dir = dirOf(v.lane);
        const label = v.car ? `${v.car.name}, ${v.model.brand} ${v.model.model}, Kennzeichen ${v.car.plate}` : `${v.model.brand} ${v.model.model}`;
        return (
          <g
            key={v.key}
            className={`vehicle${v.car ? " own" : ""}`}
            transform={`translate(${v.x} ${laneY[v.lane]}) scale(${CAR_SCALE})`}
            role={onTap ? "button" : undefined}
            aria-label={onTap ? `${label} – hupen` : undefined}
            onClick={onTap ? () => onTap({ model: v.model, car: v.car }) : undefined}
          >
            <CarSvg type={v.model.type} color={v.color} plate={v.car?.plate} dir={dir} spin={v.spin} />
            {v.car && (
              // Eigene Autos tragen ihren Namen
              <NameTag x={carLength(v.model.type) / 2} name={v.car.name} />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Namensschild über einem eigenen Auto – so breit wie der Name. */
function NameTag({ x, name }: { x: number; name: string }) {
  const label = name.length > 20 ? `${name.slice(0, 19)}…` : name;
  const width = Math.max(40, label.length * 5.6 + 14);
  return (
    <g aria-hidden>
      <rect x={x - width / 2} y={-66} width={width} height={14} rx={7} fill="#ff7a45" stroke="#2b2118" strokeWidth={1.5} />
      <text x={x} y={-56} textAnchor="middle" fontSize={9} fontWeight={900} fill="#fff">
        {label}
      </text>
    </g>
  );
}
