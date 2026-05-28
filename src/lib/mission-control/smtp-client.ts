import nodemailer from "nodemailer";
import { formatThaiDate, getStatusColor, getStatusLabelTh } from "./line-format";
import { getIncidentConfigAsync } from "./config";
import { recordNotificationAttempt } from "./notification-attempts";
import type { IncidentSeverity } from "./types";

// Convert severity to labels in Thai for email template
const severityLabelTh: Record<IncidentSeverity, string> = {
  critical: "วิกฤต (Critical)",
  high: "สูง (High)",
  medium: "ปานกลาง (Medium)",
  low: "ต่ำ (Low)",
};

const severityColor: Record<IncidentSeverity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#38bdf8",
};

// Generate high-fidelity Retro-Neon HTML Email Template
export function generateEmailHtmlTemplate(incident: Record<string, unknown>, failureReason = ""): string {
  const statusTh = getStatusLabelTh(incident.repair_status as string);
  const themeColor = getStatusColor(incident.repair_status as string);
  const sevColor = severityColor[incident.priority as IncidentSeverity] || "#f59e0b";
  const sevTh = severityLabelTh[incident.priority as IncidentSeverity] || (incident.priority as string);
  
  const formattedReported = formatThaiDate((incident.reported_at || incident.createdAt) as string);
  const formattedSlaDue = incident.sla_due_at ? formatThaiDate(incident.sla_due_at as string) : "ไม่มีกำหนด (N/A)";
  
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/mission-control`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>NexCore Mission Control Alert</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #020617;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #f8fafc;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #090d1f;
          border: 1px solid #1e293b;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .header {
          background-color: #020617;
          padding: 24px;
          border-b: 1px solid #1e293b;
          text-align: center;
        }
        .glow-title {
          font-size: 14px;
          font-weight: bold;
          color: #2dd4bf;
          letter-spacing: 0.2em;
          margin: 0 0 6px 0;
          text-transform: uppercase;
        }
        .fallback-indicator {
          display: inline-block;
          font-size: 11px;
          font-weight: bold;
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 4px 10px;
          border-radius: 20px;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .body {
          padding: 24px;
        }
        .incident-no {
          font-family: monospace;
          font-size: 24px;
          font-weight: bold;
          color: #ffffff;
          margin: 0 0 4px 0;
          font-style: italic;
        }
        .station-title {
          font-size: 18px;
          font-weight: bold;
          color: #e2e8f0;
          margin: 0 0 20px 0;
        }
        .status-badge {
          display: inline-block;
          font-size: 12px;
          font-weight: bold;
          color: ${themeColor};
          border: 1px solid ${themeColor}4D;
          background-color: ${themeColor}1A;
          padding: 4px 12px;
          border-radius: 4px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .grid-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .grid-table td {
          padding: 10px 0;
          border-bottom: 1px solid #1e293b;
          font-size: 13px;
        }
        .label {
          color: #94a3b8;
          width: 35%;
          font-weight: 500;
        }
        .value {
          color: #cbd5e1;
        }
        .value-bold {
          color: #cbd5e1;
          font-weight: bold;
        }
        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 20px 0 8px 0;
          border-bottom: 1px dashed #1e293b;
          padding-bottom: 4px;
        }
        .desc-text {
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.6;
          background-color: #0b0f24;
          border: 1px solid #1e293b;
          padding: 12px 16px;
          border-radius: 6px;
          margin: 0;
        }
        .failure-box {
          background-color: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
          padding: 12px 16px;
          border-radius: 6px;
          margin-top: 20px;
        }
        .failure-title {
          font-size: 11px;
          font-weight: bold;
          color: #f87171;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .failure-msg {
          font-family: monospace;
          font-size: 12px;
          color: #fca5a5;
          margin: 0;
        }
        .footer {
          background-color: #020617;
          padding: 24px;
          border-top: 1px solid #1e293b;
          text-align: center;
        }
        .btn {
          display: inline-block;
          font-size: 14px;
          font-weight: bold;
          background-color: #0f766e;
          color: #ffffff;
          text-decoration: none;
          padding: 10px 24px;
          border-radius: 6px;
          box-shadow: 0 0 10px rgba(15, 118, 110, 0.3);
        }
        .copyright {
          font-size: 11px;
          color: #64748b;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="glow-title">NexCore Mission Control System</div>
          <div class="fallback-indicator">SMTP NOTIFICATION FALLBACK</div>
        </div>
        <div class="body">
          <div class="incident-no">${incident.incident_no || "NEW INCIDENT"}</div>
          <div class="station-title">สถานี: ${incident.station}</div>
          <div class="status-badge">${statusTh}</div>
          
          <table class="grid-table">
            <tr>
              <td class="label">ระดับความรุนแรง</td>
              <td class="value-bold" style="color: ${sevColor}">${sevTh}</td>
            </tr>
            <tr>
              <td class="label">เวลาที่ได้รับแจ้ง</td>
              <td class="value">${formattedReported}</td>
            </tr>
            <tr>
              <td class="label">กำหนดเวลา SLA</td>
              <td class="value">${formattedSlaDue} ${incident.sla_duration_hours ? `(${incident.sla_duration_hours} ชม.)` : ""}</td>
            </tr>
            <tr>
              <td class="label">ผู้แจ้งเหตุ</td>
              <td class="value">${incident.reporter} ${incident.phone && incident.phone !== "-" ? `(${incident.phone})` : ""}</td>
            </tr>
          </table>

          <div class="section-title">รายละเอียดอาการเสีย</div>
          <p class="desc-text">${incident.issue_description || incident.description || "ไม่ระบุรายละเอียด"}</p>

          ${
            failureReason
              ? `
              <div class="failure-box">
                <div class="failure-title">LINE Delivery Failure Status</div>
                <p class="failure-msg">${failureReason}</p>
              </div>
            `
              : ""
          }
        </div>
        <div class="footer">
          <a href="${dashboardUrl}" class="btn">เปิดระบบ Mission Control</a>
          <div class="copyright">&copy; NexCore Mission Control. All rights reserved.</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Dispatches a fallback SMTP alert email
export async function sendEmailFallbackNotification(
  incident: Record<string, unknown>,
  failureReason = "",
  correlationId = `corr-${Math.random().toString(36).substring(2, 10)}`
): Promise<{ success: boolean; channel: string; message: string }> {
  const config = await getIncidentConfigAsync();
  const smtpUser = config.smtpUser;
  const smtpPass = config.smtpPassword;
  const emailTo = config.fallbackEmailTo || "dopa-only-tm@forth.co.th";

  if (!smtpUser || !smtpPass) {
    const errorMsg = "Missing SMTP_USER or SMTP_PASSWORD in system settings";
    console.error(`[SMTP Client] [${correlationId}] ${errorMsg}`);

    await recordNotificationAttempt({
      incidentId: incident.id as string,
      channel: "smtp_fallback",
      status: "error",
      message: errorMsg,
      correlationId,
      tokenSource: "env_or_system_settings_missing",
    });

    return { success: false, channel: "smtp_fallback", message: errorMsg };
  }

  // Create transporter for Microsoft 365 Relay
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false
    }
  });

  const htmlContent = generateEmailHtmlTemplate(incident, failureReason);

  try {
    console.log(`[SMTP Client] [${correlationId}] Dispatching fallback HTML email to: ${emailTo}...`);

    const info = await transporter.sendMail({
      from: `"NexCore Mission Control" <${smtpUser}>`,
      to: emailTo,
      subject: `🚨 [Notification Fallback] [${incident.incident_no || "NEW"}] ${incident.station as string}`,
      html: htmlContent,
    });

    console.log(`[SMTP Client] [${correlationId}] Fallback email dispatched successfully! MessageID: ${info.messageId}`);

    await recordNotificationAttempt({
      incidentId: incident.id as string,
      channel: "smtp_fallback",
      status: "success",
      message: `Email sent successfully: ${info.messageId}`,
      correlationId,
      tokenSource: "env_or_system_settings",
    });

    return {
      success: true,
      channel: "smtp_fallback",
      message: `Sent successfully: ${info.messageId}`,
    };
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    console.error(`[SMTP Client] [${correlationId}] Failed to send fallback email: ${errStr}`);

    await recordNotificationAttempt({
      incidentId: incident.id as string,
      channel: "smtp_fallback",
      status: "error",
      message: `SMTP Error: ${errStr}`,
      correlationId,
      tokenSource: "env_or_system_settings",
    });

    return {
      success: false,
      channel: "smtp_fallback",
      message: errStr,
    };
  }
}
