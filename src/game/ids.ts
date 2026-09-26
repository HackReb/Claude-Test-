/** Eindeutige ID. `crypto.randomUUID` gibt es nur in sicheren Kontexten (HTTPS/localhost), daher ein Fallback. */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
