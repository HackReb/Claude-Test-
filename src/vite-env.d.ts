/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse des Babo-Servers, z. B. https://babo.example.de – ohne: Spielstand nur auf dem Gerät. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
