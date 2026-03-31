import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { geocodeLocation } from "./features/location/geocoding.api";
import { PickupPointInfoPanel } from "./features/pickup-points/pickup-point-info-panel";
import { PickupPointsMap } from "./features/pickup-points/pickup-points-map";
import type { PickupPointViewport } from "./features/pickup-points/model";
import { fetchPickupPointOpeningHours } from "./features/pickup-points/pickup-points.api";
import { usePickupPoints } from "./features/pickup-points/use-pickup-points";

type SearchStatus = "idle" | "loading" | "success" | "error";

function App() {
  const [mapViewport, setMapViewport] = useState<PickupPointViewport | null>(null);
  const { status, pickupPoints, errorMessage, reload, totalInViewport, isBackgroundLoading } =
    usePickupPoints(mapViewport);
  const [activePickupPointId, setActivePickupPointId] = useState<string | null>(null);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
  const [openingHoursByPickupPointId, setOpeningHoursByPickupPointId] = useState<Record<string, string | null>>({});
  const [openingHoursLoadingByPickupPointId, setOpeningHoursLoadingByPickupPointId] = useState<
    Record<string, boolean>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<{
    requestId: number;
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const searchRequestCounter = useRef(0);
  const activeSearchController = useRef<AbortController | null>(null);
  const pickupPointById = useMemo(
    () => new Map(pickupPoints.map((pickupPoint) => [pickupPoint.id, pickupPoint])),
    [pickupPoints],
  );

  useEffect(() => {
    return () => {
      activeSearchController.current?.abort();
    };
  }, []);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setSearchStatus("error");
      setSearchErrorMessage("Please enter a city or address.");
      return;
    }

    activeSearchController.current?.abort();
    const controller = new AbortController();
    activeSearchController.current = controller;
    setSearchStatus("loading");
    setSearchErrorMessage(null);

    try {
      const result = await geocodeLocation(normalizedQuery, { signal: controller.signal });
      if (!result) {
        setSearchStatus("error");
        setSearchErrorMessage("No location found for the given query.");
        return;
      }

      searchRequestCounter.current += 1;
      setFocusLocation({
        requestId: searchRequestCounter.current,
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
      });
      setSearchStatus("success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setSearchStatus("error");
      setSearchErrorMessage(error instanceof Error ? error.message : "Location search failed.");
    }
  };

  const activePickupPoint =
    activePickupPointId === null
      ? null
      : (() => {
          const point = pickupPointById.get(activePickupPointId) ?? null;
          if (!point) {
            return null;
          }

          const overriddenOpeningHours = openingHoursByPickupPointId[point.id];
          return overriddenOpeningHours === undefined
            ? point
            : { ...point, openingHours: overriddenOpeningHours };
        })();
  const selectedPickupPoint =
    selectedPickupPointId === null
      ? null
      : (() => {
          const point = pickupPointById.get(selectedPickupPointId) ?? null;
          if (!point) {
            return null;
          }

          const overriddenOpeningHours = openingHoursByPickupPointId[point.id];
          return overriddenOpeningHours === undefined
            ? point
            : { ...point, openingHours: overriddenOpeningHours };
        })();
  const isInitialMapLoading = status === "loading" && pickupPoints.length === 0;
  const isViewportRefreshing = status === "loading" && pickupPoints.length > 0;

  useEffect(() => {
    if (activePickupPointId && !pickupPointById.has(activePickupPointId)) {
      setActivePickupPointId(null);
    }

    if (selectedPickupPointId && !pickupPointById.has(selectedPickupPointId)) {
      setSelectedPickupPointId(null);
    }
  }, [activePickupPointId, pickupPointById, selectedPickupPointId]);

  useEffect(() => {
    if (!activePickupPoint || activePickupPoint.openingHours !== null) {
      return;
    }

    if (openingHoursByPickupPointId[activePickupPoint.id] !== undefined) {
      return;
    }

    const controller = new AbortController();
    setOpeningHoursLoadingByPickupPointId((current) => ({
      ...current,
      [activePickupPoint.id]: true,
    }));
    fetchPickupPointOpeningHours(activePickupPoint.id, controller.signal)
      .then((openingHours) => {
        setOpeningHoursByPickupPointId((current) => ({
          ...current,
          [activePickupPoint.id]: openingHours,
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      })
      .finally(() => {
        setOpeningHoursLoadingByPickupPointId((current) => ({
          ...current,
          [activePickupPoint.id]: false,
        }));
      });

    return () => {
      controller.abort();
    };
  }, [activePickupPoint, openingHoursByPickupPointId]);

  return (
    <main className="app-shell">
      <h1>Delivery Gateway Challenge</h1>
      <section className="search-card">
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <label htmlFor="location-query">Find city or address</label>
          <div className="search-row">
            <input
              id="location-query"
              type="text"
              placeholder="e.g. Budapest, Vaci utca 1"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit" disabled={searchStatus === "loading"}>
              {searchStatus === "loading" ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
        {searchStatus === "error" ? <p className="error-text">{searchErrorMessage}</p> : null}
        {searchStatus === "success" && focusLocation ? (
          <p className="success-text">Jumped to: {focusLocation.label}</p>
        ) : null}
      </section>
      <section className="status-card">
        {mapViewport === null ? <p>Waiting for map viewport...</p> : null}
        <p>
          <strong>Status:</strong> {status}
        </p>
        {status === "loading" ? <p>Loading pickup points...</p> : null}
        {status === "error" ? (
          <>
            <p className="error-text">{errorMessage}</p>
            <button type="button" onClick={reload}>
              Retry
            </button>
          </>
        ) : null}
        {status === "success" ? (
          <>
            <p>Loaded pickup points: {pickupPoints.length}</p>
            <p>Total in viewport (API): {totalInViewport ?? "-"}</p>
            <p>Focused pickup point ID: {activePickupPointId ?? "-"}</p>
            <p>Selected pickup point ID: {selectedPickupPointId ?? "-"}</p>
            {isViewportRefreshing ? <p>Refreshing viewport results...</p> : null}
            {isBackgroundLoading ? <p>Loading more points in background...</p> : null}
            {selectedPickupPoint ? (
              <p>
                Selected pickup point: {selectedPickupPoint.name} ({selectedPickupPoint.address || "N/A"})
              </p>
            ) : null}
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </>
        ) : null}
      </section>

      <PickupPointsMap
        pickupPoints={pickupPoints}
        selectedPickupPointId={selectedPickupPointId}
        onOpenPickupPoint={setActivePickupPointId}
        onViewportChange={setMapViewport}
        isInitialLoading={isInitialMapLoading}
        isBackgroundLoading={isBackgroundLoading || isViewportRefreshing}
        loadedCount={pickupPoints.length}
        totalInViewport={totalInViewport}
        focusLocation={focusLocation}
      />
      <PickupPointInfoPanel
        activePickupPoint={activePickupPoint}
        selectedPickupPointId={selectedPickupPointId}
        isOpeningHoursLoading={activePickupPoint ? openingHoursLoadingByPickupPointId[activePickupPoint.id] === true : false}
        onSelectPickupPoint={setSelectedPickupPointId}
      />
    </main>
  );
}

export default App;
