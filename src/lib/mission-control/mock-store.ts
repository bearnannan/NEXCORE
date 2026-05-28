import type {
  Incident,
  IncidentFilters,
  IncidentStatus,
  Station,
  StationWithIncidents,
} from "./types";
import { applyIncidentFilters } from "./selectors";

const stationsSeed: Station[] = [
  {
    id: "st-bkk-001",
    code: "BKK-01",
    name: "Bangkok Core Exchange",
    province: "Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
    operationalStatus: "degraded",
  },
  {
    id: "st-cnx-014",
    code: "CNX-14",
    name: "Chiang Mai North Station",
    province: "Chiang Mai",
    latitude: 18.7883,
    longitude: 98.9853,
    operationalStatus: "normal",
  },
  {
    id: "st-kkn-007",
    code: "KKN-07",
    name: "Khon Kaen Relay",
    province: "Khon Kaen",
    latitude: 16.4419,
    longitude: 102.835,
    operationalStatus: "offline",
  },
  {
    id: "st-hdy-021",
    code: "HDY-21",
    name: "Hat Yai Southern Station",
    province: "Songkhla",
    latitude: 7.0084,
    longitude: 100.4747,
    operationalStatus: "degraded",
  },
  {
    id: "st-pty-008",
    code: "PTY-08",
    name: "Pattaya Coastal Node",
    province: "Chonburi",
    latitude: 12.9236,
    longitude: 100.8825,
    operationalStatus: "normal",
  },
  {
    id: "st-ubn-012",
    code: "UBN-12",
    name: "Ubon East Station",
    province: "Ubon Ratchathani",
    latitude: 15.2287,
    longitude: 104.8564,
    operationalStatus: "normal",
  },
  {
    id: "st-npt-003",
    code: "NPT-03",
    name: "Nakhon Pathom Gateway",
    province: "Nakhon Pathom",
    latitude: null,
    longitude: null,
    operationalStatus: "degraded",
  },
];

const incidentsSeed: Incident[] = [
  {
    id: "inc-2401",
    stationId: "st-bkk-001",
    title: "Packet loss on metro uplink",
    description: "Sustained packet loss above threshold on the east metro path.",
    status: "in_progress",
    severity: "critical",
    createdAt: "2026-05-27T01:05:00.000Z",
    updatedAt: "2026-05-27T02:18:00.000Z",
  },
  {
    id: "inc-2402",
    stationId: "st-kkn-007",
    title: "Station telemetry offline",
    description: "No heartbeat from relay controller for three polling windows.",
    status: "acknowledged",
    severity: "high",
    createdAt: "2026-05-27T00:42:00.000Z",
    updatedAt: "2026-05-27T01:10:00.000Z",
  },
  {
    id: "inc-2403",
    stationId: "st-hdy-021",
    title: "Backup power warning",
    description: "UPS runtime dropped below the configured operational floor.",
    status: "new",
    severity: "medium",
    createdAt: "2026-05-27T01:46:00.000Z",
    updatedAt: "2026-05-27T01:46:00.000Z",
  },
  {
    id: "inc-2404",
    stationId: "st-npt-003",
    title: "Coordinate validation required",
    description: "Station has active work but no verified coordinates.",
    status: "new",
    severity: "low",
    createdAt: "2026-05-26T23:12:00.000Z",
    updatedAt: "2026-05-27T00:03:00.000Z",
  },
  {
    id: "inc-2405",
    stationId: "st-pty-008",
    title: "Resolved fiber impairment",
    description: "Field crew restored normal light levels on coastal segment.",
    status: "resolved",
    severity: "medium",
    createdAt: "2026-05-26T16:30:00.000Z",
    updatedAt: "2026-05-26T20:22:00.000Z",
  },
];

const mutableIncidents = [...incidentsSeed];

export function listStations(): Station[] {
  return stationsSeed;
}

export function listIncidents(filters: IncidentFilters = {}): Incident[] {
  return applyIncidentFilters(mutableIncidents, filters, stationsSeed);
}

export function listStationsWithIncidents(): StationWithIncidents[] {
  return stationsSeed.map((station) => ({
    ...station,
    incidents: mutableIncidents.filter(
      (incident) => incident.stationId === station.id,
    ),
  }));
}

import { isValidTransition, getTransitionErrorMessage } from "./state-machine";

export function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
): Incident | null {
  const incident = mutableIncidents.find((item) => item.id === id);

  if (!incident) {
    return null;
  }

  if (!isValidTransition(incident.status, status)) {
    throw new Error(getTransitionErrorMessage(incident.status, status));
  }

  incident.status = status;
  incident.updatedAt = new Date().toISOString();
  return incident;
}
