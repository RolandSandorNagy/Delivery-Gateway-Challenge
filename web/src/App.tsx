import { FormEvent, useEffect, useRef, useState } from "react";
import { geocodeLocation } from "./features/location/geocoding.api";
import { PickupPointsMap } from "./features/pickup-points/pickup-points-map";
import { usePickupPoints } from "./features/pickup-points/use-pickup-points";

type SearchStatus = "idle" | "loading" | "success" | "error";

function App() {
  const { status, pickupPoints, errorMessage, reload } = usePickupPoints();
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
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
            <p>Selected pickup point ID: {selectedPickupPointId ?? "-"}</p>
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </>
        ) : null}
      </section>

      <PickupPointsMap
        pickupPoints={pickupPoints}
        selectedPickupPointId={selectedPickupPointId}
        onSelectPickupPoint={setSelectedPickupPointId}
        focusLocation={focusLocation}
      />
    </main>
  );
}

export default App;
