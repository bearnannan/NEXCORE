import type {
  Incident,
  IncidentFilters,
  IncidentStatus,
  StationWithIncidents,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const endpoint = typeof input === "string" ? input : input.toString();

  const response = await fetch(input, {
    ...init,
    signal: init?.signal ?? controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  }).catch((error: unknown) => {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Network request failed";

    throw new ApiRequestError(message, 0, endpoint);
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiRequestError(
      body?.error ?? `Request failed with ${response.status}`,
      response.status,
      endpoint,
    );
  }

  return response.json() as Promise<T>;
}

export function getStations(): Promise<StationWithIncidents[]> {
  return requestJson<StationWithIncidents[]>("/api/stations");
}

export function getIncidents(filters: IncidentFilters): Promise<Incident[]> {
  const params = new URLSearchParams();

  filters.status?.forEach((status) => params.append("status", status));
  filters.severity?.forEach((severity) => params.append("severity", severity));

  if (filters.stationId) {
    params.set("stationId", filters.stationId);
  }

  if (filters.query) {
    params.set("query", filters.query);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestJson<Incident[]>(`/api/incidents${suffix}`);
}

export function patchIncidentStatus(
  id: string,
  status: IncidentStatus,
): Promise<Incident> {
  return requestJson<Incident>(`/api/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
