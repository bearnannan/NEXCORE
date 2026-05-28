"use client";

import React from "react";
import ExportMapStatic from "./ExportMapStatic";
import { formatDateDisplay } from "@/hooks/useExport";

interface ExportIncidentReportProps {
  district: string;
  incidents: any[];
  allIncidents?: any[];
}

const NEON = {
  cyan: "#00F0FF",
  green: "#00FF88",
  yellow: "#F0E800",
  magenta: "#FF00A0",
  purple: "#B829DD",
  orange: "#FF7B00",
  base: "#0A0A0F",
  elevated: "#12121A",
  surface: "#1A1A25",
  muted: "#94A3B8",
  text: "#E2E8F0",
};

const pageStyle: React.CSSProperties = {
  width: "1122px",
  height: "794px",
  padding: "32px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  overflow: "hidden",
  color: NEON.text,
  fontFamily: "'Sarabun', 'Inter', 'Noto Sans Thai', sans-serif",
  backgroundColor: NEON.base,
  backgroundImage:
    "radial-gradient(circle at 18% 18%, rgba(0,240,255,0.14), transparent 34%), radial-gradient(circle at 82% 20%, rgba(255,0,160,0.10), transparent 30%), linear-gradient(rgba(0,240,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.045) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
};

const panelStyle: React.CSSProperties = {
  background: "rgba(26, 26, 37, 0.86)",
  border: "1px solid rgba(0, 240, 255, 0.18)",
  borderRadius: "18px",
  boxShadow:
    "0 14px 32px rgba(0,0,0,0.45), 0 0 24px rgba(0,240,255,0.07), inset 0 1px 0 rgba(255,255,255,0.06)",
};

function neonStat(label: string, value: number | string, sub: string, color: string): React.CSSProperties {
  return {
    minWidth: "100px",
    padding: "12px 14px",
    textAlign: "center",
    borderRadius: "14px",
    color,
    background: `${color}12`,
    border: `1px solid ${color}40`,
    boxShadow: `0 0 18px ${color}18, inset 0 1px 0 rgba(255,255,255,0.05)`,
  };
}

function SectionTitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "14px", flexShrink: 0 }}>
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "999px",
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
      <span style={{ color: NEON.text, fontSize: "13px", fontWeight: 800, lineHeight: "1.3" }}>
        {children}
      </span>
    </div>
  );
}

export default function ExportIncidentReport({
  district,
  incidents,
  allIncidents = [],
}: ExportIncidentReportProps) {
  const provinceName = incidents[0]?.province || "กาญจนบุรี";
  const displayDistrict = district.startsWith("อำเภอ") ? district : `อำเภอ${district}`;
  const totalIncidents = incidents.length;
  const summarySource = allIncidents.length > 0 ? allIncidents : incidents;

  const totalInProvince = summarySource.filter(
    (i) => (i.province || i.provinceName) === provinceName
  ).length || totalIncidents;

  // Compute status distributions
  const completedCount = incidents.filter(i => i.repair_status === "เสร็จสิ้น" || i.status === "resolved" || i.status === "closed").length;
  const inProgressCount = incidents.filter(i => i.repair_status === "กำลังดำเนินการ" || i.status === "in_progress" || i.status === "acknowledged").length;
  const pendingCount = incidents.filter(i => i.repair_status === "รอดำเนินการ" || i.status === "new" || !i.repair_status).length;

  // Compute Priority counts
  const criticalCount = incidents.filter(i => String(i.priority || i.severity).toLowerCase() === "critical").length;
  const highCount = incidents.filter(i => String(i.priority || i.severity).toLowerCase() === "high").length;
  const mediumCount = incidents.filter(i => String(i.priority || i.severity).toLowerCase() === "medium").length;
  const lowCount = incidents.filter(i => String(i.priority || i.severity).toLowerCase() === "low" || !i.priority).length;

  // Compute SLA breaches
  const [now, setNow] = React.useState<number>(0);
  React.useEffect(() => {
    setNow(Date.now());
  }, []);

  const isBreached = (item: any) => {
    if (!item.sla_due_at) return false;
    const limit = new Date(item.sla_due_at).getTime();
    const end = item.resolved_at ? new Date(item.resolved_at).getTime() : now;
    return end > limit && item.repair_status !== "เสร็จสิ้น";
  };
  const breachedCount = incidents.filter(isBreached).length;
  const slaMetCount = totalIncidents - breachedCount;
  const slaMetRate = totalIncidents > 0 ? Math.round((slaMetCount / totalIncidents) * 100) : 100;

  // Map incidents for static maps
  const mappedStationsForMap = incidents.map(item => ({
    lat: item.latitude || item.lat,
    lon: item.longitude || item.lon,
    foundationProgress: item.repair_status === "เสร็จสิ้น" ? 100 : 0,
    poleInstallationProgress: item.repair_status === "เสร็จสิ้น" ? 100 : 0,
  }));

  const overallColor = slaMetRate >= 80 ? NEON.green : slaMetRate >= 50 ? NEON.yellow : NEON.magenta;

  return (
    <div style={pageStyle}>
      {/* Top Header Panel */}
      <div
        style={{
          ...panelStyle,
          flexShrink: 0,
          padding: "24px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgba(18,18,26,0.98), rgba(26,26,37,0.92))",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: NEON.cyan,
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "2.6px",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
              textShadow: "0 0 10px rgba(0,240,255,0.45)",
            }}
          >
            <span style={{ width: "18px", height: "3px", borderRadius: "3px", background: NEON.cyan, boxShadow: `0 0 10px ${NEON.cyan}` }} />
            รายงานเหตุขัดข้องและการจัดการเหตุเสีย (MISSION CONTROL)
          </div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "42px",
              fontWeight: 900,
              lineHeight: 1.05,
              textShadow: "0 0 18px rgba(255,255,255,0.18)",
            }}
          >
            {displayDistrict}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
            <span style={{ color: NEON.text, fontSize: "21px", fontWeight: 800 }}>จ.{provinceName}</span>
            <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: "rgba(0,240,255,0.55)" }} />
            <span style={{ color: NEON.muted, fontSize: "15px", fontWeight: 700 }}>{totalIncidents} รายการขัดข้อง</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Stats widgets */}
          {[{ label: "เสร็จสิ้น", value: completedCount, sub: "เสร็จสิ้น", color: NEON.green },
            { label: "กำลังดำเนินการ", value: inProgressCount, sub: "กำลังทำ", color: NEON.cyan },
            { label: "รอดำเนินการ", value: pendingCount, sub: "รอดำเนินการ", color: NEON.yellow }
          ].map((stat) => (
            <div key={stat.label} style={neonStat(stat.label, stat.value, stat.sub, stat.color)}>
              <div style={{ fontSize: "9px", fontWeight: 900, letterSpacing: "0.6px", marginBottom: "5px" }}>{stat.label}</div>
              <div style={{ color: "#FFFFFF", fontSize: "29px", fontWeight: 900, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: NEON.muted, fontSize: "10px", marginTop: "5px", fontWeight: 700 }}>{stat.sub}</div>
            </div>
          ))}
          <div style={{ ...neonStat("SLA Met Rate", `${slaMetRate}%`, "SLA ภาพรวม", overallColor), minWidth: "112px", marginLeft: "6px" }}>
            <div style={{ fontSize: "10px", fontWeight: 900, letterSpacing: "0.8px", marginBottom: "5px" }}>SLA Met Rate</div>
            <div style={{ color: overallColor, fontSize: "37px", fontWeight: 900, lineHeight: 1, textShadow: `0 0 14px ${overallColor}70` }}>
              {slaMetRate}<span style={{ fontSize: "14px", color: NEON.muted, marginLeft: "2px" }}>%</span>
            </div>
            <div style={{ color: NEON.muted, fontSize: "9px", marginTop: "5px", fontWeight: 800 }}>SLA ภาพรวม</div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
        {/* Left Bento Blocks */}
        <div style={{ flex: "0 0 45%", display: "flex", flexDirection: "column", gap: "16px", minHeight: 0 }}>
          {/* Priority Distribution panel */}
          <div style={{ ...panelStyle, flex: "0 0 48%", padding: "20px", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <SectionTitle color={NEON.magenta}>ลำดับความสำคัญ & ความรุนแรง</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", flex: 1, alignItems: "center" }}>
              {/* Critical & High */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700 }}>
                  <span style={{ color: NEON.magenta }}>CRITICAL</span>
                  <span style={{ color: "#FFFFFF" }}>{criticalCount} รายการ</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: NEON.magenta, width: `${totalIncidents > 0 ? (criticalCount / totalIncidents) * 100 : 0}%`, height: "100%", boxShadow: `0 0 8px ${NEON.magenta}` }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginTop: "6px" }}>
                  <span style={{ color: NEON.orange }}>HIGH</span>
                  <span style={{ color: "#FFFFFF" }}>{highCount} รายการ</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: NEON.orange, width: `${totalIncidents > 0 ? (highCount / totalIncidents) * 100 : 0}%`, height: "100%", boxShadow: `0 0 8px ${NEON.orange}` }} />
                </div>
              </div>

              {/* Medium & Low */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700 }}>
                  <span style={{ color: NEON.yellow }}>MEDIUM</span>
                  <span style={{ color: "#FFFFFF" }}>{mediumCount} รายการ</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: NEON.yellow, width: `${totalIncidents > 0 ? (mediumCount / totalIncidents) * 100 : 0}%`, height: "100%", boxShadow: `0 0 8px ${NEON.yellow}` }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginTop: "6px" }}>
                  <span style={{ color: NEON.cyan }}>LOW</span>
                  <span style={{ color: "#FFFFFF" }}>{lowCount} รายการ</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: NEON.cyan, width: `${totalIncidents > 0 ? (lowCount / totalIncidents) * 100 : 0}%`, height: "100%", boxShadow: `0 0 8px ${NEON.cyan}` }} />
                </div>
              </div>
            </div>
            {/* Summary sentence */}
            <div style={{ color: NEON.muted, fontSize: "10px", marginTop: "10px", fontWeight: 700, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
              * มีเคสละเมิด SLA สะสมทั้งสิ้น <span style={{ color: NEON.magenta, fontWeight: 900 }}>{breachedCount} เคส</span> ในเขตอำเภอนี้
            </div>
          </div>

          {/* Map panel */}
          <div style={{ ...panelStyle, flex: "0 0 48%", padding: "18px", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <SectionTitle color={NEON.green}>แผนที่เหตุขัดข้องทางยุทธการ</SectionTitle>
            <div style={{ flex: 1, overflow: "hidden", borderRadius: "14px", border: "1px solid rgba(0,255,136,0.20)", background: "rgba(10,10,15,0.72)" }}>
              <ExportMapStatic stations={mappedStationsForMap} category="station" />
            </div>
          </div>
        </div>

        {/* Right Incident List Grid */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ ...panelStyle, height: "100%", padding: "22px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <SectionTitle color={NEON.purple}>รายการแจ้งเหตุขัดข้องทางวิศวกรรม</SectionTitle>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                <thead>
                  <tr style={{ background: "rgba(0,240,255,0.08)" }}>
                    <th style={{ textAlign: "left", padding: "7px 5px", color: NEON.cyan, fontWeight: 800, borderBottom: "1px solid rgba(0,240,255,0.18)" }}>หมายเลข / สถานี</th>
                    <th style={{ textAlign: "left", padding: "7px 4px", color: NEON.purple, fontWeight: 800, borderBottom: "1px solid rgba(0,240,255,0.18)" }}>อาการเสีย</th>
                    <th style={{ textAlign: "center", padding: "7px 4px", color: NEON.magenta, fontWeight: 800, borderBottom: "1px solid rgba(0,240,255,0.18)" }}>ความสำคัญ</th>
                    <th style={{ textAlign: "left", padding: "7px 4px", color: NEON.yellow, fontWeight: 800, borderBottom: "1px solid rgba(0,240,255,0.18)" }}>กำหนด SLA</th>
                    <th style={{ textAlign: "center", padding: "7px 4px", color: NEON.green, fontWeight: 800, borderBottom: "1px solid rgba(0,240,255,0.18)" }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.slice(0, 14).map((inc, index) => {
                    const priorityColor =
                      (inc.priority || inc.severity) === "critical"
                        ? NEON.magenta
                        : (inc.priority || inc.severity) === "high"
                        ? NEON.orange
                        : (inc.priority || inc.severity) === "medium"
                        ? NEON.yellow
                        : NEON.cyan;

                    const isOverdue = isBreached(inc);

                    return (
                      <tr key={`${inc.id || inc.title}-${index}`} style={{ background: index % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,240,255,0.035)" }}>
                        <td style={{ padding: "5px", borderBottom: "1px solid rgba(255,255,255,0.06)", maxWidth: "120px" }}>
                          <div style={{ color: NEON.text, fontWeight: 800, fontSize: "9px" }}>{inc.title || inc.incident_no || "Incident"}</div>
                          <div style={{ color: NEON.muted, fontWeight: 700, fontSize: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {inc.stationName || inc.station}
                          </div>
                        </td>
                        <td style={{ padding: "5px", color: "#FFFFFF", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inc.description || inc.issue_description || "-"}
                        </td>
                        <td style={{ padding: "5px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ color: priorityColor, background: `${priorityColor}18`, border: `1px solid ${priorityColor}45`, padding: "1px 5px", borderRadius: "5px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>
                            {inc.priority || inc.severity || "low"}
                          </span>
                        </td>
                        <td style={{ padding: "5px", color: isOverdue ? NEON.magenta : NEON.text, borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: isOverdue ? 900 : 500 }}>
                          {inc.sla_due_at ? formatDateDisplay(inc.sla_due_at.split('T')[0]) : inc.createdAt ? formatDateDisplay(inc.createdAt.split('T')[0]) : "-"}
                          {isOverdue && <span style={{ fontSize: "8px", marginLeft: "4px", color: NEON.magenta, fontWeight: 900 }}>OVERDUE</span>}
                        </td>
                        <td style={{ padding: "5px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <span
                            style={{
                              color: (inc.repair_status || inc.status) === "เสร็จสิ้น" || (inc.repair_status || inc.status) === "resolved" || (inc.repair_status || inc.status) === "closed" ? NEON.green : (inc.repair_status || inc.status) === "กำลังดำเนินการ" || (inc.repair_status || inc.status) === "in_progress" || (inc.repair_status || inc.status) === "acknowledged" ? NEON.cyan : NEON.yellow,
                              background: (inc.repair_status || inc.status) === "เสร็จสิ้น" || (inc.repair_status || inc.status) === "resolved" || (inc.repair_status || inc.status) === "closed" ? `${NEON.green}18` : (inc.repair_status || inc.status) === "กำลังดำเนินการ" || (inc.repair_status || inc.status) === "in_progress" || (inc.repair_status || inc.status) === "acknowledged" ? `${NEON.cyan}18` : `${NEON.yellow}18`,
                              border: `1px solid ${(inc.repair_status || inc.status) === "เสร็จสิ้น" || (inc.repair_status || inc.status) === "resolved" || (inc.repair_status || inc.status) === "closed" ? NEON.green : (inc.repair_status || inc.status) === "กำลังดำเนินการ" || (inc.repair_status || inc.status) === "in_progress" || (inc.repair_status || inc.status) === "acknowledged" ? NEON.cyan : NEON.yellow}45`,
                              padding: "1px 4px",
                              borderRadius: "4px",
                              fontSize: "8px",
                              fontWeight: 800
                            }}
                          >
                            {inc.repair_status || inc.status || "รอดำเนินการ"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Table Footer */}
            <div style={{ marginTop: "10px", borderTop: "1px solid rgba(0,240,255,0.14)", paddingTop: "8px", display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: "9px", fontWeight: 700 }}>
              <span>Incident Operational Dashboard - Retro Neon Report</span>
              <span>พิมพ์: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
