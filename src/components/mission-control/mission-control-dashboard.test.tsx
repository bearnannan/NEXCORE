import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MissionControlDashboard } from "./mission-control-dashboard";
import type { Incident, StationWithIncidents } from "@/lib/mission-control/types";
import { patchIncidentStatus } from "@/lib/mission-control/api";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Mock the Map component to prevent Leaflet execution during tests
vi.mock("./mission-control-map", () => ({
  MissionControlMap: () => <div data-testid="mock-map">Mock Map</div>,
}));

const mockStations: StationWithIncidents[] = [
  {
    id: "st-1",
    code: "BKK-01",
    name: "Bangkok Core",
    province: "Bangkok",
    latitude: 13.7,
    longitude: 100.5,
    operationalStatus: "normal",
    incidents: [],
  },
  {
    id: "st-unmapped",
    code: "UNM-01",
    name: "Unmapped Station",
    province: "Chiang Mai",
    latitude: null,
    longitude: null,
    operationalStatus: "degraded",
    incidents: [],
  },
];

const mockIncidents: Incident[] = [
  {
    id: "inc-1",
    stationId: "st-1",
    title: "Uplink Outage Alert",
    description: "Sustained loss on Metro uplink",
    status: "new",
    severity: "critical",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
];

vi.mock("@/lib/mission-control/api", () => ({
  getStations: vi.fn(() => Promise.resolve(mockStations)),
  getIncidents: vi.fn(() => Promise.resolve(mockIncidents)),
  patchIncidentStatus: vi.fn(() => Promise.resolve({
    id: "inc-1",
    stationId: "st-1",
    title: "Uplink Outage Alert",
    status: "acknowledged",
    severity: "critical",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  })),
}));

describe("MissionControlDashboard UI Component", () => {
  it("renders dashboard header and operator information", async () => {
    render(<MissionControlDashboard operatorName="Chaiwat Operator" />);

    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByText("Chaiwat Operator")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByTestId("mock-map")).toBeInTheDocument();
    });
  });

  it("renders live filters and supports text searching", async () => {
    render(<MissionControlDashboard operatorName="Chaiwat Operator" />);

    const searchInput = screen.getByPlaceholderText("Incident, station, province");
    expect(searchInput).toBeInTheDocument();
    
    fireEvent.change(searchInput, { target: { value: "Uplink" } });
    expect(searchInput).toHaveValue("Uplink");
  });
  it("renders incident queue rows correctly", async () => {
    render(<MissionControlDashboard operatorName="Chaiwat Operator" />);

    await waitFor(() => {
      expect(screen.getAllByText("Uplink Outage Alert").length).toBeGreaterThan(0);
      expect(screen.getAllByText("inc-1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("BKK-01").length).toBeGreaterThan(0);
    });
  });

  it("supports interaction for status transition control forms", async () => {
    render(<MissionControlDashboard operatorName="Chaiwat Operator" />);

    await waitFor(() => {
      expect(screen.getAllByText("Uplink Outage Alert").length).toBeGreaterThan(0);
    });

    const statusSelects = screen.getAllByRole("combobox");
    const queueStatusSelect = statusSelects[statusSelects.length - 1]; // Incident status in queue row

    fireEvent.change(queueStatusSelect, { target: { value: "acknowledged" } });

    await waitFor(() => {
      expect(patchIncidentStatus).toHaveBeenCalledWith("inc-1", "acknowledged");
    });
  });

  it("renders unmapped stations correctly and supports inspection", async () => {
    render(<MissionControlDashboard operatorName="Chaiwat Operator" />);

    await waitFor(() => {
      expect(screen.getByText("Unmapped Stations")).toBeInTheDocument();
      expect(screen.getByText("Unmapped Station")).toBeInTheDocument();
      expect(screen.getByText("UNM-01 (Chiang Mai)")).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByRole("button", { name: "Inspect" });
    fireEvent.click(inspectButtons[0]);

    // Inspect panel should focus the unmapped station details
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Unmapped Station" })).toBeInTheDocument();
    });
  });
});
