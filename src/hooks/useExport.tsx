import { useState } from 'react';
import { toast } from 'sonner';

export const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr || dateStr === "-" || dateStr === "") return "-";
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const yy = y.slice(-2);
  return `${d}/${m}/${yy}`;
};

export type ExportCategory = 'station' | 'client' | 'incident';
export type ExportType = 'pdf' | 'txt' | 'jpeg' | 'csv';

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('txt');
  const [selectedExportStations, setSelectedExportStations] = useState<string[]>([]);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);

  const handleExportTXT = (activeCategory: ExportCategory, data: any[]) => {
    setIsExportModalOpen(false);
    
    // Filter selected items based on matching key (district|name)
    const filteredExportData = data.filter(d => {
      const name = d.stationName || d.name || d.station || "";
      const district = d.district || d.province || "Unknown";
      return selectedExportStations.includes(`${district}|${name}`);
    });

    if (filteredExportData.length === 0) {
      toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export");
      return;
    }

    // Group items by district
    const grouped = filteredExportData.reduce((acc, item) => {
      const district = item.district || item.province || "Unknown";
      if (!acc[district]) acc[district] = [];
      acc[district].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    // Header Logic
    const districtNames = Object.keys(grouped).map(d => `อ.${d}`);
    let districtsStr = "";
    if (districtNames.length === 1) districtsStr = `"${districtNames[0]}"`;
    else if (districtNames.length === 2) districtsStr = `"${districtNames[0]}" และ "${districtNames[1]}"`;
    else if (districtNames.length > 2) {
      const last = districtNames.pop();
      districtsStr = districtNames.map(d => `"${d}"`).join(", ") + ` และ "${last}"`;
    }

    const commonPoleHeight = filteredExportData[0]?.poleHeight || "9 เมตร";
    const commonProvince = filteredExportData[0]?.province || 'กรุงเทพมหานคร';

    let text = `${dateStr}\n`;
    if (activeCategory === 'station') {
      text += `รายงานความคืบหน้างานก่อสร้างฐานรากและติดตั้งเสาสัญญาณ ${commonPoleHeight} สถานีลูกข่าย ${districtsStr} จ.${commonProvince}\n\n`;
    } else if (activeCategory === 'client') {
      text += `รายงานการติดตั้งระบบลูกข่าย (${districtsStr}) จ.${commonProvince}\n\n`;
    } else {
      text += `รายงานเหตุขัดข้องและการจัดการเหตุเสีย (${districtsStr}) จ.${commonProvince}\n\n`;
    }

    // Summary calculations (based on data in the same province)
    const provinceData = data.filter(d => (d.province || d.provinceName) === commonProvince);
    const totalStations = provinceData.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let meterRequestCount = 0;
    let meterInstalledCount = 0;
    let radioInstalledCount = 0;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    provinceData.forEach(item => {
      if (activeCategory === 'incident') {
        const status = item.repair_status || item.status || "new";
        if (status === "เสร็จสิ้น" || status === "resolved" || status === "closed") completedCount++;
        else if (status === "กำลังดำเนินการ" || status === "in_progress" || status === "acknowledged") inProgressCount++;
        else notStartedCount++;

        const priority = String(item.priority || item.severity || "low").toLowerCase();
        if (priority === "critical") criticalCount++;
        else if (priority === "high") highCount++;
        else if (priority === "medium") mediumCount++;
        else lowCount++;
      } else {
        let progress: number;
        if (activeCategory === 'client') {
          progress = (parseFloat(item.electricProgress || 0) + parseFloat(item.groundProgress || 0) + parseFloat(item.feederProgress || 0)) / 3;
          if (Number(item.radioProgress) === 100) radioInstalledCount++;
        } else {
          progress = (parseFloat(item.foundationProgress || 0) + parseFloat(item.poleInstallationProgress || 0)) / 2;
        }

        if (progress >= 100) completedCount++;
        else if (progress > 0) inProgressCount++;
        else notStartedCount++;

        if (item.meterRequest && item.meterRequest !== "ยังไม่ได้ยื่น") {
          meterRequestCount++;
        }

        if (item.meterInstalled) {
          meterInstalledCount++;
        }
      }
    });

    if (activeCategory === 'client') {
      text += `จำนวนทั้งหมด ${totalStations} สถานี\n`;
      text += `1. ติดตั้งระบบลูกข่าย\n`;
      text += `   - ติดตั้งระบบ ลข.แล้ว ${completedCount} สถานี\n`;
      text += `   - อยู่ระหว่างติดตั้ง ${inProgressCount} สถานี\n`;
      text += `   - ยังไม่ได้ติดตั้ง ${notStartedCount} สถานี\n`;
      text += `2. วางเครื่องวิทยุชนิดประจำที่\n`;
      text += `   - วางเครื่องวิทยุแล้วเสร็จ ${radioInstalledCount} สถานี\n`;
      text += `3. งานมิเตอร์ไฟฟ้า\n`;
      text += `   - ยื่นขอมิเตอร์แล้ว ${meterRequestCount} สถานี\n`;
      text += `   - ติดตั้งมิเตอร์แล้ว ${meterInstalledCount} สถานี\n`;
    } else if (activeCategory === 'station') {
      text += `จำนวนทั้งหมด ${totalStations} สถานี\n`;
      text += `  - ติดตั้งแล้วเสร็จ ${completedCount} สถานี\n`;
      text += `  - อยู่ระหว่างติดตั้ง ${inProgressCount} สถานี\n`;
      text += `  - ยังไม่ได้ติดตั้ง ${notStartedCount} สถานี\n`;
      text += `  - ยื่นขอมิเตอร์ ${meterRequestCount} สถานี\n`;
      text += `  - ติดตั้งมิเตอร์แล้ว ${meterInstalledCount} สถานี\n`;
    } else {
      text += `จำนวนเหตุเสียทั้งหมด ${totalStations} รายการ\n`;
      text += `  - ดำเนินการแก้ไขเสร็จสิ้น: ${completedCount} รายการ\n`;
      text += `  - อยู่ระหว่างดำเนินการแก้ไข: ${inProgressCount} รายการ\n`;
      text += `  - รอการดำเนินการ: ${notStartedCount} รายการ\n`;
      text += `ลำดับความสำคัญ:\n`;
      text += `  - วิกฤต (Critical): ${criticalCount} รายการ\n`;
      text += `  - สูง (High): ${highCount} รายการ\n`;
      text += `  - ปานกลาง (Medium): ${mediumCount} รายการ\n`;
      text += `  - ต่ำ (Low): ${lowCount} รายการ\n`;
    }

    text += `=========================================\n\n`;

    const groupedEntries = Object.entries(grouped) as [string, any[]][];
    groupedEntries.forEach(([district, items], gIdx) => {
      text += `📍 อำเภอ${district}\n\n`;
      items.forEach((item, idx) => {
        const name = item.stationName || item.name || item.station || "";
        if (activeCategory === 'client') {
          text += `[${idx + 1}]. ${name}\n`;
          text += `   - พิกัด: ${item.lat || item.latitude || "-"}, ${item.lon || item.longitude || "-"}\n`;
          text += `   - ความสูงเสา: ${item.poleHeight || "9 เมตร"}\n`;
          text += `   - ระบบไฟฟ้า: ${item.electricProgress || 0}% (ระยะสาย Main: ${item.electricMain || "-"})\n`;
          text += `   - ระบบกราวด์: ${item.groundProgress || 0}% (AC: ${item.groundAC || "-"} Ω | Equip: ${item.groundEquip || "-"} Ω)\n`;
          text += `   - สาย Feeder: ${item.feederProgress || 0}% (Yagi No: ${item.yagiNo || "-"} | SN: ${item.sn || "-"} | ระยะ feed: ${item.feedDistance || "-"})\n`;
          text += `   - การติดตั้งอุปกรณ์บนเสา (Yagi): ${item.towerProgress || 0}%\n`;
          text += `   - การติดตั้งเครื่องวิทยุ: ${item.radioProgress || 0}% (SN: ${item.radioSN || "-"})\n`;
          text += `   - แบตเตอรี่ (SN): ${item.batterySN || "-"}\n`;
          text += `   - RSSI ${item.rssi || "-"} dBm.\n`;
          text += `   - ขาติดตั้ง: ${item.mountType || "-"} | องศา: ${item.angle || "-"} | Test Feeder: ${item.testFeeder || "-"}\n`;
          text += `   - ยื่นขอมิเตอร์: ${item.meterRequest || "ยังไม่ได้ยื่น"}\n`;
          text += `   - มิเตอร์: ${item.meterInstalled ? "ติดตั้งแล้ว" : "ยังไม่ได้ติดตั้ง"}\n`;
          if (item.peaUserNo) text += `   - หมายเลขผู้ใช้ไฟฟ้า: ${item.peaUserNo}\n`;
          if (item.meterNo) text += `   - หมายเลขมิเตอร์ไฟฟ้า: ${item.peaUserNo}\n`;
          text += `   - วันที่: ${formatDateDisplay(item.startDate)} - ${formatDateDisplay(item.endDate)}\n`;
          text += `   - หมายเหตุ: ${item.remark || "-"}\n`;
        } else if (activeCategory === 'station') {
          const baseType = item.base_type || item.baseType || "";
          text += `[${idx + 1}]. ${name}`;
          if (item.poleHeight) text += ` (${item.poleHeight})`;
          if (baseType) text += ` ${baseType}`;
          if (item.type) text += ` ${item.type}`;
          text += `\n`;
          text += `งานก่อสร้างฐานราก: ${item.foundationProgress || 0}%\n`;
          text += `งานติดตั้งโครงเสา: ${item.poleInstallationProgress || 0}%\n`;
          text += `** หมายเหตุ: ${item.remark || "-"}\n`;
          text += `เริ่มงาน: ${formatDateDisplay(item.startDate)}\n`;
          text += `เสร็จงาน: ${formatDateDisplay(item.endDate)}\n`;
        } else {
          text += `[${idx + 1}]. หมายเลขแจ้งเสีย: ${item.incident_no || item.id || "-"}\n`;
          text += `   - สถานี: ${name}\n`;
          if (item.latitude || item.longitude) {
            text += `   - พิกัด: ${item.latitude || "-"}, ${item.longitude || "-"}\n`;
          }
          text += `   - ลำดับความสำคัญ: ${(item.priority || item.severity || "LOW").toUpperCase()}\n`;
          text += `   - อาการเสีย: ${item.issue_description || item.title || item.description || "-"}\n`;
          text += `   - ผู้แจ้งเหตุ: ${item.reporter || "-"}\n`;
          text += `   - ผู้รับผิดชอบ: ${item.assignee || "-"}\n`;
          text += `   - สถานะการดำเนินการ: ${item.repair_status || item.status || "-"}\n`;
          text += `   - เวลาที่แจ้งเหตุ: ${item.reported_at || item.createdAt ? new Date(item.reported_at || item.createdAt).toLocaleString('th-TH') : "-"}\n`;
          text += `   - กำหนดเสร็จ (SLA Due): ${item.sla_due_at || item.updatedAt ? new Date(item.sla_due_at || item.updatedAt).toLocaleString('th-TH') : "-"}\n`;
          if (item.penalty_amount_baht) {
            text += `   - ค่าปรับคงค้างสะสม: ${item.penalty_amount_baht} บาท\n`;
          }
          text += `   - หมายเหตุ/ข้อมูลเพิ่มเติม: ${item.remark || "-"}\n`;
        }

        if (idx < items.length - 1) {
          text += `\n---\n\n`;
        }
      });

      if (gIdx < groupedEntries.length - 1) {
        text += `\n=========================================\n\n`;
      }
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${activeCategory}_${dateStr}.txt`;
    link.click();
    
    toast.success("Export TXT สำเร็จ");
  };

  const handleExportCSV = (activeCategory: ExportCategory, data: any[]) => {
    setIsExportModalOpen(false);
    
    const filteredExportData = data.filter(d => {
      const name = d.stationName || d.name || d.station || "";
      const district = d.district || d.province || "Unknown";
      return selectedExportStations.includes(`${district}|${name}`);
    });

    if (filteredExportData.length === 0) {
      toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export");
      return;
    }

    let csvContent = "";
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    if (activeCategory === 'incident') {
      const headers = [
        "หมายเลขแจ้งเสีย",
        "สถานี",
        "อำเภอ",
        "จังหวัด",
        "ละติจูด",
        "ลองจิจูด",
        "ลำดับความสำคัญ",
        "อาการเสีย",
        "ผู้แจ้งเหตุ",
        "เบอร์โทรผู้แจ้ง",
        "ผู้รับผิดชอบ",
        "สถานะ",
        "วันที่แจ้งเหตุ",
        "กำหนดเสร็จ (SLA Due)",
        "ค่าปรับคงค้างสะสม (บาท)",
        "หมายเหตุ"
      ];
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      filteredExportData.forEach(item => {
        const name = item.stationName || item.name || item.station || "";
        const row = [
          item.incident_no || item.id || "",
          name,
          item.district || "",
          item.province || "",
          item.latitude !== undefined && item.latitude !== null ? String(item.latitude) : "",
          item.longitude !== undefined && item.longitude !== null ? String(item.longitude) : "",
          item.priority || item.severity || "",
          item.issue_description || item.title || item.description || "",
          item.reporter || "",
          item.reporter_phone || item.phone || "",
          item.assignee || "",
          item.repair_status || item.status || "",
          item.reported_at || item.createdAt ? new Date(item.reported_at || item.createdAt).toLocaleString('th-TH') : "",
          item.sla_due_at || item.updatedAt ? new Date(item.sla_due_at || item.updatedAt).toLocaleString('th-TH') : "",
          item.penalty_amount_baht !== undefined && item.penalty_amount_baht !== null ? String(item.penalty_amount_baht) : "0",
          item.remark || ""
        ];
        csvContent += row.map(r => `"${String(r).replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else if (activeCategory === 'client') {
      const headers = [
        "สถานี",
        "อำเภอ",
        "จังหวัด",
        "ละติจูด",
        "ลองจิจูด",
        "ความสูงเสา",
        "ระบบไฟฟ้า (%)",
        "ระยะสาย Main (ม.)",
        "ระบบกราวด์ (%)",
        "กราวด์ AC (Ω)",
        "กราวด์ Equip (Ω)",
        "สาย Feeder (%)",
        "Yagi No",
        "SN Yagi",
        "ระยะ Feed (ม.)",
        "ติดตั้งอุปกรณ์บนเสา (%)",
        "ติดตั้งเครื่องวิทยุ (%)",
        "SN วิทยุ",
        "SN แบตเตอรี่",
        "RSSI (dBm)",
        "ขาติดตั้ง",
        "องศา",
        "Test Feeder",
        "ยื่นขอมิเตอร์",
        "ติดตั้งมิเตอร์",
        "หมายเลขผู้ใช้ไฟฟ้า",
        "หมายเลขมิเตอร์ไฟฟ้า",
        "เริ่มงาน",
        "เสร็จงาน",
        "หมายเหตุ"
      ];
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      filteredExportData.forEach(item => {
        const name = item.stationName || item.name || item.station || "";
        const row = [
          name,
          item.district || "",
          item.province || "",
          item.lat || item.latitude || "",
          item.lon || item.longitude || "",
          item.poleHeight || "9 เมตร",
          item.electricProgress || "0",
          item.electricMain || "",
          item.groundProgress || "0",
          item.groundAC || "",
          item.groundEquip || "",
          item.feederProgress || "0",
          item.yagiNo || "",
          item.sn || "",
          item.feedDistance || "",
          item.towerProgress || "0",
          item.radioProgress || "0",
          item.radioSN || "",
          item.batterySN || "",
          item.rssi || "",
          item.mountType || "",
          item.angle || "",
          item.testFeeder || "",
          item.meterRequest || "ยังไม่ได้ยื่น",
          item.meterInstalled ? "ติดตั้งแล้ว" : "ยังไม่ได้ติดตั้ง",
          item.peaUserNo || "",
          item.meterNo || "",
          formatDateDisplay(item.startDate),
          formatDateDisplay(item.endDate),
          item.remark || ""
        ];
        csvContent += row.map(r => `"${String(r).replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else {
      const headers = [
        "สถานี",
        "อำเภอ",
        "จังหวัด",
        "ความสูงเสา",
        "Base Type",
        "Type",
        "ความคืบหน้าฐานราก (%)",
        "ความคืบหน้าเสา (%)",
        "เริ่มงาน",
        "เสร็จงาน",
        "หมายเหตุ"
      ];
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      filteredExportData.forEach(item => {
        const name = item.stationName || item.name || item.station || "";
        const baseType = item.base_type || item.baseType || "";
        const row = [
          name,
          item.district || "",
          item.province || "",
          item.poleHeight || "9 เมตร",
          baseType,
          item.type || "",
          item.foundationProgress || "0",
          item.poleInstallationProgress || "0",
          formatDateDisplay(item.startDate),
          formatDateDisplay(item.endDate),
          item.remark || ""
        ];
        csvContent += row.map(r => `"${String(r).replace(/"/g, '""')}"`).join(",") + "\n";
      });
    }

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${activeCategory}_${dateStr}.csv`;
    link.click();
    
    toast.success("Export CSV สำเร็จ");
  };

  const handleExportPDF = async (activeCategory: ExportCategory, data: any[]) => {
    setIsExportModalOpen(false);
    if (isExporting) return;
    setIsExporting(true);
    try {
      const [{ toJpeg }, jsPDFModule, { createRoot }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
        import('react-dom/client'),
      ]);
      const jsPDF = jsPDFModule.default;
      await document.fonts.ready;

      // Filter selected items based on matching key (district|name)
      const filtered = data.filter(d => {
        const name = d.stationName || d.name || d.station || "";
        const district = d.district || d.province || "Unknown";
        return selectedExportStations.includes(`${district}|${name}`);
      });

      if (filtered.length === 0) {
        toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export");
        setIsExporting(false);
        return;
      }

      const groupedToExport = filtered.reduce((acc, item) => {
        const district = item.district || "Unknown";
        if (!acc[district]) acc[district] = [];
        acc[district].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const districtKeys = Object.keys(groupedToExport).sort();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let isFirst = true;

      const mod = await import('@/components/ExportIncidentReport');
      const ReportComponent = mod.default;

      for (const d of districtKeys) {
        const stationsList = groupedToExport[d];
        const container = document.createElement('div');
        Object.assign(container.style, { position: 'fixed', top: '0', left: '-2000px', width: '1122px', height: '794px', zIndex: '-1000', backgroundColor: '#0A0A0F' });
        document.body.appendChild(container);
        const root = createRoot(container);

        await new Promise<void>(resolve => {
          root.render(<ReportComponent district={d} incidents={stationsList} allIncidents={data} />);
          setTimeout(resolve, 800);
        });

        const el = container.firstChild as HTMLElement;
        const dataUrl = await toJpeg(el, { quality: 1.0, backgroundColor: '#0A0A0F', width: 1122, height: 794, pixelRatio: 6.25 });

        if (!isFirst) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210);
        isFirst = false;

        root.unmount();
        document.body.removeChild(container);
      }

      const fileName = `report_${activeCategory}_${new Date().getTime()}.pdf`;
      pdf.save(fileName);
      toast.success('Export PDF สำเร็จ');
    } catch (error: any) {
      console.error(error);
      toast.error('Export ล้มเหลว: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJPEG = async (activeCategory: ExportCategory, data: any[]) => {
    setIsExportModalOpen(false);
    if (isExporting) return;
    setIsExporting(true);
    try {
      const [{ toJpeg }, { createRoot }] = await Promise.all([
        import('html-to-image'),
        import('react-dom/client'),
      ]);
      await document.fonts.ready;

      // Filter selected items based on matching key (district|name)
      const filtered = data.filter(d => {
        const name = d.stationName || d.name || d.station || "";
        const district = d.district || d.province || "Unknown";
        return selectedExportStations.includes(`${district}|${name}`);
      });

      if (filtered.length === 0) {
        toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export");
        setIsExporting(false);
        return;
      }

      const groupedToExport = filtered.reduce((acc, item) => {
        const district = item.district || "Unknown";
        if (!acc[district]) acc[district] = [];
        acc[district].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const districtsToExport = Object.keys(groupedToExport).sort();
      const mod = await import('@/components/ExportIncidentReport');
      const ReportComponent = mod.default;

      for (const d of districtsToExport) {
        const stationsList = groupedToExport[d];
        const container = document.createElement('div');
        Object.assign(container.style, { position: 'fixed', top: '0', left: '-2000px', width: '1122px', height: '794px', zIndex: '-1000', backgroundColor: '#0A0A0F' });
        document.body.appendChild(container);
        const root = createRoot(container);

        await new Promise<void>(res => {
          root.render(<ReportComponent district={d} incidents={stationsList} allIncidents={data} />);
          setTimeout(res, 800);
        });

        const el = container.firstChild as HTMLElement;
        const dataUrl = await toJpeg(el, { quality: 1.0, backgroundColor: '#0A0A0F', width: 1122, height: 794, pixelRatio: 6.25 });
        const link = document.createElement('a');
        link.download = `report_${d}_${new Date().getTime()}.jpg`;
        link.href = dataUrl;
        link.click();

        root.unmount();
        document.body.removeChild(container);
      }
      toast.success('Export JPEG สำเร็จ');
    } catch (error: any) {
      console.error(error);
      toast.error('Export ล้มเหลว: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    setIsExporting,
    isExportModalOpen,
    setIsExportModalOpen,
    exportType,
    setExportType,
    selectedExportStations,
    setSelectedExportStations,
    expandedDistricts,
    setExpandedDistricts,
    handleExportTXT,
    handleExportPDF,
    handleExportJPEG,
    handleExportCSV
  };
}
