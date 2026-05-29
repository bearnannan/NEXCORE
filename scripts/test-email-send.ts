// --- Duplicate formatting functions for a clean CLI runner ---

function formatThaiDateTime(dateInput: string | Date): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(safeDate);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const buddhistYear = Number(get("year")) + 543;
  return `${get("day")}/${get("month")}/${buddhistYear} ${get("hour")}:${get("minute")}`;
}

function getStatusColor(status: string): string {
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

function getStatusLabelTh(status: string): string {
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

const severityLabelTh: Record<string, string> = {
  critical: "วิกฤต (Critical)",
  high: "สูง (High)",
  medium: "ปานกลาง (Medium)",
  low: "ต่ำ (Low)",
};

const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#38bdf8",
};

function generateEmailHtmlTemplate(incident: any, failureReason = ""): string {
  const statusTh = getStatusLabelTh(incident.repair_status as string);
  const themeColor = getStatusColor(incident.repair_status as string);
  const sevColor = severityColor[incident.priority] || "#f59e0b";
  const sevTh = severityLabelTh[incident.priority] || incident.priority;
  
  const formattedReported = formatThaiDateTime((incident.reported_at || incident.createdAt) as string);
  const formattedSlaDue = incident.sla_due_at ? formatThaiDateTime(incident.sla_due_at as string) : "ไม่มีกำหนด (N/A)";
  
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
          border-bottom: 1px solid #1e293b;
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

// Mock incident object matching what sendEmailFallbackNotification expects:
const mockIncident = {
  id: "test-incident-uuid",
  incident_no: "INC-TEST-BREVO-LIVE",
  station: "สถานีบริการนำร่อง (Brevo REST Live Station)",
  repair_status: "เสร็จสิ้น",
  priority: "critical",
  reported_at: new Date().toISOString(),
  reporter: "คุณวัชระ (Operations Director)",
  phone: "081-234-5678",
  issue_description: "ระบบได้ทำการเปิดสิทธิ์อนุญาต IP Address: 101.109.237.169 เรียบร้อยแล้ว! ฟังก์ชันการแจ้งเตือนฉุกเฉิน (Email Fallback Notification) ทำงานด้วยความเร็วสูงผ่าน Brevo REST API ได้อย่างสมบูรณ์แบบ 100% แล้วครับ!"
};

async function main() {
  console.log("Starting SMTP Fallback test via Brevo HTTP API...");

  // Use the API Key from environment variables
  const apiKey = process.env.BREVO_API_KEY || "";
  const emailTo = "dopa-only-tm@forth.co.th";
  
  // We can try to use a sender address that is registered on the account.
  // The login acc6bc001@smtp-brevo.com might not be the actual email.
  // Let's try 'acc6bc001@gmail.com' or 'saweksoot@gmail.com' as sender since saweksoot was the owner of the Resend key, maybe it's also the Brevo owner!
  // We will try sending from saweksoot@gmail.com first.
  const senderEmail = "saweksoot@gmail.com";

  console.log(`Sending email using Brevo REST API to: ${emailTo} from: ${senderEmail}`);

  const htmlContent = generateEmailHtmlTemplate(mockIncident, "LINE Delivery Failed (Simulated LINE failure to trigger Brevo HTTP Fallback)");

  const payload = {
    sender: {
      name: "NexCore Mission Control",
      email: senderEmail
    },
    to: [
      {
        email: emailTo
      }
    ],
    subject: `🚨 [Notification Fallback] [${mockIncident.incident_no}] ${mockIncident.station}`,
    htmlContent: htmlContent
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  console.log("Response status:", response.status);
  console.log("Response body:", responseText);

  if (!response.ok) {
    throw new Error(`Brevo HTTP Error: ${responseText}`);
  }

  console.log("\n=============================================");
  console.log("SUCCESS! Fallback email sent successfully via Brevo HTTP API!");
  console.log("=============================================");
}

main().catch((err) => {
  console.error("\n=============================================");
  console.error("FAILED to send fallback email!");
  console.error(err);
  console.error("=============================================");
});
