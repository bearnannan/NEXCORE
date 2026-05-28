import type { IncidentPriority } from "./types";

export type SlaPenaltyUnit = "hour" | "day";

export interface EquipmentSlaRule {
  equipmentType: string;
  slaDurationHours: number;
  penaltyRateBaht: number;
  penaltyUnit: SlaPenaltyUnit;
  allowedPriorities: IncidentPriority[];
  defaultPriority: IncidentPriority;
}

export const COMPLETED_STATUS = "เสร็จสิ้น";

export const EQUIPMENT_SLA_RULES: EquipmentSlaRule[] = [
  {
    equipmentType: "Base Station Control Center (BSSC) Capacity Expansion System",
    slaDurationHours: 3,
    penaltyRateBaht: 5000,
    penaltyUnit: "hour",
    allowedPriorities: ["critical"],
    defaultPriority: "critical",
  },
  {
    equipmentType: "Dispatcher Console",
    slaDurationHours: 3,
    penaltyRateBaht: 5000,
    penaltyUnit: "hour",
    allowedPriorities: ["critical"],
    defaultPriority: "critical",
  },
  {
    equipmentType: "SD-WAN Management System",
    slaDurationHours: 3,
    penaltyRateBaht: 5000,
    penaltyUnit: "hour",
    allowedPriorities: ["critical"],
    defaultPriority: "critical",
  },
  {
    equipmentType: "Super High Frequency (SHF) Repeater Kit",
    slaDurationHours: 72,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["high", "medium"],
    defaultPriority: "high",
  },
  {
    equipmentType: "Gateway Kit for Analog Connection",
    slaDurationHours: 72,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["high", "medium"],
    defaultPriority: "high",
  },
  {
    equipmentType: "1-Carrier Base Station (Outdoor)",
    slaDurationHours: 72,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["high", "medium"],
    defaultPriority: "high",
  },
  {
    equipmentType: "L3 Switch Distribution Equipment",
    slaDurationHours: 72,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["high", "medium"],
    defaultPriority: "high",
  },
  {
    equipmentType: "3 kVA Uninterruptible Power Supply (UPS)",
    slaDurationHours: 72,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["high", "medium"],
    defaultPriority: "high",
  },
  {
    equipmentType: "Handheld Subscriber Radio (Portable Radio)",
    slaDurationHours: 96,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["low"],
    defaultPriority: "low",
  },
  {
    equipmentType: "Fixed Subscriber Radio (Mobile/Desktop Radio)",
    slaDurationHours: 96,
    penaltyRateBaht: 10000,
    penaltyUnit: "day",
    allowedPriorities: ["low"],
    defaultPriority: "low",
  },
];

export function getEquipmentSlaRule(equipmentType?: string | null) {
  const normalized = equipmentType?.trim().toLowerCase();
  if (!normalized) return null;
  return EQUIPMENT_SLA_RULES.find((rule) => rule.equipmentType.toLowerCase() === normalized) || null;
}

export function getPriorityOptionsForEquipment(equipmentType?: string | null): IncidentPriority[] {
  return getEquipmentSlaRule(equipmentType)?.allowedPriorities || ["critical", "high", "medium", "low"];
}

export function normalizePriorityForEquipment(
  equipmentType?: string | null,
  priority?: string | null
): IncidentPriority {
  const rule = getEquipmentSlaRule(equipmentType);
  if (!rule) {
    if (
      priority === "critical" ||
      priority === "high" ||
      priority === "medium" ||
      priority === "low"
    ) {
      return priority;
    }
    return "medium";
  }

  return rule.allowedPriorities.includes(priority as IncidentPriority)
    ? (priority as IncidentPriority)
    : rule.defaultPriority;
}
