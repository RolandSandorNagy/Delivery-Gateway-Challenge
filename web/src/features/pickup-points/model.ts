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

