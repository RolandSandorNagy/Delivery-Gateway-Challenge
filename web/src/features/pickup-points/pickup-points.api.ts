import { appEnv } from "../../config/env";
import { requestGraphQl } from "../../lib/graphql-client";
import type { PickupPoint, PickupPointViewport } from "./model";
import { PICKUP_POINT_DETAILS_QUERY, PICKUP_POINTS_QUERY } from "./pickup-points.query";

type PickupPointRow = {
  id: string;
  name: string;
  type: string;
  address?: {
    city?: string | null;
    postalCode?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
  } | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  openingHours?: Array<{
    day: string;
    start: {
      hour: number;
      minute: number;
    };
    end: {
      hour: number;
      minute: number;
    };
  }> | null;
};

type PickupPointsQueryData = {
  session?: {
    pickupPoint?: {
      pickupPoints?: {
        points?: {
          paginatorInfo?: {
            currentPage: number;
            hasMorePages: boolean;
            total: number;
            lastPage: number;
          } | null;
          data?: PickupPointRow[] | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type PickupPointDetailsQueryData = {
  session?: {
    pickupPoint?: {
      pickupPoint?: {
        id: string;
        openingHours?: PickupPointRow["openingHours"];
      } | null;
    } | null;
  } | null;
};

export type FetchPickupPointsPageOptions = {
  viewport: PickupPointViewport;
  page: number;
  first: number;
  signal?: AbortSignal;
};

export type FetchPickupPointsPageResult = {
  pickupPoints: PickupPoint[];
  page: number;
  hasMorePages: boolean;
  total: number;
};

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const dayShortLabel = (day: string): string => {
  const labels: Record<string, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  };
  return labels[day] ?? day;
};

const formatOpeningHours = (openingHours: PickupPointRow["openingHours"]): string | null => {
  if (!openingHours || openingHours.length === 0) {
    return null;
  }

  const formatted = openingHours.map((entry) => {
    const start = `${pad2(entry.start.hour)}:${pad2(entry.start.minute)}`;
    const end = `${pad2(entry.end.hour)}:${pad2(entry.end.minute)}`;
    return `${dayShortLabel(entry.day)} ${start}-${end}`;
  });

  return formatted.join(", ");
};

const formatAddress = (address: PickupPointRow["address"]): string => {
  if (!address) {
    return "";
  }

  const parts = [address.postalCode, address.city, address.addressLine1, address.addressLine2]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.join(", ");
};

const toDomainPickupPoint = (item: PickupPointRow): PickupPoint | null => {
  if (item.location?.latitude == null || item.location?.longitude == null) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    openingHours: formatOpeningHours(item.openingHours),
    address: formatAddress(item.address),
    latitude: item.location.latitude,
    longitude: item.location.longitude,
  };
};

const createFiltersFromViewport = (viewport: PickupPointViewport): Record<string, unknown> | undefined => {
  const hasAntimeridianCrossing = viewport.bounds.west > viewport.bounds.east;
  if (hasAntimeridianCrossing) {
    return undefined;
  }

  return {
    boundingBox: {
      southWest: {
        latitude: viewport.bounds.south,
        longitude: viewport.bounds.west,
      },
      northEast: {
        latitude: viewport.bounds.north,
        longitude: viewport.bounds.east,
      },
    },
  };
};

export const fetchPickupPointsPage = async ({
  viewport,
  page,
  first,
  signal,
}: FetchPickupPointsPageOptions): Promise<FetchPickupPointsPageResult> => {
  const data = await requestGraphQl<PickupPointsQueryData>({
    endpoint: appEnv.graphqlEndpoint,
    query: PICKUP_POINTS_QUERY,
    variables: {
      sessionId: appEnv.sessionId,
      first,
      page,
      filters: createFiltersFromViewport(viewport),
    },
    timeoutMs: appEnv.requestTimeoutMs,
    signal,
  });

  const pointsPayload = data.session?.pickupPoint?.pickupPoints?.points;
  const rows = pointsPayload?.data ?? [];
  const mapped = rows.map(toDomainPickupPoint).filter((item): item is PickupPoint => item !== null);

  return {
    pickupPoints: mapped,
    page,
    hasMorePages: pointsPayload?.paginatorInfo?.hasMorePages ?? false,
    total: pointsPayload?.paginatorInfo?.total ?? mapped.length,
  };
};

export const fetchPickupPointOpeningHours = async (
  pickupPointId: string,
  signal?: AbortSignal,
): Promise<string | null> => {
  const data = await requestGraphQl<PickupPointDetailsQueryData>({
    endpoint: appEnv.graphqlEndpoint,
    query: PICKUP_POINT_DETAILS_QUERY,
    variables: {
      sessionId: appEnv.sessionId,
      id: pickupPointId,
    },
    timeoutMs: appEnv.requestTimeoutMs,
    signal,
  });

  const openingHours = data.session?.pickupPoint?.pickupPoint?.openingHours ?? null;
  return formatOpeningHours(openingHours);
};

