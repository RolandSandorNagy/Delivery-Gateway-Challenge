import type { PickupPoint, PickupPointViewport } from "./model";

export type ClusteredPickupPoint =
  | {
      kind: "point";
      point: PickupPoint;
    }
  | {
      kind: "cluster";
      id: string;
      latitude: number;
      longitude: number;
      count: number;
    };

type ClusterBucket = {
  count: number;
  sumLatitude: number;
  sumLongitude: number;
  firstPoint: PickupPoint;
};

const DEFAULT_CELL_SIZE_PX = 60;

const projectToPixel = (
  latitude: number,
  longitude: number,
  zoom: number,
): { x: number; y: number } => {
  const scale = 256 * 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale;

  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale;

  return { x, y };
};

const isLongitudeInBounds = (longitude: number, west: number, east: number): boolean => {
  if (west <= east) {
    return longitude >= west && longitude <= east;
  }

  // Antimeridian crossing.
  return longitude >= west || longitude <= east;
};

const isPickupPointInViewport = (pickupPoint: PickupPoint, viewport: PickupPointViewport): boolean => {
  if (pickupPoint.latitude < viewport.bounds.south || pickupPoint.latitude > viewport.bounds.north) {
    return false;
  }

  return isLongitudeInBounds(
    pickupPoint.longitude,
    viewport.bounds.west,
    viewport.bounds.east,
  );
};

export const clusterPickupPoints = (
  pickupPoints: PickupPoint[],
  viewport: PickupPointViewport,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
): ClusteredPickupPoint[] => {
  const buckets = new Map<string, ClusterBucket>();

  for (const pickupPoint of pickupPoints) {
    if (!isPickupPointInViewport(pickupPoint, viewport)) {
      continue;
    }

    const pixel = projectToPixel(pickupPoint.latitude, pickupPoint.longitude, viewport.zoom);
    const gridX = Math.floor(pixel.x / cellSizePx);
    const gridY = Math.floor(pixel.y / cellSizePx);
    const bucketKey = `${gridX}:${gridY}`;

    const existingBucket = buckets.get(bucketKey);
    if (existingBucket) {
      existingBucket.count += 1;
      existingBucket.sumLatitude += pickupPoint.latitude;
      existingBucket.sumLongitude += pickupPoint.longitude;
      continue;
    }

    buckets.set(bucketKey, {
      count: 1,
      sumLatitude: pickupPoint.latitude,
      sumLongitude: pickupPoint.longitude,
      firstPoint: pickupPoint,
    });
  }

  const clusteredPoints: ClusteredPickupPoint[] = [];
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.count === 1) {
      clusteredPoints.push({
        kind: "point",
        point: bucket.firstPoint,
      });
      continue;
    }

    clusteredPoints.push({
      kind: "cluster",
      id: bucketKey,
      latitude: bucket.sumLatitude / bucket.count,
      longitude: bucket.sumLongitude / bucket.count,
      count: bucket.count,
    });
  }

  return clusteredPoints;
};
