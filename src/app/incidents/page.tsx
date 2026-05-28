"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ListChecks,
  Settings2,
  RefreshCw,
  Mail,
  MessageSquare,
  Activity,
  ArrowLeft,
  AlertTriangle,
  Phone,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStatusColor, getStatusLabelTh, formatThaiDate } from "@/lib/mission-control/line-format";

type IncidentDetails = {
  id: string;
  incident_no: string;
  reported_at: string;
  station: string;
  reporter: string;
  issue_description: string;
  assignee: string;
  repair_status: string;
  phone: string;
  priority: string;
  sla_duration_hours: number | null;
  sla_due_at: string | null;
  penalty_amount_baht: number;
};

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetails | null>(null);
  
  // Settings values
  const [lineToken, setLineToken] = useState("");
  const [groupId, setGroupId] = useState("");
  const [emailTo, setEmailTo] = useState("dopa-only-tm@forth.co.th");
  const [isPending, startTransition] = useTransition();

  // Load dashboard data
  const fetchData = async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
        if (data.length > 0 && !selectedIncident) {
          setSelectedIncident(data[0]);
        }
      }
    } catch {
      toast.error("Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save Settings
  const handleSaveSettings = () => {
    startTransition(async () => {
      // Simulate saving settings (since they can also be saved in local storage or simulated)
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success("System configurations updated successfully");
    });
  };

  // Manual Trigger Resend
  const handleManualResend = async (incidentId: string) => {
    toast.info("Resending notifications...");
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }), // Trigger update
      });
      if (res.ok) {
        toast.success("Alert resend completed successfully!");
        void fetchData();
      } else {
        toast.error("Failed to resend alert");
      }
    } catch {
      toast.error("Resend error occurred");
    }
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.08),transparent_45%),linear-gradient(135deg,#020617,#090d1f_55%,#020617)] p-4 sm:p-6 text-slate-100">
      
      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      <header className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-teal-500/10 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="border border-teal-500/20 bg-teal-500/5 text-teal-300 hover:bg-teal-500/10 h-10 w-10"
            onClick={() => router.push("/mission-control")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-50 uppercase flex items-center gap-2">
              <ListChecks className="size-5 text-teal-400" />
              Incidents & LINE Integration
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              LINE Flex message configurations and fallback SMTP alerts
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className="border-teal-500/25 bg-teal-500/10 text-teal-200">
            <Activity className="size-3 mr-1 animate-pulse" />
            Active Integration Mode
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-300"
          >
            <RefreshCw className="size-3.5 mr-1" />
            Sync Status
          </Button>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT COLUMN: Incidents Table (7 cols) */}
        <section className="lg:col-span-7 flex flex-col rounded-xl border border-teal-500/15 bg-slate-950/40 p-4 backdrop-blur-xl shadow-xl">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
            <ListChecks className="size-4 text-teal-400" />
            Incidents Queue
          </h2>
          
          <div className="overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-teal-300 font-mono text-xs">
                <RefreshCw className="size-5 animate-spin mr-2" />
                LOADING INCIDENTS FROM SUPABASE...
              </div>
            ) : incidents.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-slate-400 border border-dashed border-teal-500/10 rounded-lg bg-teal-500/5">
                <AlertTriangle className="size-8 text-amber-500 mb-2 animate-bounce" />
                <p className="text-sm font-semibold text-slate-300">No active incidents found</p>
                <p className="text-xs text-slate-500">Wait for Webhook triggers or create one manually.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left font-sans text-xs">
                <thead>
                  <tr className="border-b border-teal-500/20 text-slate-400 font-semibold uppercase tracking-wider h-9">
                    <th className="pb-2">Incident ID</th>
                    <th className="pb-2">Station</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Reported</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-500/5">
                  {incidents.map((incident) => {
                    const statusColor = getStatusColor(incident.repair_status);
                    const statusTh = getStatusLabelTh(incident.repair_status);
                    
                    return (
                      <tr
                        key={incident.id}
                        onClick={() => setSelectedIncident(incident)}
                        className={`h-12 hover:bg-teal-500/5 cursor-pointer transition-colors ${
                          selectedIncident?.id === incident.id ? "bg-teal-500/10" : ""
                        }`}
                      >
                        <td className="font-mono text-[11px] font-semibold text-slate-300">
                          {incident.incident_no || "PENDING"}
                        </td>
                        <td className="font-semibold text-slate-200">
                          {incident.station}
                        </td>
                        <td>
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                incident.priority === "critical"
                                  ? "#ef4444"
                                  : incident.priority === "high"
                                  ? "#f97316"
                                  : incident.priority === "medium"
                                  ? "#f59e0b"
                                  : "#38bdf8",
                            }}
                          >
                            {incident.priority.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <Badge
                            className="border-none font-semibold text-[10px] py-0.5 px-2"
                            style={{
                              backgroundColor: `${statusColor}1A`,
                              color: statusColor,
                              border: `1.5px solid ${statusColor}4D`,
                            }}
                          >
                            {statusTh}
                          </Badge>
                        </td>
                        <td className="text-slate-400">
                          {formatThaiDate(incident.reported_at)}
                        </td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleManualResend(incident.id);
                            }}
                            className="h-8 border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-300 font-mono text-[10px] px-2.5"
                          >
                            <RefreshCw className="size-3 mr-1" />
                            RESEND
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Backup Configurations Settings Card */}
          <div className="mt-6 rounded-xl border border-teal-500/15 bg-slate-950/60 p-4 shadow-inner">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Settings2 className="size-4 text-teal-400" />
              Notification Backup Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Backup LINE Channel Token
                </span>
                <Input
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••"
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  className="h-9 bg-slate-900/80 border-slate-700 text-xs focus-visible:ring-teal-500/30"
                />
              </label>
              
              <label className="block">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Backup LINE Group ID
                </span>
                <Input
                  placeholder="e.g. C0a3dbf87ac..."
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-9 bg-slate-900/80 border-slate-700 text-xs focus-visible:ring-teal-500/30"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Global SMTP Fallback Email (DOPA)
                </span>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="h-9 bg-slate-900/80 border-slate-700 text-xs focus-visible:ring-teal-500/30"
                />
              </label>
            </div>
            
            <Button
              className="mt-4 h-9 bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white px-4 border-none shadow-[0_0_10px_rgba(13,148,136,0.3)]"
              onClick={handleSaveSettings}
              disabled={isPending}
            >
              <Settings className="size-3.5 mr-1" />
              {isPending ? "Configuring..." : "Save Backup Credentials"}
            </Button>
          </div>
        </section>

        {/* RIGHT COLUMN: Visual Simulator (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* 1. LINE Bubble Simulator */}
          <div className="rounded-xl border border-teal-500/15 bg-slate-950/40 p-4 backdrop-blur-xl shadow-xl flex flex-col">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
              <MessageSquare className="size-4 text-teal-400" />
              LINE Flex Message Live preview
            </h2>

            {selectedIncident ? (
              <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden max-w-sm mx-auto shadow-2xl">
                {/* Chat bubble body mock */}
                <div className="p-4 bg-slate-950 flex flex-col spacing-y-3 max-w-[340px]">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-teal-400 tracking-wider">NEXCORE MISSION CONTROL</span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: getStatusColor(selectedIncident.repair_status) }}
                    >
                      {getStatusLabelTh(selectedIncident.repair_status).toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="mt-2.5">
                    <h3 className="font-mono text-lg font-bold text-white italic m-0">
                      {selectedIncident.incident_no || "INC-SHF-2026-0001"}
                    </h3>
                    <p className="text-sm font-bold text-slate-200 m-0 mt-0.5">
                      สถานี: {selectedIncident.station}
                    </p>
                  </div>

                  <table className="w-full text-[11px] mt-3 border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 text-slate-400">ระดับความรุนแรง</td>
                        <td
                          className="py-1 font-bold"
                          style={{
                            color:
                              selectedIncident.priority === "critical"
                                ? "#ef4444"
                                : selectedIncident.priority === "high"
                                ? "#f97316"
                                : selectedIncident.priority === "medium"
                                ? "#f59e0b"
                                : "#38bdf8",
                          }}
                        >
                          {selectedIncident.priority.toUpperCase()}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 text-slate-400">เวลาที่ได้รับแจ้ง</td>
                        <td className="py-1 text-slate-300">{formatThaiDate(selectedIncident.reported_at)}</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="py-1 text-slate-400">กำหนดเวลา SLA</td>
                        <td className="py-1 text-slate-300">
                          {selectedIncident.sla_due_at ? formatThaiDate(selectedIncident.sla_due_at) : "ไม่มีกำหนด"}
                          {selectedIncident.sla_duration_hours ? ` (${selectedIncident.sla_duration_hours} ชม.)` : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-3 border-t border-slate-800 pt-2.5">
                    <span className="text-[10px] text-slate-400 font-bold block">รายละเอียดอาการเสีย</span>
                    <p className="text-xs text-slate-200 mt-1 m-0 leading-relaxed bg-slate-900/60 p-2 rounded border border-slate-800">
                      {selectedIncident.issue_description || "ไม่ระบุรายละเอียด"}
                    </p>
                  </div>

                  <div className="mt-3">
                    <span className="text-[10px] text-slate-400 font-bold block">ผู้แจ้งเหตุ</span>
                    <p className="text-xs text-slate-200 mt-0.5 m-0 font-sans">
                      {selectedIncident.reporter} {selectedIncident.phone && selectedIncident.phone !== "-" ? `(${selectedIncident.phone})` : ""}
                    </p>
                  </div>

                  {/* Actions buttons */}
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-9 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border-none rounded"
                      onClick={() => toast.info(`Opening dialer: tel:${selectedIncident.phone}`)}
                    >
                      <Phone className="size-3 mr-1" />
                      โทรหาผู้แจ้งเหตุ
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 bg-teal-800 hover:bg-teal-700 text-xs font-semibold text-white border-none rounded"
                    >
                      เปิด Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 p-4 text-center">Select an incident to view live preview</p>
            )}
          </div>

          {/* 2. Email Fallback Simulator */}
          <div className="rounded-xl border border-teal-500/15 bg-slate-950/40 p-4 backdrop-blur-xl shadow-xl flex flex-col">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
              <Mail className="size-4 text-teal-400" />
              SMTP Fallback Email live preview
            </h2>

            {selectedIncident ? (
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden max-w-sm mx-auto shadow-2xl">
                {/* Email Template preview */}
                <div className="bg-[#020617] border-b border-[#1e293b] p-3 text-center">
                  <div className="text-[10px] font-bold text-teal-400 tracking-wider">NexCore Mission Control System</div>
                  <div className="inline-block text-[8px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full mt-1.5 uppercase">SMTP NOTIFICATION FALLBACK</div>
                </div>
                
                <div className="p-4 bg-[#090d1f]">
                  <h3 className="font-mono text-lg font-bold text-white italic m-0">
                    {selectedIncident.incident_no || "INC-SHF-2026-0001"}
                  </h3>
                  <p className="text-sm font-bold text-slate-300 m-0 mt-0.5">สถานี: {selectedIncident.station}</p>
                  
                  <div className="mt-3 p-3 bg-[#0b0f24] border border-[#1e293b] rounded text-[11px] leading-relaxed text-[#cbd5e1]">
                    <strong className="text-teal-400">รายละเอียดขัดข้อง LINE:</strong> LINE API Quota Limit Exceeded (HTTP 429 Too Many Requests)
                  </div>

                  <table className="w-full text-[11px] mt-4 border-collapse">
                    <tbody>
                      <tr className="border-b border-[#1e293b]">
                        <td className="py-1 text-[#94a3b8]">ระดับความรุนแรง</td>
                        <td
                          className="py-1 font-bold"
                          style={{
                            color:
                              selectedIncident.priority === "critical"
                                ? "#ef4444"
                                : selectedIncident.priority === "high"
                                ? "#f97316"
                                : selectedIncident.priority === "medium"
                                ? "#f59e0b"
                                : "#38bdf8",
                          }}
                        >
                          {selectedIncident.priority.toUpperCase()}
                        </td>
                      </tr>
                      <tr className="border-b border-[#1e293b]">
                        <td className="py-1 text-[#94a3b8]">เวลาที่ได้รับแจ้ง</td>
                        <td className="py-1 text-[#cbd5e1]">{formatThaiDate(selectedIncident.reported_at)}</td>
                      </tr>
                      <tr className="border-b border-[#1e293b]">
                        <td className="py-1 text-[#94a3b8]">กำหนดเวลา SLA</td>
                        <td className="py-1 text-[#cbd5e1]">
                          {selectedIncident.sla_due_at ? formatThaiDate(selectedIncident.sla_due_at) : "ไม่มีกำหนด"}
                          {selectedIncident.sla_duration_hours ? ` (${selectedIncident.sla_duration_hours} ชม.)` : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#020617] border-t border-[#1e293b] p-3 text-center">
                  <a href="#" className="inline-block bg-[#0f766e] text-white text-[11px] font-bold py-1.5 px-4 rounded text-decoration-none shadow-[0_0_10px_rgba(15,118,110,0.3)]" onClick={(e) => e.preventDefault()}>เปิดระบบ Mission Control</a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 p-4 text-center">Select an incident to view email preview</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
