export type GraphQlRequestOptions = {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
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

type GraphQlEnvelope<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

export const requestGraphQl = async <TData>({
  endpoint,
  query,
  variables,
  timeoutMs = 15_000,
}: GraphQlRequestOptions): Promise<TData> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
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
    window.clearTimeout(timeoutId);
  }
};

