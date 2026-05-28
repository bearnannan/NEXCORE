import { getStatusColor } from "./config";
import { formatThaiDateTime, sanitizePhoneNumber } from "./format";
import { getEquipmentSlaRule } from "./sla";
import type { LineFlexMessage, NotificationPayload } from "./types";

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

function textNode(text: string, options: Record<string, unknown> = {}) {
  return {
    type: "text",
    text,
    wrap: true,
    size: "sm",
    color: "#E5E7EB",
    ...options,
  };
}

function dataRow(label: string, value: string, action?: Record<string, unknown>) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      textNode(label, { size: "xs", color: "#94A3B8", weight: "bold" }),
      textNode(value || "-", {
        color: "#F8FAFC",
        weight: "bold",
        action,
      }),
    ],
  };
}

function telAction(phone: string) {
  const clean = sanitizePhoneNumber(phone);
  if (!clean) return undefined;
  return {
    type: "uri",
    label: "Call",
    uri: `tel:${clean}`,
  };
}

export function createFlexMessage(payload: NotificationPayload): Record<string, unknown> {
  const status = payload[FIELD.repairStatus];
  const incidentNo = payload[FIELD.incidentNo];
  const statusColor = getStatusColor(status);
  const slaRule = getEquipmentSlaRule(payload.equipmentType);
  const slaText = slaRule
    ? `${slaRule.slaDurationHours < 24 ? `${slaRule.slaDurationHours} hours` : `${slaRule.slaDurationHours / 24} days`} / ${slaRule.penaltyRateBaht.toLocaleString("th-TH")} Baht per ${slaRule.penaltyUnit}`
    : "-";

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: statusColor,
      paddingAll: "16px",
      contents: [
        textNode("แจ้งเหตุซ่อมบำรุง", {
          size: "lg",
          weight: "bold",
          color: "#0a0a0f",
        }),
        textNode(incidentNo, {
          size: "sm",
          weight: "bold",
          color: "#0a0a0f",
        }),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0a0a0f",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          height: "2px",
          backgroundColor: statusColor,
          contents: [{ type: "spacer" }],
        },
        dataRow("วันที่และเวลาแจ้งเหตุ", formatThaiDateTime(payload[FIELD.reportedAt])),
        dataRow("สถานี", payload[FIELD.station]),
        dataRow("ผู้แจ้งเหตุ", payload[FIELD.reporter]),
        dataRow("อาการเสีย", payload[FIELD.issueDescription]),
        dataRow("ประเภทอุปกรณ์", payload.equipmentType || "-"),
        dataRow("SLA / Penalty", slaText),
        dataRow("ผู้เข้าดำเนินการ", payload[FIELD.assignee]),
        {
          type: "separator",
          color: "#1f1f2e",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: `${statusColor}1c`,
          borderColor: `${statusColor}55`,
          borderWidth: "1px",
          cornerRadius: "md",
          paddingAll: "12px",
          contents: [
            textNode("สถานะการแก้ไข", {
              size: "xs",
              color: "#94A3B8",
              weight: "bold",
            }),
            textNode(`●  ${status || "รอดำเนินการ"}`, {
              color: statusColor,
              weight: "bold",
              size: "sm",
            }),
          ],
        },
        dataRow("เบอร์โทรผู้แจ้งเหตุ", payload[FIELD.reporterPhone], telAction(payload[FIELD.reporterPhone])),
        dataRow("เบอร์โทร", payload[FIELD.phone], telAction(payload[FIELD.phone])),
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "md",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#0f766e",
          height: "sm",
          action: {
            type: "uri",
            label: "เปิด Mission Control",
            uri: `${process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000"}/mission-control`,
          },
        },
      ],
    },
  };
}

export function createLineFlexMessage(payload: NotificationPayload): LineFlexMessage {
  return {
    type: "flex",
    altText: `แจ้งเหตุ ${payload[FIELD.incidentNo]} - ${payload[FIELD.station]}`,
    contents: createFlexMessage(payload),
  };
}
