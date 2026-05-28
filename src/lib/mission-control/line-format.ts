import { formatThaiDateTime } from "./format";
import type { RepairStatus } from "./types";

export function formatThaiDate(dateString: string | Date): string {
  return formatThaiDateTime(dateString);
}

export function getStatusColor(status: RepairStatus): string {
  switch (status) {
    case "เสร็จสิ้น":
    case "resolved":
    case "closed":
      return "#00ff88";
    case "กำลังดำเนินการ":
    case "in_progress":
      return "#00f0ff";
    case "รอดำเนินการ":
    case "new":
    case "acknowledged":
      return "#f0e800";
    default:
      return "#f0e800";
  }
}

export function getStatusLabelTh(status: string): string {
  switch (status) {
    case "เสร็จสิ้น":
    case "resolved":
    case "closed":
      return "เสร็จสิ้น";
    case "กำลังดำเนินการ":
    case "in_progress":
      return "กำลังดำเนินการ";
    case "รอดำเนินการ":
    case "new":
    case "acknowledged":
      return "รอดำเนินการ";
    default:
      return status;
  }
}
