import React from 'react';

interface StationData {
    lat?: number;
    lon?: number;
    foundationProgress: number | string;
    poleInstallationProgress: number | string;
    electricProgress?: number | string;
    groundProgress?: number | string;
    feederProgress?: number | string;
    towerProgress?: number | string;
    radioProgress?: number | string;
}

const toNumber = (value: number | string | undefined) => parseFloat(String(value ?? 0)) || 0;

export default function ExportMapStatic({ stations, category = 'station' }: { stations: StationData[], category?: 'station' | 'client' }) {
    const isClient = category === 'client';
    const validPoints = stations
        .map(s => ({
            lat: toNumber(s.lat),
            lon: toNumber(s.lon),
            raw: s
        }))
        .filter(p => !isNaN(p.lat) && !isNaN(p.lon) && p.lat !== 0 && p.lon !== 0);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // ถ้ามี API Key และมีจุดพิกัด ให้แสดง Google Maps Static
    if (apiKey && validPoints.length > 0) {
        // Group markers by status
        let completelyDone: StationData[] = [];
        let notStarted: StationData[] = [];
        let inProgress: StationData[] = [];

        if (isClient) {
            completelyDone = stations.filter(s => 
                toNumber(s.electricProgress) >= 100 && 
                toNumber(s.groundProgress) >= 100 && 
                toNumber(s.feederProgress) >= 100 &&
                toNumber(s.towerProgress) >= 100 &&
                toNumber(s.radioProgress) >= 100
            );
            notStarted = stations.filter(s => 
                toNumber(s.electricProgress) === 0 && 
                toNumber(s.groundProgress) === 0 && 
                toNumber(s.feederProgress) === 0 &&
                toNumber(s.towerProgress) === 0 &&
                toNumber(s.radioProgress) === 0
            );
        } else {
            completelyDone = stations.filter(s => toNumber(s.foundationProgress) >= 100 && toNumber(s.poleInstallationProgress) >= 100);
            notStarted = stations.filter(s => toNumber(s.foundationProgress) === 0 && toNumber(s.poleInstallationProgress) === 0);
        }
        
        inProgress = stations.filter(s => !completelyDone.includes(s) && !notStarted.includes(s));

        const makeMarkerParam = (color: string, list: StationData[]) => {
            const pts = list.map(s => [toNumber(s.lat), toNumber(s.lon)]).filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0);
            if (pts.length === 0) return '';
            return `&markers=color:${color}|size:small|` + pts.map(p => `${p[0]},${p[1]}`).join('|');
        };

        const markersCmd = [
            makeMarkerParam('green', completelyDone),
            makeMarkerParam('orange', inProgress),
            makeMarkerParam('red', notStarted)
        ].join('');

        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=840x300&scale=2&maptype=roadmap${markersCmd}&key=${apiKey}`;
        const proxiedUrl = `/api/proxy-map?url=${encodeURIComponent(mapUrl)}`;

        return (
            <img
                src={proxiedUrl}
                alt="Static Map"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', filter: 'saturate(1.15) contrast(1.02)', opacity: 0.92 }}
                crossOrigin="anonymous"
            />
        );
    }

    // กรณีไม่มีจุดพิกัดเลย
    if (validPoints.length === 0) {
        return (
            <div style={{ backgroundColor: 'rgba(10,10,15,0.88)', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid rgba(0,240,255,0.18)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" style={{ marginBottom: '8px', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.45))' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>No Coordinates Found</div>
            </div>
        );
    }

    // กรณีไม่มี API Key แต่มีพิกัดสถานี -> แสดง Tactical Incident Map (Cyberpunk Neon Grid)
    // หาพิกัดขอบเขต
    const lats = validPoints.map(p => p.lat);
    const lons = validPoints.map(p => p.lon);
    
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLon = Math.min(...lons);
    let maxLon = Math.max(...lons);

    // ป้องกันกรณีพิกัดเดียว หรือเท่ากันหมด โดยเพิ่ม padding
    const latSpan = maxLat - minLat;
    const lonSpan = maxLon - minLon;
    const paddingCoeff = 0.25; // 25% padding

    if (latSpan === 0) {
        minLat -= 0.04;
        maxLat += 0.04;
    } else {
        minLat -= latSpan * paddingCoeff;
        maxLat += latSpan * paddingCoeff;
    }

    if (lonSpan === 0) {
        minLon -= 0.04;
        maxLon += 0.04;
    } else {
        minLon -= lonSpan * paddingCoeff;
        maxLon += lonSpan * paddingCoeff;
    }

    // สเปคพื้นที่สำหรับวาด SVG (ขนาดภายใน)
    const svgWidth = 840;
    const svgHeight = 320;
    const mapPadding = 45; // เว้นขอบเขตสำหรับแสดง Grid Labels

    // ฟังก์ชันแปลงพิกัด Lat/Lon เป็น (x, y) ในกรอบภาพ
    const getX = (lon: number) => {
        const pct = (lon - minLon) / (maxLon - minLon);
        return mapPadding + pct * (svgWidth - mapPadding * 2);
    };

    const getY = (lat: number) => {
        // ในระบบ SVG แกน Y ชี้ลงล่าง ยิ่ง Lat สูง ค่า Y ยิ่งน้อย
        const pct = (lat - minLat) / (maxLat - minLat);
        return svgHeight - mapPadding - pct * (svgHeight - mapPadding * 2);
    };

    // คำนวณเส้นกริดพิกัดคร่าว ๆ
    const gridCols = 5;
    const gridRows = 4;
    const gridLines: React.ReactNode[] = [];

    // เส้นกริดแนวตั้ง (Longitude)
    for (let i = 0; i < gridCols; i++) {
        const pct = i / (gridCols - 1);
        const lonVal = minLon + pct * (maxLon - minLon);
        const x = mapPadding + pct * (svgWidth - mapPadding * 2);
        gridLines.push(
            <g key={`v-grid-${i}`}>
                <line x1={x} y1={mapPadding} x2={x} y2={svgHeight - mapPadding} stroke="rgba(0, 240, 255, 0.075)" strokeWidth="1" strokeDasharray="4,4" />
                <text x={x} y={svgHeight - 12} fill="#64748B" fontSize="8" textAnchor="middle" fontWeight="bold">
                    {lonVal.toFixed(3)}°E
                </text>
            </g>
        );
    }

    // เส้นกริดแนวนอน (Latitude)
    for (let i = 0; i < gridRows; i++) {
        const pct = i / (gridRows - 1);
        const latVal = minLat + pct * (maxLat - minLat);
        const y = svgHeight - mapPadding - pct * (svgHeight - mapPadding * 2);
        gridLines.push(
            <g key={`h-grid-${i}`}>
                <line x1={mapPadding} y1={y} x2={svgWidth - mapPadding} y2={y} stroke="rgba(0, 240, 255, 0.075)" strokeWidth="1" strokeDasharray="4,4" />
                <text x={12} y={y + 3} fill="#64748B" fontSize="8" textAnchor="start" fontWeight="bold">
                    {latVal.toFixed(3)}°N
                </text>
            </g>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '190px', background: '#09090D', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.18)', overflow: 'hidden' }}>
            {/* พื้นหลังแบบเรดาร์ตารางนีออน */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.02) 1px, transparent 1px)', backgroundSize: '15px 15px', pointerEvents: 'none' }} />
            
            {/* ลายเรืองแสงขอบนอกสไตล์ Tactical Map */}
            <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '3px', background: 'rgba(10,10,15,0.85)', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0, 255, 136, 0.25)', fontSize: '8px', color: '#00FF88', fontWeight: 900, fontFamily: 'monospace' }}>
                <div>TACTICAL OVERVIEW</div>
                <div style={{ color: '#00F0FF', fontSize: '7px' }}>SRC: INTERN GPS</div>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ display: 'block' }}>
                {/* กรอบแผนที่ (Tactical Boundary) */}
                <rect x={mapPadding} y={mapPadding} width={svgWidth - mapPadding * 2} height={svgHeight - mapPadding * 2} fill="none" stroke="rgba(0, 255, 136, 0.12)" strokeWidth="1.5" />
                
                {/* เส้นกริดพิกัด */}
                {gridLines}

                {/* วาดจุด Marker เรืองแสงตามสถานะ */}
                {validPoints.map((point, index) => {
                    const isDone = toNumber(point.raw.foundationProgress) >= 100 && toNumber(point.raw.poleInstallationProgress) >= 100;
                    // ดึงสีที่แมตช์ตามสถานะ
                    const markerColor = isDone ? '#00FF88' : '#FF00A0'; // เขียว = เสร็จสิ้น, แดง = ขัดข้อง
                    const glowId = `glow-${index}`;

                    const cx = getX(point.lon);
                    const cy = getY(point.lat);

                    return (
                        <g key={`marker-${index}`}>
                            <defs>
                                <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={markerColor} stopOpacity="0.45" />
                                    <stop offset="100%" stopColor={markerColor} stopOpacity="0" />
                                </radialGradient>
                            </defs>
                            
                            {/* รัศมีเรืองแสงแบบคลื่นเรดาร์ */}
                            <circle cx={cx} cy={cy} r="18" fill={`url(#${glowId})`} />
                            
                            {/* วงแหวนสัญญาณเตือน */}
                            <circle cx={cx} cy={cy} r="6" fill="none" stroke={markerColor} strokeWidth="1" opacity="0.8">
                                <animate attributeName="r" values="3;9" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
                            </circle>

                            {/* จุดกึ่งกลางแกน */}
                            <circle cx={cx} cy={cy} r="3.5" fill={markerColor} stroke="#0A0A0F" strokeWidth="1" />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
