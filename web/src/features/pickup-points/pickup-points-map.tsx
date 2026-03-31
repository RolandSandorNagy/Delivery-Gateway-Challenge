import { useEffect, useMemo, useState } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { PickupPoint, PickupPointViewport } from "./model";
import { clusterPickupPoints } from "./pickup-points-clustering";

type PickupPointsMapProps = {
  pickupPoints: PickupPoint[];
  selectedPickupPointId: string | null;
  onOpenPickupPoint: (pickupPointId: string) => void;
  onViewportChange: (viewport: PickupPointViewport) => void;
  isViewportLoading: boolean;
  isBackgroundLoading: boolean;
  loadedCount: number;
  totalInViewport: number | null;
  focusLocation: {
    requestId: number;
    latitude: number;
    longitude: number;
    label: string;
  } | null;
};

type ClusteredMarkersLayerProps = Pick<
  PickupPointsMapProps,
  "pickupPoints" | "selectedPickupPointId" | "onOpenPickupPoint" | "onViewportChange"
>;

const DEFAULT_CENTER: [number, number] = [47.4979, 19.0402];
const DEFAULT_ZOOM = 12;

const readViewport = (map: L.Map): PickupPointViewport => {
  const bounds = map.getBounds();

  return {
    zoom: map.getZoom(),
    bounds: {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    },
  };
};

const createClusterIcon = (count: number): L.DivIcon => {
  const sizeClass = count < 10 ? "cluster-marker-sm" : count < 100 ? "cluster-marker-md" : "cluster-marker-lg";

  return L.divIcon({
    html: `<span>${count}</span>`,
    className: `cluster-marker ${sizeClass}`,
    iconSize: [40, 40],
  });
};

const createPickupPointIcon = (isSelected: boolean): L.DivIcon =>
  L.divIcon({
    html: "",
    className: `pickup-point-marker${isSelected ? " pickup-point-marker-selected" : ""}`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const FocusMapToLocation = ({
  focusLocation,
}: {
  focusLocation: PickupPointsMapProps["focusLocation"];
}) => {
  const map = useMap();

  useEffect(() => {
    if (!focusLocation) {
      return;
    }

    map.flyTo([focusLocation.latitude, focusLocation.longitude], 14, { duration: 0.4 });
  }, [focusLocation, map]);

  return null;
};

const ClusteredMarkersLayer = ({
  pickupPoints,
  selectedPickupPointId,
  onOpenPickupPoint,
  onViewportChange,
}: ClusteredMarkersLayerProps) => {
  const map = useMap();
  const [viewport, setViewport] = useState<PickupPointViewport>(() => readViewport(map));

  useEffect(() => {
    const onMapMoveOrZoom = (): void => {
      const nextViewport = readViewport(map);
      setViewport(nextViewport);
      onViewportChange(nextViewport);
    };

    map.on("moveend", onMapMoveOrZoom);
    map.on("zoomend", onMapMoveOrZoom);
    onMapMoveOrZoom();

    return () => {
      map.off("moveend", onMapMoveOrZoom);
      map.off("zoomend", onMapMoveOrZoom);
    };
  }, [map, onViewportChange]);

  const clusteredItems = useMemo(
    () => clusterPickupPoints(pickupPoints, viewport),
    [pickupPoints, viewport],
  );

  return (
    <>
      {clusteredItems.map((item) => {
        if (item.kind === "cluster") {
          return (
            <Marker
              key={`cluster-${item.id}`}
              icon={createClusterIcon(item.count)}
              position={[item.latitude, item.longitude]}
            >
              <Popup>{item.count} pickup points in this area</Popup>
            </Marker>
          );
        }

        const point = item.point;
        const isSelected = selectedPickupPointId === point.id;
        return (
          <Marker
            key={point.id}
            icon={createPickupPointIcon(isSelected)}
            position={[point.latitude, point.longitude]}
            eventHandlers={{
              click: () => onOpenPickupPoint(point.id),
            }}
          >
            <Popup>
              <strong>{point.name}</strong>
              <br />
              {point.address}
              <br />
              Type: {point.type}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export const PickupPointsMap = ({
  pickupPoints,
  selectedPickupPointId,
  onOpenPickupPoint,
  onViewportChange,
  isViewportLoading,
  isBackgroundLoading,
  loadedCount,
  totalInViewport,
  focusLocation,
}: PickupPointsMapProps) => {
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  return (
    <section className="map-card">
      <div className="map-frame">
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="pickup-points-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{
              tileerror: () => {
                setMapLoadError("Map tiles could not be loaded. Please check your connection and try again.");
              },
              load: () => {
                setMapLoadError(null);
              },
            }}
          />
          <FocusMapToLocation focusLocation={focusLocation} />
          <ClusteredMarkersLayer
            pickupPoints={pickupPoints}
            selectedPickupPointId={selectedPickupPointId}
            onOpenPickupPoint={onOpenPickupPoint}
            onViewportChange={onViewportChange}
          />
        </MapContainer>
        {isViewportLoading ? (
          <div className="map-loading-overlay" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <p>
              {pickupPoints.length === 0
                ? "Loading pickup points for this map area..."
                : "Updating map results for new viewport..."}
            </p>
          </div>
        ) : null}
        {isBackgroundLoading ? (
          <div className="map-background-badge" role="status" aria-live="polite">
            <span className="mini-spinner" aria-hidden="true" />
            Updating results: {loadedCount}
            {totalInViewport ? ` / ${totalInViewport}` : ""}
          </div>
        ) : null}
      </div>
      <p className="map-note">Viewport-based fetch + clustering is active.</p>
      {mapLoadError ? <p className="error-text">{mapLoadError}</p> : null}
    </section>
  );
};
