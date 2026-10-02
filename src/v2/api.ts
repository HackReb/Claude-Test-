import type { OsmStreetRef } from "../model/types";
import type { Shop, V2State } from "./model/types";

const AUTH_KEY = "babo2:auth";
const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === "string" ? body.error : `HTTP ${status}`);
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.status >= 500 ? "Der Server hat gerade ein Problem. Versuch es gleich nochmal." : error.message;
  return "Der Server ist gerade nicht erreichbar.";
}

interface AccountResponse {
  token: string;
  account: { name: string };
}

/** Babo v2 spricht mit demselben Server wie v1: gleiche Konten, eigene Endpunkte unter /api/v2. */
export class V2Api {
  private token: string | null;

  constructor(
    private readonly base: string,
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {
    this.token = this.storage.getItem(AUTH_KEY);
  }

  get signedIn(): boolean {
    return this.token !== null;
  }

  async login(name: string, password: string): Promise<void> {
    const result = await this.request<AccountResponse>("POST", "/account/login", { name, password }, false);
    this.setToken(result.token);
  }

  async register(name: string, password: string): Promise<void> {
    const result = await this.request<AccountResponse>("POST", "/account/register", { name, password }, false);
    this.setToken(result.token);
  }

  async logout(): Promise<void> {
    await this.request("POST", "/account/logout").catch(() => undefined);
    this.setToken(null);
  }

  me(): Promise<V2State> {
    return this.request<V2State>("GET", "/v2/me");
  }

  join(street: { name: string; city: string; osm?: OsmStreetRef }, data: Record<string, unknown>): Promise<V2State> {
    return this.request<V2State>("POST", "/v2/join", { ...street, data });
  }

  leave(): Promise<V2State> {
    return this.request<V2State>("POST", "/v2/leave");
  }

  async save(data: Record<string, unknown>): Promise<void> {
    await this.request("PUT", "/v2/me", { data });
  }

  openShop(type: string, name: string, look: number): Promise<V2State & { shop: Shop }> {
    return this.request<V2State & { shop: Shop }>("POST", "/v2/shops", { type, name, look });
  }

  updateShop(id: string, patch: { name?: string; look?: number; data?: Record<string, unknown> }): Promise<{ shop: Shop }> {
    return this.request<{ shop: Shop }>("PUT", `/v2/shops/${encodeURIComponent(id)}`, patch);
  }

  closeShop(id: string): Promise<V2State> {
    return this.request<V2State>("DELETE", `/v2/shops/${encodeURIComponent(id)}`);
  }

  /** 401 = Sitzung weg (anderswo abgemeldet, Passwort geändert): Schlüssel vergessen. */
  forgetIfSignedOut(error: unknown): boolean {
    if (error instanceof ApiError && error.status === 401) {
      this.setToken(null);
      return true;
    }
    return false;
  }

  private setToken(token: string | null) {
    this.token = token;
    if (token) this.storage.setItem(AUTH_KEY, token);
    else this.storage.removeItem(AUTH_KEY);
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown, withToken = true): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (withToken && this.token) headers.Authorization = `Bearer ${this.token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetcher(`${this.base}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new ApiError(response.status, data);
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
