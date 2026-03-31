import { useEffect, useMemo, useState } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { PickupPoint } from "./model";
import { clusterPickupPoints, type MapViewport } from "./pickup-points-clustering";

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

type PickupPointsMapProps = {
  pickupPoints: PickupPoint[];
  selectedPickupPointId: string | null;
  onSelectPickupPoint: (pickupPointId: string) => void;
  focusLocation: {
    requestId: number;
    latitude: number;
    longitude: number;
    label: string;
  } | null;
};

type ClusteredMarkersLayerProps = Pick<
  PickupPointsMapProps,
  "pickupPoints" | "selectedPickupPointId" | "onSelectPickupPoint"
>;

const DEFAULT_CENTER: [number, number] = [47.4979, 19.0402];
const DEFAULT_ZOOM = 12;

const readViewport = (map: L.Map): MapViewport => {
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

const FitMapToPoints = ({ pickupPoints }: { pickupPoints: PickupPoint[] }) => {
  const map = useMap();

  useEffect(() => {
    if (pickupPoints.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(
      pickupPoints.map((point) => [point.latitude, point.longitude] as [number, number]),
    );

    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [map, pickupPoints]);

  return null;
};

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
  onSelectPickupPoint,
}: ClusteredMarkersLayerProps) => {
  const map = useMap();
  const [viewport, setViewport] = useState<MapViewport>(() => readViewport(map));

  useEffect(() => {
    const onMapMoveOrZoom = (): void => {
      setViewport(readViewport(map));
    };

    map.on("moveend", onMapMoveOrZoom);
    map.on("zoomend", onMapMoveOrZoom);
    onMapMoveOrZoom();

    return () => {
      map.off("moveend", onMapMoveOrZoom);
      map.off("zoomend", onMapMoveOrZoom);
    };
  }, [map]);

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
              eventHandlers={{
                click: () => {
                  const nextZoom = Math.min(viewport.zoom + 2, 18);
                  map.flyTo([item.latitude, item.longitude], nextZoom, { duration: 0.3 });
                },
              }}
            >
              <Popup>{item.count} pickup points in this area</Popup>
            </Marker>
          );
        }

        const point = item.point;
        return (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            eventHandlers={{
              click: () => onSelectPickupPoint(point.id),
            }}
          >
            <Popup>
              <strong>{point.name}</strong>
              <br />
              {point.address}
              <br />
              Type: {point.type}
              <br />
              {selectedPickupPointId === point.id ? "Selected" : "Not selected"}
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
  onSelectPickupPoint,
  focusLocation,
}: PickupPointsMapProps) => {
  return (
    <section className="map-card">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="pickup-points-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToPoints pickupPoints={pickupPoints} />
        <FocusMapToLocation focusLocation={focusLocation} />
        <ClusteredMarkersLayer
          pickupPoints={pickupPoints}
          selectedPickupPointId={selectedPickupPointId}
          onSelectPickupPoint={onSelectPickupPoint}
        />
      </MapContainer>
      <p className="map-note">Viewport-based clustering is active for large datasets.</p>
    </section>
  );
};
