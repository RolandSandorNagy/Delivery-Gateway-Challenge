/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DGW_GRAPHQL_ENDPOINT?: string;
  readonly VITE_DGW_MERCHANT_ID?: string;
  readonly VITE_DGW_SESSION_ID?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_GEOCODING_ENDPOINT?: string;
  readonly VITE_GEOCODING_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
