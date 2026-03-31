import { appEnv } from "../../config/env";

type GeocodingSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export type GeocodedLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

type GeocodeLocationOptions = {
  signal?: AbortSignal;
};

export const geocodeLocation = async (
  query: string,
  { signal }: GeocodeLocationOptions = {},
): Promise<GeocodedLocation | null> => {
  const controller = new AbortController();
  const abortFromExternalSignal = (): void => {
    controller.abort();
  };

  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", abortFromExternalSignal);
  }

  const timeoutId = window.setTimeout(() => controller.abort(), appEnv.geocodingTimeoutMs);

  try {
    const searchParams = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
    });

    const response = await fetch(`${appEnv.geocodingEndpoint}?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as GeocodingSearchResult[];
    const first = payload[0];
    if (!first?.lat || !first?.lon) {
      return null;
    }

    const latitude = Number.parseFloat(first.lat);
    const longitude = Number.parseFloat(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      label: first.display_name ?? query,
      latitude,
      longitude,
    };
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortFromExternalSignal);
    }
    window.clearTimeout(timeoutId);
  }
};

