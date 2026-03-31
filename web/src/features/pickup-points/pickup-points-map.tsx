import { useEffect, useMemo } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { PickupPoint } from "./model";

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

type PickupPointsMapProps = {
  pickupPoints: PickupPoint[];
  selectedPickupPointId: string | null;
  onSelectPickupPoint: (pickupPointId: string) => void;
};

const DEFAULT_CENTER: [number, number] = [47.4979, 19.0402];
const DEFAULT_ZOOM = 12;
const MAX_RENDERED_MARKERS = 2000;

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

export const PickupPointsMap = ({
  pickupPoints,
  selectedPickupPointId,
  onSelectPickupPoint,
}: PickupPointsMapProps) => {
  const renderedPoints = useMemo(
    () => pickupPoints.slice(0, MAX_RENDERED_MARKERS),
    [pickupPoints],
  );

  return (
    <section className="map-card">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="pickup-points-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToPoints pickupPoints={renderedPoints} />
        {renderedPoints.map((point) => (
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
        ))}
      </MapContainer>

      {pickupPoints.length > MAX_RENDERED_MARKERS ? (
        <p className="map-note">
          Showing first {MAX_RENDERED_MARKERS} markers of {pickupPoints.length}. Clustering comes next.
        </p>
      ) : null}
    </section>
  );
};
