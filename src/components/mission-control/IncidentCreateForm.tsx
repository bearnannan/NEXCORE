"use client";

import React, { useState } from "react";
import {
  formatIncidentPhone,
  isValidIncidentPhone,
  invalidPhoneMessage,
} from "@/lib/mission-control/phone";
import {
  EQUIPMENT_SLA_RULES,
  getEquipmentSlaRule,
  getPriorityOptionsForEquipment,
  normalizePriorityForEquipment,
} from "@/lib/mission-control/sla";
import type {
  IncidentPriority,
  Station,
} from "@/lib/mission-control/types";
import { AlertCircle, ShieldAlert, User, Phone, ClipboardList, Settings, Cpu, HardDrive } from "lucide-react";

export interface IncidentCreatePayload {
  station: string;
  reporter: string;
  description: string;
  phone: string;
  priority: IncidentPriority;
  equipment_type: string;
}

export function IncidentCreateForm({
  stations,
  operatorName,
  isPending,
  onSubmit,
  defaultStationId,
}: {
  stations: Station[];
  operatorName: string;
  isPending: boolean;
  onSubmit: (payload: IncidentCreatePayload) => void;
  defaultStationId?: string | null;
}) {
  const [stationId, setStationId] = useState(defaultStationId || "");
  const [reporter, setReporter] = useState(operatorName);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [priority, setPriority] = useState<IncidentPriority>("medium");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [prevDefaultStationId, setPrevDefaultStationId] = useState(defaultStationId);

  // Sync selected station from map clicks during render phase to comply with React 19 rules
  if (defaultStationId !== prevDefaultStationId) {
    setPrevDefaultStationId(defaultStationId);
    setStationId(defaultStationId || "");
  }

  const selectedStation = stations.find((s) => s.id === stationId);
  const priorityOptions = getPriorityOptionsForEquipment(equipmentType);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatIncidentPhone(e.target.value));
  };

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextEquip = e.target.value;
    setEquipmentType(nextEquip);
    setPriority(normalizePriorityForEquipment(nextEquip, priority));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!stationId || !selectedStation) {
      setValidationError("กรุณาเลือกสถานีที่เกิดเหตุ");
      return;
    }

    if (!title.trim()) {
      setValidationError("กรุณาระบุหัวข้อปัญหา / อาการเสีย");
      return;
    }

    if (phone && !isValidIncidentPhone(phone)) {
      setValidationError(invalidPhoneMessage("เบอร์โทรติดต่อ"));
      return;
    }

    // Join Title and Description as required by target structure
    const fullDescription = description.trim()
      ? `[${title.trim()}] ${description.trim()}`
      : title.trim();

    onSubmit({
      station: selectedStation.name,
      reporter: reporter.trim() || operatorName,
      description: fullDescription,
      phone: phone || "-",
      priority,
      equipment_type: equipmentType || "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-100 pb-16">
      {validationError && (
        <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <AlertCircle className="size-4 shrink-0 text-red-500" />
          <span className="font-medium">{validationError}</span>
        </div>
      )}

      {/* Target Station */}
      <section className="rounded-lg border border-cyan-500/20 bg-slate-900/30 backdrop-blur-md p-4 transition-all duration-300 hover:border-cyan-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          <ShieldAlert className="size-4 animate-pulse" />
          <span>Target Station</span>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Station *</span>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-md border border-cyan-500/20 bg-slate-950 px-3 text-xs text-slate-200 outline-none transition-all focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30"
              required
            >
              <option value="">เลือกสถานีเกิดเหตุ...</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name} ({s.province || "N/A"})
                </option>
              ))}
            </select>
          </label>

          {selectedStation && (
            <div className="rounded-md border border-cyan-500/10 bg-cyan-950/20 p-2.5 text-[10px] text-cyan-300/90 font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-cyan-400/60 font-bold uppercase">Province:</span>
                <span>{selectedStation.province || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400/60 font-bold uppercase">Latitude:</span>
                <span>{selectedStation.latitude?.toFixed(4) || "Pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400/60 font-bold uppercase">Longitude:</span>
                <span>{selectedStation.longitude?.toFixed(4) || "Pending"}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Report Info */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/10 backdrop-blur-md p-4 transition-all duration-300 hover:border-slate-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <ClipboardList className="size-4" />
          <span>Intake Report</span>
        </div>
        <div className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Reporter</span>
            <div className="relative">
              <User className="absolute left-3 top-3 size-4 text-slate-500" />
              <input
                type="text"
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
                placeholder="ชื่อผู้แจ้งเหตุ"
                className="h-10 w-full rounded-md border border-slate-800 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none transition-all hover:border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact Phone</span>
            <div className="relative">
              <Phone className="absolute left-3 top-3 size-4 text-slate-500" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="081-234-5678"
                maxLength={12}
                className="h-10 w-full rounded-md border border-slate-800 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none transition-all hover:border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Incident Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น อุปกรณ์ Offline, ไฟฟ้าดับ, หรือระบบล่ม"
              className="h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-slate-200 outline-none transition-all hover:border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Additional Details</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดอาการชำรุดเสียหาย..."
              rows={3}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none transition-all hover:border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 resize-none"
            />
          </label>
        </div>
      </section>

      {/* SLA & Equipment Constraint */}
      <section className="rounded-lg border border-orange-500/20 bg-slate-900/10 backdrop-blur-md p-4 transition-all duration-300 hover:border-orange-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-400">
          <Settings className="size-4 animate-spin-slow" />
          <span>SLA & Equipment Constraint</span>
        </div>
        <div className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Equipment Type</span>
            <div className="relative">
              <Cpu className="absolute left-3 top-3 size-4 text-slate-500" />
              <select
                value={equipmentType}
                onChange={handleEquipmentChange}
                className="h-10 w-full cursor-pointer rounded-md border border-orange-500/20 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none transition-all focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
              >
                <option value="">เลือกประเภทอุปกรณ์ SLA...</option>
                {EQUIPMENT_SLA_RULES.map((rule) => (
                  <option key={rule.equipmentType} value={rule.equipmentType}>
                    {rule.equipmentType}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Priority / Severity</span>
            <div className="relative">
              <HardDrive className="absolute left-3 top-3 size-4 text-slate-500" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                className="h-10 w-full cursor-pointer rounded-md border border-orange-500/20 bg-slate-950 pl-10 pr-3 text-xs text-slate-200 outline-none transition-all focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Boolean(equipmentType) && priorityOptions.length === 1}
              >
                {priorityOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {equipmentType && (
            <div className="rounded-md border border-orange-500/10 bg-orange-950/20 p-2.5 text-[10px] text-orange-300/90 font-mono flex justify-between items-center">
              <span className="text-orange-400/60 font-bold uppercase">SLA Target Duration:</span>
              <span className="font-bold">{getEquipmentSlaRule(equipmentType)?.slaDurationHours} Hours</span>
            </div>
          )}
        </div>
      </section>

      {/* Action Button */}
      <div className="sticky bottom-0 -mx-4 -mb-5 bg-slate-950/98 backdrop-blur-md px-4 py-4 border-t border-slate-900 flex justify-end shrink-0 z-20 shadow-[0_-12px_24px_rgba(2,6,23,0.9)]">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-11 rounded-md cursor-pointer bg-cyan-400 text-xs font-mono font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-200 hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.75)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest"
        >
          {isPending ? ">>> INTAKING INCIDENT <<<" : "CREATE NEW INCIDENT"}
        </button>
      </div>
    </form>
  );
}
