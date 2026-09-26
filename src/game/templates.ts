import type { Building } from "../model/types";
import { createId } from "./ids";

/** Start-Gebäude auf dem geschenkten Grundstück, damit von Anfang an Miete fließt. */
export function starterKiosk(): Building {
  return {
    id: createId(),
    name: "Kiosk",
    level: 1,
    createdBy: "template",
    facade: {
      base: { partId: "base-brick" },
      roof: { partId: "roof-flat" },
      floors: 1,
      parts: [
        { partId: "door-shop", x: 0, y: 0 },
        { partId: "window-square", x: 1, y: 0 },
        { partId: "deco-sign", x: 0, y: 0, text: "KIOSK" },
      ],
    },
  };
}
