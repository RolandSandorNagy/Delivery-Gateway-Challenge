import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphQlHttpError, GraphQlResponseError } from "../../lib/graphql-client";
import type { PickupPoint, PickupPointViewport } from "./model";
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

const viewportCacheKey = (viewport: PickupPointViewport): string =>
  [
    viewport.zoom,
    viewport.bounds.north.toFixed(2),
    viewport.bounds.south.toFixed(2),
    viewport.bounds.east.toFixed(2),
    viewport.bounds.west.toFixed(2),
  ].join("|");

export const usePickupPoints = (viewport: PickupPointViewport | null): UsePickupPointsResult => {
  const [reloadCounter, setReloadCounter] = useState(0);
  const [state, setState] = useState<PickupPointsState>({
    status: "loading",
    pickupPoints: [],
    errorMessage: null,
    totalInViewport: null,
    isBackgroundLoading: false,
  });

  const cacheRef = useRef<Map<string, PickupPoint[]>>(new Map());
  const activeRequestIdRef = useRef(0);
  const key = useMemo(() => (viewport ? viewportCacheKey(viewport) : null), [viewport]);

  const reload = useCallback(() => {
    if (key) {
      cacheRef.current.delete(key);
    }
    setReloadCounter((current) => current + 1);
  }, [key]);

  useEffect(() => {
    if (!viewport || !key) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const isActiveRequest = (): boolean => activeRequestIdRef.current === requestId;

    const cached = cacheRef.current.get(key);
    if (cached) {
      if (isActiveRequest()) {
        setState({
          status: "success",
          pickupPoints: cached,
          errorMessage: null,
          totalInViewport: cached.length,
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
        viewport,
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
          cacheRef.current.set(key, initialSlice);

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
              viewport,
              page,
              first: BACKGROUND_PAGE_SIZE,
              signal: controller.signal,
            });

            if (!isActiveRequest() || controller.signal.aborted) {
              return;
            }

            aggregated = mergeUniqueById(aggregated, nextPage.pickupPoints);
            const nextSlice = aggregated.slice(0, MAX_PICKUP_POINTS);
            cacheRef.current.set(key, nextSlice);

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
  }, [reloadCounter, viewport, key]);

  return {
    ...state,
    reload,
  };
};
