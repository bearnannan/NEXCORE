import { describe, expect, it } from "vitest";
import {
  applyIncidentFilters,
  getHighestActiveSeverity,
  hasVerifiedCoordinates,
} from "./selectors";
import type { Incident, Station } from "./types";

const incidents: Incident[] = [
  {
    id: "inc-1",
    stationId: "station-1",
    title: "Critical telemetry outage",
    status: "new",
    severity: "critical",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
  {
    id: "inc-2",
    stationId: "station-2",
    title: "Resolved alarm",
    status: "resolved",
    severity: "medium",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
];

describe("mission-control helpers", () => {
  it("filters incidents by status and severity", () => {
    expect(
      applyIncidentFilters(incidents, {
        status: ["new"],
        severity: ["critical"],
      }),
    ).toEqual([incidents[0]]);
  });

  it("ignores resolved incidents when deriving active station severity", () => {
    expect(getHighestActiveSeverity(incidents)).toBe("critical");
    expect(getHighestActiveSeverity([incidents[1]])).toBeNull();
  });

  it("detects missing or invalid station coordinates", () => {
    const valid: Station = {
      id: "station-1",
      code: "ST-1",
      name: "Valid Station",
      latitude: 13.7,
      longitude: 100.5,
      operationalStatus: "normal",
    };
    const invalid: Station = { ...valid, latitude: null };

    expect(hasVerifiedCoordinates(valid)).toBe(true);
    expect(hasVerifiedCoordinates(invalid)).toBe(false);
  });
});

import {
  fromDatabaseRepairStatus,
  isStatusTransitionError,
  isValidTransition,
  toDatabaseRepairStatus,
} from "./state-machine";
import { updateIncidentStatus } from "./mock-store";

describe("incident state machine transitions", () => {
  it("allows valid transitions", () => {
    expect(isValidTransition("new", "acknowledged")).toBe(true);
    expect(isValidTransition("acknowledged", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "resolved")).toBe(true);
    expect(isValidTransition("resolved", "closed")).toBe(true);
    expect(isValidTransition("resolved", "acknowledged")).toBe(true); // Reopen
    expect(isValidTransition("closed", "acknowledged")).toBe(true); // Reopen
    expect(isValidTransition("new", "new")).toBe(true); // Same status is fine
  });

  it("denies invalid transitions", () => {
    expect(isValidTransition("new", "resolved")).toBe(false);
    expect(isValidTransition("new", "closed")).toBe(false);
    expect(isValidTransition("new", "in_progress")).toBe(false);
    expect(isValidTransition("acknowledged", "resolved")).toBe(false);
    expect(isValidTransition("in_progress", "closed")).toBe(false);
    expect(isValidTransition("closed", "resolved")).toBe(false);
    expect(isValidTransition("closed", "new")).toBe(false);
  });

  it("updates status when transition is valid", () => {
    // inc-2403 is "new" in seed data
    const updated = updateIncidentStatus("inc-2403", "acknowledged");
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("acknowledged");
  });

  it("throws error when transition is invalid", () => {
    // inc-2403 is now "acknowledged", so transitioning to "resolved" directly is invalid
    expect(() => updateIncidentStatus("inc-2403", "resolved")).toThrow(
      "Invalid status transition: Cannot transition from 'acknowledged' to 'resolved'"
    );
  });

  it("preserves strict workflow states when mapping database repair status", () => {
    expect(fromDatabaseRepairStatus("new")).toBe("new");
    expect(fromDatabaseRepairStatus("acknowledged")).toBe("acknowledged");
    expect(fromDatabaseRepairStatus("in_progress")).toBe("in_progress");
    expect(fromDatabaseRepairStatus("resolved")).toBe("resolved");
    expect(fromDatabaseRepairStatus("closed")).toBe("closed");
    expect(fromDatabaseRepairStatus("กำลังดำเนินการ")).toBe("in_progress");
    expect(fromDatabaseRepairStatus("เสร็จสิ้น")).toBe("resolved");
    expect(toDatabaseRepairStatus("closed")).toBe("closed");
  });

  it("classifies only state-machine violations as transition errors", () => {
    expect(
      isStatusTransitionError(
        new Error("Invalid status transition: Cannot transition from 'new' to 'closed'"),
      ),
    ).toBe(true);
    expect(
      isStatusTransitionError(
        new Error("Supabase incident query failed: Invalid API key"),
      ),
    ).toBe(false);
  });
});
