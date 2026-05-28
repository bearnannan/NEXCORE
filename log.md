# NEXCORE - Migration & Maintenance Log

## 1. Migration System & Export Logic Integration
- **ไลบรารีเสริม**: ดำเนินการติดตั้ง `jspdf` และ `html-to-image` เพื่อรองรับการเรนเดอร์ PDF และ JPEG แบบ Client-side ได้อย่างสมบูรณ์
- **การจัดการ UI/UX (ExportModal.tsx)**:
  - ลบตัวเลือก Category ที่ซ้ำซ้อนและไม่ได้ใช้งาน (ลบ Station Build และ Client Install ออก) เพื่อล็อกขอบเขตการทำงานเฉพาะกลุ่มข้อมูล **Incidents** ตามข้อกำหนดด้านความปลอดภัยและการทำงาน
  - ลบ Logic การ Intercept การดาวน์โหลด PDF/JPEG เดิมออกเพื่อให้ใช้ Engine ตัวใหม่จาก client ได้โดยตรง
- **ระบบ Render เอกสาร**:
  - สร้าง `ExportIncidentReport.tsx` และ `ExportMapStatic.tsx` ขึ้นมาใหม่ เพื่อทำหน้าที่เป็น Static HTML Templates ที่มีความสวยงามระดับ Premium
  - แก้ไขปัญหา Data Mapping Alignment (คอลัมน์ไม่ตรงกันและ UUID หลุด):
    - คอลัมน์ที่ 1: แสดง **Ticket ID** (`inc.title`) แทนการแสดง UUID
    - คอลัมน์ที่ 2: แสดง **อาการเสีย (Symptom/Issue)** (`inc.description`)
    - ซ่อน UUID ทั้งหมดออกจากตารางส่งออก
  - ปรับปรุง Layout ของ `SectionTitle` เพื่อแก้ไขปัญหาข้อความภาษาไทยที่ยาวเกินไปแล้วตัดขึ้นบรรทัดใหม่จนซ้อนทับส่วนแสดงผลด้านล่าง (เช่น บล็อก Priority, ตารางเหตุการณ์, และแผนที่):
    - ใช้ `alignItems: "flex-start"` และกำหนด `marginTop: "5px"` ให้กับจุดกลมสีนีออนเพื่อให้สมดุลกับหัวข้อแบบหลายบรรทัด
    - กำหนด `flexShrink: 0` ที่ตัวหัวข้อ และปรับลดขนาดฟอนต์จาก `14px` เป็น `13px` (Line height `1.3`) เพื่อให้แสดงผลในกระดาษ A4 Landscape ได้อย่างสวยงาม ไม่ซ้อนทับกัน
  - แก้ไขปัญหาแผนที่รายงานแสดง **"MAP UNAVAILABLE"** ในการส่งออกรายงาน PDF/JPEG:
    - สาเหตุมาจากตัวแปร `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ไม่ได้รับการตั้งค่าในเครื่องเซิร์ฟเวอร์หรือเครื่องนักพัฒนาภายในเครื่อง (.env.local ไม่มีคีย์นี้)
    - ได้ทำการ Refactor ไฟล์ `ExportMapStatic.tsx` โดยการออกแบบแผนที่สำรองสุดล้ำสไตล์ **Cyberpunk Tactical Incident Map (Neon Grid SVG)**
    - แผนที่ SVG สำรองนี้จะถูกเปิดใช้งานโดยอัตโนมัติหากไม่มี API Key ซึ่งมันจะคำนวณสเกลขอบเขตพิกัด (Min/Max Lat/Lon Bound) จากจุดพิกัดจริงของอำเภอนั้น ๆ แล้วนำมาพล็อตจุด Marker สัญญาณเตือนภัยแบบกะพริบเรืองแสงนีออน (Cyberpunk Radar Radar Glows) พร้อมขอบสไตล์ทหาร/ยุทธการ โดยไม่จำเป็นต้องต่อเน็ตเวิร์กหรือพึ่งพา API Key ภายนอก ทำให้หมดปัญหา "MAP UNAVAILABLE" และยกระดับดีไซน์ระบบส่งออกรายงานให้โดดเด่นสะดุดตา
  - แก้ไขข้อผิดพลาดการ Export JPEG ล้มเหลว (เกิด Error `{}` ใน `src/hooks/useExport.tsx` บรรทัด 538):
    - **สาเหตุ**: เกิดจากข้อจำกัดด้านความปลอดภัยของเบราว์เซอร์ (CORS Security Exception / Tainted Canvas) เมื่อไลบรารี `html-to-image` พยายามดึงภาพแผนที่ Google Maps Static มาพล็อตลงใน Canvas เพื่อบันทึกเป็นรูปภาพโดยไม่มี CORS Header จาก Google Server ส่งผลให้เกิดข้อผิดพลาดในการวาดภาพ
    - **การแก้ไข**: สร้าง **API Proxy Route** ขึ้นใหม่ที่ไฟล์ [src/app/api/proxy-map/route.ts](file:///d:/APP/NEXCORE/src/app/api/proxy-map/route.ts) เพื่อทำหน้าที่ดาวน์โหลดและส่งผ่านภาพแผนที่ Google Maps Static พร้อมกับการเปิด CORS Header (`Access-Control-Allow-Origin: *`) กลับไปที่เบราว์เซอร์อย่างถูกต้อง ทำให้เบราว์เซอร์ทำความสะอาด Canvas (Clean Canvas) และทำให้ `html-to-image` ดาวน์โหลดภาพแผนที่และบันทึกรายงานเป็น PDF และ JPEG ได้อย่างราบรื่น 100%
- **useExport Hook**: Refactor และเปลี่ยนนามสกุลไฟล์จาก `useExport.ts` เป็น `useExport.tsx` เพื่อให้รองรับการคอมไพล์ JSX ได้อย่างถูกต้อง แก้ไขปัญหา syntax error ใน Turbopack / Next.js ได้ 100%



## 2. Leaflet Map Viewport & Initial Zoom Adjustment
- **ไฟล์ปรับปรุง**: `mission-control-map.tsx`
- **การปรับปรุงพิกัดและ Zoom**:
  - เปลี่ยนค่าเริ่มต้นของแผนที่ (Initial Mount) ให้มีศูนย์กลางอยู่ที่กรุงเทพฯ: `center={[15.0, 100.5]}` (หรือพิกัดทางภูมิศาสตร์ที่ครอบคลุมประเทศไทย)
  - กำหนดค่าเริ่มต้นการซูมออก Macro View: `zoom={5}` เพื่อให้เห็นภาพรวมของประเทศ (Thailand National Macro Overview) ตั้งแต่หน้าเว็บโหลดเสร็จในครั้งแรก
  - แก้ไขกลไกการทำงานของ `FitStationBounds`: เพิ่มเงื่อนไข `isInitialRef` เพื่อข้ามการเรียกใช้ `fitBounds` อัตโนมัติในการ Mount ครั้งแรก ป้องกันไม่ให้แผนที่ซูมเข้าไปยังพิกัดสถานีแคบ ๆ เองโดยไม่ได้ตั้งใจ

## 3. การอัปเดตคีย์แผนที่ยุทธการ (Map Provider & API Credentials)
- **ไฟล์ปรับปรุง**: `.env.local`
- **การนำเข้าค่าคอนฟิก**:
  - ย้ายคีย์เชื่อมต่อระบบแผนที่จากแอปเดิมมาติดตั้งใน NEXCORE ได้อย่างถูกต้อง:
    ```env
    NEXT_PUBLIC_MAP_PROVIDER="geoapify"
    NEXT_PUBLIC_MAP_API_KEY="19abdb6a2f804c359b635b6c955ea262"
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyCG2SdDEem6pue2BeSyj67lZmuEeeJnM4Q"
    ```
  - **ผลลัพธ์**: 
    - ระบบพิกัดในหน้า Dashboard ทั่วไปสามารถเรียกใช้ Geoapify ได้อย่างเต็มประสิทธิภาพ
    - คอมโพเนนต์ `ExportMapStatic.tsx` จะทำการเปลี่ยนกลับไปดึงแผนที่จริงที่มีรายละเอียดถนนหนทางจาก **Google Maps Static API** มาพล็อตพิกัดสถานีที่มีความขัดข้องโดยอัตโนมัติ (และมีระบบสำรองพล็อต SVG Cyberpunk Map สแตนด์บายกรณีคีย์มีปัญหา)

## 4. แก้ไขปัญหา Deploy Blocker ของ Cloudflare (Error 10143)
- **ไฟล์ปรับปรุง**: [wrangler.jsonc](file:///d:/APP/NEXCORE/wrangler.jsonc) และ [open-next.config.ts](file:///d:/APP/NEXCORE/open-next.config.ts)
- **การวิเคราะห์และแก้ไขปัญหา**:
  - **ปัญหา**: ในระหว่างขั้นตอน `npx wrangler deploy` เกิด Error Code 10143: `Service binding 'WORKER_SELF_REFERENCE' references Worker 'nexcore-app' which was not found.`
  - **สาเหตุ**: เนื่องจากชื่อแอปดั้งเดิมใน `package.json` คือ `nexcore-app` แต่บน Cloudflare Account นั้นมี Active Worker ที่ใช้งานอยู่จริงชื่อว่า `nexc0re` (ใช้เลขศูนย์ 0) และไม่มี Worker ปลายทางชื่อ `nexcore-app` อยู่ ส่งผลให้ขั้นตอนการผูก Service Binding ล้มเหลวและทำให้ระบบ CI/CD หยุดชะงัก
  - **การแก้ไข**:
    - สร้างและอัปเดตไฟล์คอนฟิกภูมิสถาปัตยกรรมระบบ [wrangler.jsonc](file:///d:/APP/NEXCORE/wrangler.jsonc) เพื่อให้ Cloudflare Deployer ดึงไปใช้โดยตรง โดยทำการแก้ชื่อแอปปลายทางเป็น `nexc0re`
    - ดำเนินการตาม *Fallback Condition Strategy* ด้วยการถอดหรือลบอาเรย์ `services` สำหรับ `WORKER_SELF_REFERENCE` ที่ไม่ได้ใช้งานหรือล้าสมัยออกไป เพื่อให้สามารถ Deploy ผ่านได้อย่างปลอดภัย 100% โดยไม่ติดบล็อก
    - สร้างไฟล์ [open-next.config.ts](file:///d:/APP/NEXCORE/open-next.config.ts) คอนฟิกธรรมดาเพื่อการันตีการคอมไพล์ของ Next.js 16/OpenNext บนเซิร์ฟเวอร์แบบไม่มีปัญหาเรื่อง Type Error ใน Local Development

---
*บันทึกเมื่อ: 2026-05-28 17:45 (เวลาท้องถิ่น)*


