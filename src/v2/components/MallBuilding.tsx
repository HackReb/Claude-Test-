import { MALL } from "../config/growth";
import type { Shop } from "../model/types";
import { mallSlot, STAGE, type StageLayout } from "./layout";
import { EmptySlot, ShopFront } from "./ShopFront";

const INK = "#2b2118";

interface Props {
  mall: StageLayout["mall"];
  streetName: string;
  shops: Shop[];
  memberId: string | null;
  /** Darf der Spieler noch einen Laden eröffnen? Dann ist ein freier Platz anklickbar. */
  canOpen: boolean;
  onShop?: (shop: Shop) => void;
  onOpen?: () => void;
}

/** Die Mall: ein großes Haus mit Stockwerken, in jedem bis zu vier Läden mit Namensschild. */
export function MallBuilding({ mall, streetName, shops, memberId, canOpen, onShop, onOpen }: Props) {
  const slots = mall.floors * MALL.shopsPerFloor;
  const title = `MALL ${streetName}`.toUpperCase();
  const titleSize = Math.max(9, Math.min(15, (mall.width - 90) / (title.length * 0.64)));
  return (
    <g className="mall">
      {/* Körper */}
      <rect x={mall.x} y={mall.y + STAGE.mall.roof} width={mall.width} height={mall.height - STAGE.mall.roof} rx={6} fill="#f6efe2" stroke={INK} strokeWidth={3} />
      {/* Stockwerk-Böden */}
      {Array.from({ length: mall.floors - 1 }, (_, i) => {
        const y = mall.ground - 10 - (i + 1) * STAGE.mall.floorHeight;
        return <line key={i} x1={mall.x} y1={y} x2={mall.x + mall.width} y2={y} stroke={INK} strokeWidth={2} />;
      })}
      {/* Dach mit Schriftzug */}
      <rect x={mall.x - 8} y={mall.y} width={mall.width + 16} height={STAGE.mall.roof} rx={8} fill="#2b2118" />
      <rect x={mall.x - 2} y={mall.y + 8} width={mall.width + 4} height={STAGE.mall.roof - 16} rx={6} fill="#ff7a45" stroke="#ffd166" strokeWidth={2} />
      <text x={mall.x + mall.width / 2} y={mall.y + STAGE.mall.roof / 2 + titleSize * 0.36} textAnchor="middle" fontSize={titleSize} fontWeight={900} fill="#fff" stroke={INK} strokeWidth={3} paintOrder="stroke" letterSpacing={1}>
        {title}
      </text>
      {/* Läden */}
      {Array.from({ length: slots }, (_, i) => {
        const slot = mallSlot(mall, i);
        const shop = shops[i];
        const inner = { w: slot.width, h: slot.height - 10 };
        const available = !shop && canOpen && i === shops.length;
        const clickable = shop ? !!onShop : available && !!onOpen;
        return (
          <g
            key={i}
            transform={`translate(${slot.x} ${slot.y + 5})`}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={shop ? `${shop.name} – ${shop.type}` : available ? "Laden eröffnen" : undefined}
            style={clickable ? { cursor: "pointer" } : undefined}
            onClick={clickable ? () => (shop ? onShop?.(shop) : onOpen?.()) : undefined}
            onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " " ? (shop ? onShop?.(shop) : onOpen?.()) : undefined) : undefined}
          >
            {shop ? (
              <ShopFront type={shop.type} name={shop.name} look={shop.look} width={inner.w} height={inner.h} mine={shop.memberId === memberId} />
            ) : (
              <EmptySlot width={inner.w} height={inner.h} available={available} />
            )}
          </g>
        );
      })}
      {/* Eingang unten in der Mitte */}
      <rect x={mall.x + mall.width / 2 - 22} y={mall.ground - 10} width={44} height={10} fill="#8d99ae" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}
