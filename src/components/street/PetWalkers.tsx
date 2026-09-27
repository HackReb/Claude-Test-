import { species } from "../../config/pets";
import { hashString, seededRandom } from "../../game/random";
import type { Pet } from "../../model/types";

/** Größe auf dem Gehweg je Tier – der Elefant ist deutlich größer als die Katze. */
const SIZE: Record<string, number> = { katze: 20, dackel: 22, schwein: 26, pony: 32, kamel: 36, elefant: 42 };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Die eigenen Tiere laufen auf den Gehwegen hin und her. */
export function PetWalkers({ pets, width, walkY }: { pets: Pet[]; width: number; walkY: { top: number; bottom: number } }) {
  const still = prefersReducedMotion();
  return (
    <g aria-hidden className="pet-walkers">
      {pets.map((pet, i) => {
        const sp = species(pet.speciesId);
        if (!sp) return null;
        const random = seededRandom(hashString(pet.id));
        const y = (i % 2 === 0 ? walkY.bottom : walkY.top) + 2;
        const from = 40 + random() * (width * 0.3);
        const to = width - 40 - random() * (width * 0.3);
        const duration = 25 + random() * 20;
        const size = SIZE[sp.id] ?? 24;
        return (
          <g key={pet.id} transform={`translate(${from} 0)`}>
            {!still && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${from} 0; ${to} 0; ${from} 0`}
                dur={`${duration}s`}
                begin={`-${(random() * duration).toFixed(1)}s`}
                repeatCount="indefinite"
              />
            )}
            <text y={y} textAnchor="middle" fontSize={size}>
              {sp.emoji}
            </text>
            <text y={y + 12} textAnchor="middle" fontSize={10} fontWeight={800} fill="#2b2118">
              {pet.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
