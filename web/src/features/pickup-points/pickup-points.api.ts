import { appEnv } from "../../config/env";
import { requestGraphQl } from "../../lib/graphql-client";
import type { PickupPoint } from "./model";
import { PICKUP_POINTS_QUERY } from "./pickup-points.query";

type PickupPointsQueryData = {
  pickupPoints: Array<{
    id: string;
    name: string;
    type: string;
    openingHours?: string | null;
    address?: {
      formatted?: string | null;
    } | null;
    location?: {
      lat?: number | null;
      lng?: number | null;
    } | null;
  }>;
};

const toDomainPickupPoint = (item: PickupPointsQueryData["pickupPoints"][number]): PickupPoint | null => {
  if (item.location?.lat == null || item.location?.lng == null) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    openingHours: item.openingHours ?? null,
    address: item.address?.formatted ?? "",
    latitude: item.location.lat,
    longitude: item.location.lng,
  };
};

export const fetchPickupPoints = async (): Promise<PickupPoint[]> => {
  const data = await requestGraphQl<PickupPointsQueryData>({
    endpoint: appEnv.graphqlEndpoint,
    query: PICKUP_POINTS_QUERY,
    variables: {
      merchantId: appEnv.merchantId,
      sessionId: appEnv.sessionId,
    },
    timeoutMs: appEnv.requestTimeoutMs,
  });

  return data.pickupPoints.map(toDomainPickupPoint).filter((item): item is PickupPoint => item !== null);
};
