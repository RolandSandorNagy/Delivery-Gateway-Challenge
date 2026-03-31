import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphQlHttpError, GraphQlResponseError } from "../../lib/graphql-client";
import type { PickupPoint, PickupPointMapBounds, PickupPointViewport } from "./model";
import { fetchPickupPointsPage } from "./pickup-points.api";

type PickupPointsStatus = "loading" | "success" | "error";

type PickupPointsState = {
  status: PickupPointsStatus;
  pickupPoints: PickupPoint[];
  errorMessage: string | null;
  totalInViewport: number | null;
  isBackgroundLoading: boolean;
};

export type UsePickupPointsResult = PickupPointsState & {
  reload: () => void;
};

const FETCH_DEBOUNCE_MS = 300;
const FIRST_PAGE_SIZE = 200;
const BACKGROUND_PAGE_SIZE = 200;
const MAX_PICKUP_POINTS = 2000;
const MAX_BACKGROUND_PAGES = 8;
const MAX_CACHE_ENTRIES = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const PREFETCH_PADDING_FACTOR = 0.35;

const mapErrorMessage = (error: unknown): string => {
  if (error instanceof GraphQlHttpError) {
    return `Network request failed with HTTP ${error.status}.`;
  }

  if (error instanceof GraphQlResponseError) {
    const firstMessage = error.details[0]?.message;
    return firstMessage ? `GraphQL error: ${firstMessage}` : "GraphQL response returned an unknown error.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error happened while loading pickup points.";
};

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

const mergeUniqueById = (base: PickupPoint[], incoming: PickupPoint[]): PickupPoint[] => {
  const byId = new Map<string, PickupPoint>();
  for (const item of base) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
};

type CacheEntry = {
  key: string;
  bounds: PickupPointMapBounds;
  pickupPoints: PickupPoint[];
  total: number | null;
  createdAt: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const canUseSimpleLongitudeBounds = (bounds: PickupPointMapBounds): boolean => bounds.west <= bounds.east;

const boundsContain = (outer: PickupPointMapBounds, inner: PickupPointMapBounds): boolean => {
  if (!canUseSimpleLongitudeBounds(outer) || !canUseSimpleLongitudeBounds(inner)) {
    return false;
  }

  return (
    inner.south >= outer.south &&
    inner.north <= outer.north &&
    inner.west >= outer.west &&
    inner.east <= outer.east
  );
};

const expandBounds = (bounds: PickupPointMapBounds, factor: number): PickupPointMapBounds => {
  if (!canUseSimpleLongitudeBounds(bounds)) {
    return bounds;
  }

  const latSpan = bounds.north - bounds.south;
  const lonSpan = bounds.east - bounds.west;
  const latPadding = latSpan * factor;
  const lonPadding = lonSpan * factor;

  return {
    north: clamp(bounds.north + latPadding, -85, 85),
    south: clamp(bounds.south - latPadding, -85, 85),
    east: clamp(bounds.east + lonPadding, -180, 180),
    west: clamp(bounds.west - lonPadding, -180, 180),
  };
};

const cacheKeyFromBounds = (bounds: PickupPointMapBounds): string =>
  [bounds.north.toFixed(3), bounds.south.toFixed(3), bounds.east.toFixed(3), bounds.west.toFixed(3)].join("|");

const putCacheEntry = (cache: Map<string, CacheEntry>, entry: CacheEntry): void => {
  cache.delete(entry.key);
  cache.set(entry.key, entry);

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
};

const findCoveringCacheEntry = (
  cache: Map<string, CacheEntry>,
  viewport: PickupPointViewport,
): CacheEntry | null => {
  const now = Date.now();
  for (const entry of cache.values()) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      continue;
    }

    if (boundsContain(entry.bounds, viewport.bounds)) {
      return entry;
    }
  }
  return null;
};

export const usePickupPoints = (viewport: PickupPointViewport | null): UsePickupPointsResult => {
  const [reloadCounter, setReloadCounter] = useState(0);
  const [state, setState] = useState<PickupPointsState>({
    status: "loading",
    pickupPoints: [],
    errorMessage: null,
    totalInViewport: null,
    isBackgroundLoading: false,
  });

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const activeRequestIdRef = useRef(0);
  const requestedViewport = useMemo(() => {
    if (!viewport) {
      return null;
    }

    return {
      zoom: viewport.zoom,
      bounds: expandBounds(viewport.bounds, PREFETCH_PADDING_FACTOR),
    } satisfies PickupPointViewport;
  }, [viewport]);
  const requestedBoundsKey = requestedViewport ? cacheKeyFromBounds(requestedViewport.bounds) : null;

  const reload = useCallback(() => {
    cacheRef.current.clear();
    setReloadCounter((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!viewport || !requestedViewport || !requestedBoundsKey) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const isActiveRequest = (): boolean => activeRequestIdRef.current === requestId;

    const coveringCacheEntry = findCoveringCacheEntry(cacheRef.current, viewport);
    if (coveringCacheEntry) {
      if (isActiveRequest()) {
        setState({
          status: "success",
          pickupPoints: coveringCacheEntry.pickupPoints,
          errorMessage: null,
          totalInViewport: coveringCacheEntry.total,
          isBackgroundLoading: false,
        });
      }
      return;
    }

    const controller = new AbortController();
    setState((current) => ({
      ...current,
      status: "loading",
      errorMessage: null,
      isBackgroundLoading: false,
    }));

    const timeoutId = window.setTimeout(() => {
      if (!isActiveRequest() || controller.signal.aborted) {
        return;
      }

      fetchPickupPointsPage({
        viewport: requestedViewport,
        page: 1,
        first: FIRST_PAGE_SIZE,
        signal: controller.signal,
      })
        .then(async (firstPage) => {
          if (!isActiveRequest() || controller.signal.aborted) {
            return;
          }

          let aggregated = firstPage.pickupPoints;
          const initialSlice = aggregated.slice(0, MAX_PICKUP_POINTS);
          putCacheEntry(cacheRef.current, {
            key: requestedBoundsKey,
            bounds: requestedViewport.bounds,
            pickupPoints: initialSlice,
            total: firstPage.total,
            createdAt: Date.now(),
          });

          if (isActiveRequest()) {
            setState({
              status: "success",
              pickupPoints: initialSlice,
              errorMessage: null,
              totalInViewport: firstPage.total,
              isBackgroundLoading: firstPage.hasMorePages && initialSlice.length < MAX_PICKUP_POINTS,
            });
          }

          let page = 2;
          let hasMorePages = firstPage.hasMorePages;
          let loadedBackgroundPages = 0;

          while (
            hasMorePages &&
            aggregated.length < MAX_PICKUP_POINTS &&
            loadedBackgroundPages < MAX_BACKGROUND_PAGES
          ) {
            const nextPage = await fetchPickupPointsPage({
              viewport: requestedViewport,
              page,
              first: BACKGROUND_PAGE_SIZE,
              signal: controller.signal,
            });

            if (!isActiveRequest() || controller.signal.aborted) {
              return;
            }

            aggregated = mergeUniqueById(aggregated, nextPage.pickupPoints);
            const nextSlice = aggregated.slice(0, MAX_PICKUP_POINTS);
            putCacheEntry(cacheRef.current, {
              key: requestedBoundsKey,
              bounds: requestedViewport.bounds,
              pickupPoints: nextSlice,
              total: nextPage.total,
              createdAt: Date.now(),
            });

            if (isActiveRequest()) {
              setState((current) => ({
                ...current,
                pickupPoints: nextSlice,
                totalInViewport: nextPage.total,
                isBackgroundLoading:
                  nextPage.hasMorePages &&
                  nextSlice.length < MAX_PICKUP_POINTS &&
                  loadedBackgroundPages + 1 < MAX_BACKGROUND_PAGES,
              }));
            }

            hasMorePages = nextPage.hasMorePages;
            page += 1;
            loadedBackgroundPages += 1;
          }

          if (isActiveRequest()) {
            setState((current) => ({
              ...current,
              isBackgroundLoading: false,
            }));
          }
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          if (isActiveRequest()) {
            setState((current) => ({
              status: "error",
              pickupPoints: current.pickupPoints,
              errorMessage: mapErrorMessage(error),
              totalInViewport: current.totalInViewport,
              isBackgroundLoading: false,
            }));
          }
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [reloadCounter, requestedBoundsKey, requestedViewport, viewport]);

  return {
    ...state,
    reload,
  };
};
