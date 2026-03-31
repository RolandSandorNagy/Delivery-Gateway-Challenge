export type PickupPoint = {
  id: string;
  name: string;
  type: string;
  address: string;
  openingHours: string | null;
  latitude: number;
  longitude: number;
};

export type PickupPointSearchArea = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type PickupPointMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type PickupPointViewport = {
  zoom: number;
  bounds: PickupPointMapBounds;
};
