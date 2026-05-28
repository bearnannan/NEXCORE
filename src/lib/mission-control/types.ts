export type IncidentStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "closed";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type OperationalStatus = "normal" | "degraded" | "offline";

export type RepairStatus = "เสร็จสิ้น" | "รอดำเนินการ" | "กำลังดำเนินการ" | string;

export type IncidentPriority = IncidentSeverity;
export type IncidentAssetType = "station" | "client";

export interface NotificationPayload {
  "วันที่และเวลาแจ้งเหตุ": string;
  "สถานี": string;
  "ผู้แจ้งเหตุ": string;
  "อาการเสีย": string;
  "ผู้เข้าดำเนินการ": string;
  "สถานะการแก้ไข": RepairStatus;
  "เบอร์โทรผู้แจ้งเหตุ": string;
  "เบอร์โทร": string;
  "หมายเลขแจ้งเสีย": string;
  priority?: IncidentPriority;
  equipmentType?: string;
  assetId?: string;
  assetType?: IncidentAssetType;
  assetName?: string;
  province?: string;
  district?: string;
  lat?: number;
  lon?: number;
}

export interface LineFlexMessage {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
}

export interface LineApiResponse {
  status: "success" | "error";
  message: string;
  statusCode?: number;
}

export type Station = {
  id: string;
  code: string;
  name: string;
  province?: string;
  latitude: number | null;
  longitude: number | null;
  operationalStatus: OperationalStatus;
};

export type Incident = {
  id: string;
  stationId: string;
  title: string;
  description?: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  createdAt: string;
  updatedAt: string;
};

export type IncidentFilters = {
  status?: IncidentStatus[];
  severity?: IncidentSeverity[];
  stationId?: string;
  query?: string;
};

export type StationWithIncidents = Station & {
  incidents: Incident[];
};
