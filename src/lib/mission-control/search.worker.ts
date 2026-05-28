import type {
  Incident,
  IncidentFilters,
  StationWithIncidents,
} from "./types";

// Helper function to escape regex characters safely
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

self.onmessage = (event: MessageEvent<{
  stations: StationWithIncidents[];
  incidents: Incident[];
  filters: IncidentFilters;
}>) => {
  const { stations, incidents, filters } = event.data;

  try {
    const queryStr = filters.query?.trim() || "";
    const regex = queryStr ? new RegExp(escapeRegExp(queryStr), "i") : null;
    const filterStatuses = filters.status || [];
    const filterSeverities = filters.severity || [];
    const filterStationId = filters.stationId || "";

    // 1. Filter incidents
    const filteredIncidents = incidents.filter((incident) => {
      // Station ID Filter
      if (filterStationId && incident.stationId !== filterStationId) {
        return false;
      }

      // Status Filter
      if (filterStatuses.length > 0 && !filterStatuses.includes(incident.status)) {
        return false;
      }

      // Severity Filter
      if (filterSeverities.length > 0 && !filterSeverities.includes(incident.severity)) {
        return false;
      }

      // Query Regex Match (title, description)
      if (regex) {
        const matchesTitle = incident.title ? regex.test(incident.title) : false;
        const matchesDesc = incident.description ? regex.test(incident.description) : false;
        if (!matchesTitle && !matchesDesc) {
          return false;
        }
      }

      return true;
    });

    // Create a set of matching incident station IDs for fast lookup
    const matchingIncidentStationIds = new Set(filteredIncidents.map((inc) => inc.stationId));

    // 2. Filter stations and calculate geometric/coordinate bounds
    const filteredStations = stations.filter((station) => {
      // Station ID Filter
      if (filterStationId && station.id !== filterStationId) {
        return false;
      }

      // If query is specified, check if the station itself matches OR has matching incidents
      if (regex) {
        const matchesName = station.name ? regex.test(station.name) : false;
        const matchesCode = station.code ? regex.test(station.code) : false;
        const matchesProvince = station.province ? regex.test(station.province) : false;
        const hasMatchingIncidents = matchingIncidentStationIds.has(station.id);

        if (!matchesName && !matchesCode && !matchesProvince && !hasMatchingIncidents) {
          return false;
        }
      }

      return true;
    });

    // 3. Expensive geometric calculation: calculate verified coordinate bounds and centroids
    const verifiedCoordinates = filteredStations
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => [s.latitude as number, s.longitude as number]);

    self.postMessage({
      filteredStations,
      filteredIncidents,
      verifiedCoordinates,
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};
