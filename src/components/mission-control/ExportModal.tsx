"use client";

import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { X, Download, ChevronDown, FileText, Table, FileUp } from 'lucide-react';
import type { ExportCategory, ExportType } from '@/hooks/useExport';

type ExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  exportType: ExportType;
  setExportType: (type: ExportType) => void;
  selectedExportStations: string[];
  setSelectedExportStations: React.Dispatch<React.SetStateAction<string[]>>;
  expandedDistricts: string[];
  setExpandedDistricts: React.Dispatch<React.SetStateAction<string[]>>;
  stations: any[];
  incidents: any[];
  activeCategory: ExportCategory; // Kept for legacy compatibility
  handleExportTXT: (cat: ExportCategory, data: any[]) => void;
  handleExportCSV: (cat: ExportCategory, data: any[]) => void;
  handleExportPDF: (cat: ExportCategory, data: any[]) => void;
  handleExportJPEG: (cat: ExportCategory, data: any[]) => void;
};

export function ExportModal({
  isOpen,
  onClose,
  exportType,
  setExportType,
  selectedExportStations,
  setSelectedExportStations,
  expandedDistricts,
  setExpandedDistricts,
  stations,
  incidents,
  activeCategory,
  handleExportTXT,
  handleExportCSV,
  handleExportPDF,
  handleExportJPEG
}: ExportModalProps) {
  if (!isOpen) return null;

  // Since operational scope is locked to Incidents, enforce Incident dataset matching
  const data = useMemo(() => {
    return incidents.map(inc => {
      // Enforce backward compatible station and district matching for incidents
      const matchingStation = stations.find(st => st.id === inc.stationId);
      return {
        ...inc,
        stationName: matchingStation?.name || matchingStation?.stationName || inc.title || "Unknown Station",
        district: matchingStation?.province || "Unknown",
        province: matchingStation?.province || "Unknown Province",
        latitude: inc.latitude ?? matchingStation?.latitude,
        longitude: inc.longitude ?? matchingStation?.longitude,
      };
    });
  }, [stations, incidents]);

  // Unique districts/provinces to group by
  const districts = useMemo(() => {
    const set = new Set<string>();
    data.forEach(item => {
      const d = item.district || "Unknown";
      set.add(d);
    });
    return Array.from(set).sort();
  }, [data]);

  const totalSelected = selectedExportStations.length;
  const totalStations = data.length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allKeys = data.map(item => {
        const name = item.stationName || item.name || item.station || "";
        const district = item.district || "Unknown";
        return `${district}|${name}`;
      });
      setSelectedExportStations(allKeys);
    } else {
      setSelectedExportStations([]);
    }
  };

  const isAllSelectedGlobal = totalSelected === totalStations && totalStations > 0;
  const isPartialGlobal = totalSelected > 0 && totalSelected < totalStations;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Cyberpunk Bento Card Container */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/95 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col max-h-[90vh] transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Neon top border line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <div>
            <h3 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
              <span className="text-cyan-400 font-extrabold">EXPORT</span> CONTROL
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest font-mono">
              เลือกแหล่งข้อมูล สถานี และรูปแบบการดาวน์โหลด
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Category & Format Selector Tabs */}
        <div className="px-6 pt-4 space-y-4">
          {/* Data Category - Station Build and Client Install selection removed as per image_ae4468.png */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Data Category (หมวดหมู่ข้อมูล)</span>
            <div className="grid grid-cols-1 p-1 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <button
                disabled
                className="py-2 rounded-lg text-xs font-extrabold bg-cyan-500/10 border border-cyan-500/35 text-cyan-400 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.1)] w-full text-center"
              >
                Incidents (ประวัติเหตุขัดข้องแจ้งเสีย)
              </button>
            </div>
          </div>

          {/* Export Formats */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Export Format (รูปแบบไฟล์)</span>
            <div className="grid grid-cols-4 gap-2 p-1 rounded-xl bg-slate-900/50 border border-slate-800/80">
              {([
                { key: 'txt' as const, label: 'TXT', icon: FileText },
                { key: 'csv' as const, label: 'CSV', icon: Table },
                { key: 'pdf' as const, label: 'PDF (Legacy)', icon: FileUp },
                { key: 'jpeg' as const, label: 'JPEG (Legacy)', icon: FileUp },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setExportType(tab.key)}
                  className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                    exportType === tab.key 
                      ? 'bg-cyan-500/10 border border-cyan-500/35 text-cyan-400 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.1)]' 
                      : 'text-slate-400 border border-transparent hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="size-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global Select All Toggle */}
        <div className="px-6 pt-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/30 cursor-pointer hover:bg-slate-900/60 transition">
            <input
              type="checkbox"
              checked={isAllSelectedGlobal}
              ref={el => { if (el) el.indeterminate = isPartialGlobal; }}
              onChange={handleSelectAll}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 size-4 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-200">เลือกทั้งหมด (Select All)</span>
              <p className="text-[10px] text-slate-400 mt-0.5">เลือกข้อมูลสถานีทั้งหมด {totalStations} รายการ</p>
            </div>
            {totalSelected > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                {totalSelected} / {totalStations}
              </span>
            )}
          </label>
        </div>

        {/* District list scroll container */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 min-h-[180px]">
          {districts.map(d => {
            const districtStations = data.filter(item => (item.district || "Unknown") === d);
            const keysInDistrict = districtStations.map(item => {
              const name = item.stationName || item.name || item.station || "";
              return `${d}|${name}`;
            });
            const selectedInDistrict = selectedExportStations.filter(k => keysInDistrict.includes(k));
            const isAllSelected = selectedInDistrict.length === districtStations.length && districtStations.length > 0;
            const isPartial = selectedInDistrict.length > 0 && !isAllSelected;
            const isExpanded = expandedDistricts.includes(d);

            return (
              <div 
                key={d}
                className={`rounded-xl border transition ${
                  isAllSelected 
                    ? 'border-cyan-500/30 bg-cyan-950/5' 
                    : 'border-slate-800 bg-slate-900/10'
                }`}
              >
                {/* Header of District Accordion */}
                <div className="flex items-center justify-between p-3">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => { if (el) el.indeterminate = isPartial; }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExportStations(prev => [...new Set([...prev, ...keysInDistrict])]);
                        } else {
                          setSelectedExportStations(prev => prev.filter(k => !keysInDistrict.includes(k)));
                        }
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 size-4 cursor-pointer"
                    />
                    <div className="truncate pr-2">
                      <span className={`text-xs font-bold transition ${isAllSelected ? 'text-cyan-400' : 'text-slate-200'}`}>
                        {d}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        ({selectedInDistrict.length}/{districtStations.length})
                      </span>
                    </div>
                  </label>
                  <button
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedDistricts(prev => prev.filter(item => item !== d));
                      } else {
                        setExpandedDistricts(prev => [...prev, d]);
                      }
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <ChevronDown className={`size-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Stations Details List */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-800/40 grid grid-cols-2 gap-1.5 animate-in slide-in-from-top-1 duration-150">
                    {districtStations.map(s => {
                      const name = s.stationName || s.name || s.station || "";
                      const key = `${d}|${name}`;
                      const isSelected = selectedExportStations.includes(key);

                      return (
                        <label 
                          key={key}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                            isSelected 
                              ? 'bg-cyan-500/5 border border-cyan-500/20 text-cyan-400' 
                              : 'hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExportStations(prev => [...prev, key]);
                              } else {
                                setSelectedExportStations(prev => prev.filter(k => k !== key));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 size-3.5 cursor-pointer"
                          />
                          <span className="text-[11px] font-medium truncate">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (exportType === 'txt') handleExportTXT(activeCategory, data);
              else if (exportType === 'csv') handleExportCSV(activeCategory, data);
              else if (exportType === 'pdf') handleExportPDF(activeCategory, data);
              else if (exportType === 'jpeg') handleExportJPEG(activeCategory, data);
            }}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:scale-[1.02] transition duration-200 active:scale-[0.98] cursor-pointer"
          >
            <Download className="size-3.5" />
            CONFIRM EXPORT
          </button>
        </div>

      </div>
    </div>
  );
}
