import type {
  Incident,
  IncidentFilters,
  IncidentSeverity,
  Station,
} from "./types";

export function applyIncidentFilters(
  incidents: Incident[],
  filters: IncidentFilters,
  stations: Station[] = [],
): Incident[] {
  const query = filters.query?.trim().toLowerCase();

  return incidents.filter((incident) => {
    if (filters.status?.length && !filters.status.includes(incident.status)) {
      return false;
    }

    if (
      filters.severity?.length &&
      !filters.severity.includes(incident.severity)
    ) {
      return false;
    }

    if (filters.stationId && incident.stationId !== filters.stationId) {
      return false;
    }

    if (!query) {
      return true;
    }

    const station = stations.find((item) => item.id === incident.stationId);
    const haystack = [
      incident.id,
      incident.title,
      incident.description,
      station?.code,
      station?.name,
      station?.province,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getHighestActiveSeverity(
  incidents: Incident[],
): IncidentSeverity | null {
  const rank: Record<IncidentSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return (
    incidents
      .filter((incident) => !["resolved", "closed"].includes(incident.status))
      .sort((a, b) => rank[b.severity] - rank[a.severity])[0]?.severity ?? null
  );
}

export function hasVerifiedCoordinates(station: Station): boolean {
  return (
    typeof station.latitude === "number" &&
    typeof station.longitude === "number" &&
    Math.abs(station.latitude) > 0.01 &&
    Math.abs(station.longitude) > 0.01
  );
}
