import type {
  IncidentSeverity,
  IncidentStatus,
  OperationalStatus,
} from "./types";

export const incidentStatuses: IncidentStatus[] = [
  "new",
  "acknowledged",
  "in_progress",
  "resolved",
  "closed",
];

export const incidentSeverities: IncidentSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export const statusLabel: Record<IncidentStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const severityLabel: Record<IncidentSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const operationalStatusLabel: Record<OperationalStatus, string> = {
  normal: "Normal",
  degraded: "Degraded",
  offline: "Offline",
};

export const severityClass: Record<IncidentSeverity, string> = {
  critical: "bg-red-500/15 text-red-200 border-red-400/30",
  high: "bg-orange-500/15 text-orange-200 border-orange-400/30",
  medium: "bg-amber-500/15 text-amber-100 border-amber-300/30",
  low: "bg-sky-500/15 text-sky-100 border-sky-300/30",
};

export const statusClass: Record<IncidentStatus, string> = {
  new: "bg-cyan-500/15 text-cyan-100 border-cyan-300/30",
  acknowledged: "bg-blue-500/15 text-blue-100 border-blue-300/30",
  in_progress: "bg-amber-500/15 text-amber-100 border-amber-300/30",
  resolved: "bg-emerald-500/15 text-emerald-100 border-emerald-300/30",
  closed: "bg-slate-500/15 text-slate-300 border-slate-300/20",
};
