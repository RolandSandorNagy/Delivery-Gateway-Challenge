const required = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const numeric = (name: keyof ImportMetaEnv, fallback: number): number => {
  const raw = import.meta.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appEnv = {
  graphqlEndpoint: required("VITE_DGW_GRAPHQL_ENDPOINT"),
  merchantId: required("VITE_DGW_MERCHANT_ID"),
  sessionId: required("VITE_DGW_SESSION_ID"),
  requestTimeoutMs: numeric("VITE_REQUEST_TIMEOUT_MS", 15_000),
  geocodingEndpoint:
    import.meta.env.VITE_GEOCODING_ENDPOINT ?? "https://nominatim.openstreetmap.org/search",
  geocodingTimeoutMs: numeric("VITE_GEOCODING_TIMEOUT_MS", 10_000),
};
