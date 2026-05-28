import type { IncidentFilters } from "./types";

export const missionControlKeys = {
  stations: ["mission-control", "stations"] as const,
  incidents: (filters: IncidentFilters) =>
    ["mission-control", "incidents", filters] as const,
};
