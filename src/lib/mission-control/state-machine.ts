import type { IncidentStatus } from "./types";

export const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  new: ["acknowledged"],
  acknowledged: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed", "acknowledged"], // acknowledged represents "Reopened"
  closed: ["acknowledged"], // acknowledged represents "Reopened"
};

/**
 * ตรวจสอบความถูกต้องของการเปลี่ยนสถานะของ Incident
 */
export function isValidTransition(current: IncidentStatus, next: IncidentStatus): boolean {
  if (current === next) {
    return true;
  }
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

/**
 * ดึงข้อความแจ้งเตือนข้อผิดพลาดเมื่อพยายามเปลี่ยนสถานะไม่ถูกต้อง
 */
export function getTransitionErrorMessage(current: IncidentStatus, next: IncidentStatus): string {
  if (next === "acknowledged" && (current === "resolved" || current === "closed")) {
    return `Cannot reopen incident from '${current}' unless transitioning to 'acknowledged'`;
  }
  return `Invalid status transition: Cannot transition from '${current}' to '${next}'`;
}

export function isStatusTransitionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Invalid status transition:") ||
    error.message.startsWith("Cannot reopen incident")
  );
}

export function fromDatabaseRepairStatus(status: unknown): IncidentStatus {
  if (status === "acknowledged") {
    return "acknowledged";
  }

  if (status === "in_progress" || status === "กำลังดำเนินการ") {
    return "in_progress";
  }

  if (status === "resolved" || status === "เสร็จสิ้น") {
    return "resolved";
  }

  if (status === "closed") {
    return "closed";
  }

  return "new";
}

export function toDatabaseRepairStatus(status: IncidentStatus): string {
  return status;
}
