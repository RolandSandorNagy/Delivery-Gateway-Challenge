export type GraphQlRequestOptions = {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class GraphQlHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GraphQlHttpError";
    this.status = status;
  }
}

export class GraphQlResponseError extends Error {
  readonly details: ReadonlyArray<{ message: string }>;

  constructor(message: string, details: ReadonlyArray<{ message: string }>) {
    super(message);
    this.name = "GraphQlResponseError";
    this.details = details;
  }
}

export class GraphQlTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`GraphQL request timed out after ${timeoutMs} ms`);
    this.name = "GraphQlTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

type GraphQlEnvelope<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export const requestGraphQl = async <TData>({
  endpoint,
  query,
  variables,
  timeoutMs = 15_000,
  signal,
}: GraphQlRequestOptions): Promise<TData> => {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternalSignal = (): void => {
    controller.abort();
  };

  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", abortFromExternalSignal);
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new GraphQlTimeoutError(timeoutMs);
      }
      throw error;
    }

    if (!response.ok) {
      throw new GraphQlHttpError(response.status, `GraphQL HTTP error: ${response.status}`);
    }

    const payload = (await response.json()) as GraphQlEnvelope<TData>;
    if (payload.errors && payload.errors.length > 0) {
      throw new GraphQlResponseError("GraphQL returned application errors", payload.errors);
    }

    if (!payload.data) {
      throw new GraphQlResponseError("GraphQL response has no data", []);
    }

    return payload.data;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortFromExternalSignal);
    }
    window.clearTimeout(timeoutId);
  }
};
