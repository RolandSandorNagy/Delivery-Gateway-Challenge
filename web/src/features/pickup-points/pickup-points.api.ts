import { appEnv } from "../../config/env";
import { requestGraphQl } from "../../lib/graphql-client";
import type { PickupPoint } from "./model";
import { PICKUP_POINTS_QUERY } from "./pickup-points.query";

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
          data?: Array<{
            id: string;
            name: string;
            type: string;
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
          }> | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

const PAGE_SIZE = 500;
// Keep initial load responsive. Map clustering handles large rendered sets,
// while backend pagination can be extended later for infinite/viewport loading.
const MAX_PICKUP_POINTS = 500;

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

const formatOpeningHours = (
  openingHours: NonNullable<
    NonNullable<
      NonNullable<
        NonNullable<NonNullable<PickupPointsQueryData["session"]>["pickupPoint"]>["pickupPoints"]
      >["points"]
    >["data"]
  >[number]["openingHours"],
): string | null => {
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

const formatAddress = (
  address: NonNullable<
    NonNullable<
      NonNullable<
        NonNullable<NonNullable<PickupPointsQueryData["session"]>["pickupPoint"]>["pickupPoints"]
      >["points"]
    >["data"]
  >[number]["address"],
): string => {
  if (!address) {
    return "";
  }

  const parts = [address.postalCode, address.city, address.addressLine1, address.addressLine2]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.join(", ");
};

const toDomainPickupPoint = (
  item: NonNullable<
    NonNullable<
      NonNullable<
        NonNullable<NonNullable<PickupPointsQueryData["session"]>["pickupPoint"]>["pickupPoints"]
      >["points"]
    >["data"]
  >[number],
): PickupPoint | null => {
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

type FetchPickupPointsOptions = {
  signal?: AbortSignal;
};

export const fetchPickupPoints = async ({ signal }: FetchPickupPointsOptions = {}): Promise<PickupPoint[]> => {
  const result: PickupPoint[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages && result.length < MAX_PICKUP_POINTS) {
    const data = await requestGraphQl<PickupPointsQueryData>({
      endpoint: appEnv.graphqlEndpoint,
      query: PICKUP_POINTS_QUERY,
      variables: {
        sessionId: appEnv.sessionId,
        first: PAGE_SIZE,
        page,
      },
      timeoutMs: appEnv.requestTimeoutMs,
      signal,
    });

    const pointsPayload = data.session?.pickupPoint?.pickupPoints?.points;
    if (!pointsPayload?.data) {
      break;
    }

    const mappedPoints = pointsPayload.data
      .map(toDomainPickupPoint)
      .filter((item): item is PickupPoint => item !== null);

    result.push(...mappedPoints);
    hasMorePages = pointsPayload.paginatorInfo?.hasMorePages ?? false;
    page += 1;
  }

  return result.slice(0, MAX_PICKUP_POINTS);
};
