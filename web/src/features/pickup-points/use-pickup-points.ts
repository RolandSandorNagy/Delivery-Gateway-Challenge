import { useCallback, useEffect, useState } from "react";
import { GraphQlHttpError, GraphQlResponseError } from "../../lib/graphql-client";
import type { PickupPoint } from "./model";
import { fetchPickupPoints } from "./pickup-points.api";

type PickupPointsStatus = "loading" | "success" | "error";

type PickupPointsState = {
  status: PickupPointsStatus;
  pickupPoints: PickupPoint[];
  errorMessage: string | null;
};

export type UsePickupPointsResult = PickupPointsState & {
  reload: () => void;
};

const mapErrorMessage = (error: unknown): string => {
  if (error instanceof GraphQlHttpError) {
    return `Network request failed with HTTP ${error.status}.`;
  }

  if (error instanceof GraphQlResponseError) {
    const firstMessage = error.details[0]?.message;
    return firstMessage ? `GraphQL error: ${firstMessage}` : "GraphQL response returned an unknown error.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error happened while loading pickup points.";
};

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

export const usePickupPoints = (): UsePickupPointsResult => {
  const [reloadCounter, setReloadCounter] = useState(0);
  const [state, setState] = useState<PickupPointsState>({
    status: "loading",
    pickupPoints: [],
    errorMessage: null,
  });

  const reload = useCallback(() => {
    setReloadCounter((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setState((current) => ({
      ...current,
      status: "loading",
      errorMessage: null,
    }));

    fetchPickupPoints({ signal: controller.signal })
      .then((pickupPoints) => {
        setState({
          status: "success",
          pickupPoints,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setState((current) => ({
          status: "error",
          pickupPoints: current.pickupPoints,
          errorMessage: mapErrorMessage(error),
        }));
      });

    return () => {
      controller.abort();
    };
  }, [reloadCounter]);

  return {
    ...state,
    reload,
  };
};

