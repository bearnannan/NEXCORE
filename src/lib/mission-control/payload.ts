import { DEFAULT_REPAIR_STATUS, normalizePriority } from "./config";
import { normalizePriorityForEquipment } from "./sla";
import type { IncidentAssetType, NotificationPayload } from "./types";

const FIELD = {
  reportedAt: "วันที่และเวลาแจ้งเหตุ",
  station: "สถานี",
  reporter: "ผู้แจ้งเหตุ",
  issueDescription: "อาการเสีย",
  assignee: "ผู้เข้าดำเนินการ",
  repairStatus: "สถานะการแก้ไข",
  reporterPhone: "เบอร์โทรผู้แจ้งเหตุ",
  phone: "เบอร์โทร",
  incidentNo: "หมายเลขแจ้งเสีย",
} as const;

function pickText(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickNumber(record: Record<string, unknown>, ...keys: string[]) {
  const text = pickText(record, ...keys);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAssetType(value: string): IncidentAssetType | undefined {
  if (value === "station" || value === "client") return value;
  return undefined;
}

export function incidentRecordToPayload(record: Record<string, unknown>): NotificationPayload {
  const equipmentType = pickText(record, "equipmentType", "equipment_type", "equipment", "ประเภทอุปกรณ์");

  return {
    [FIELD.reportedAt]:
      pickText(record, FIELD.reportedAt, "reportedAt", "reported_at", "createdAt", "created_at") ||
      new Date().toISOString(),
    [FIELD.station]: pickText(record, FIELD.station, "station", "asset_name") || "ไม่ระบุสถานี",
    [FIELD.reporter]: pickText(record, FIELD.reporter, "reporter") || "ไม่ระบุผู้แจ้งเหตุ",
    [FIELD.issueDescription]:
      pickText(record, FIELD.issueDescription, "issueDescription", "issue_description", "description") ||
      "ไม่ระบุอาการเสีย",
    [FIELD.assignee]: pickText(record, FIELD.assignee, "assignee") || "รอดำเนินการ",
    [FIELD.repairStatus]:
      pickText(record, FIELD.repairStatus, "repairStatus", "repair_status", "status") ||
      DEFAULT_REPAIR_STATUS,
    [FIELD.reporterPhone]: pickText(record, FIELD.reporterPhone, "reporterPhone", "reporter_phone"),
    [FIELD.phone]: pickText(record, FIELD.phone, "phone"),
    [FIELD.incidentNo]: pickText(record, FIELD.incidentNo, "incidentNo", "incident_no") || "NEW",
    priority: normalizePriorityForEquipment(equipmentType, normalizePriority(pickText(record, "priority", "severity"))),
    equipmentType,
    assetId: pickText(record, "assetId", "asset_id") || undefined,
    assetType: normalizeAssetType(pickText(record, "assetType", "asset_type")),
    assetName: pickText(record, "assetName", "asset_name") || undefined,
    province: pickText(record, "province") || undefined,
    district: pickText(record, "district") || undefined,
    lat: pickNumber(record, "lat", "latitude"),
    lon: pickNumber(record, "lon", "longitude"),
  };
}
