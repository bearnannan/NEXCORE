import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendLineFlexMessage } from "@/lib/mission-control/line-client";
import { sendEmailFallbackNotification } from "@/lib/mission-control/smtp-client";

export const dynamic = "force-dynamic";

// Translation map from Thai payload keys to English database columns
const keyTranslationMap: Record<string, string> = {
  "สถานี": "station",
  "ผู้แจ้งเหตุ": "reporter",
  "อาการเสีย": "issue_description",
  "เบอร์โทรผู้แจ้ง": "phone",
  "เบอร์โทร": "phone",
  "ประเภทอุปกรณ์": "equipment_type",
  "ระดับความสำคัญ": "priority",
  "ความสำคัญ": "priority",
};

// Map Thai priority values to standard English priorities
function translatePriority(prio: string): string {
  if (!prio) return "medium";
  const val = prio.trim().toLowerCase();
  if (val === "วิกฤต" || val === "critical") return "critical";
  if (val === "สูง" || val === "high") return "high";
  if (val === "ปานกลาง" || val === "medium") return "medium";
  if (val === "ต่ำ" || val === "low") return "low";
  return "medium";
}

export async function POST(request: Request) {
  const correlationId = `webhook-${Math.random().toString(36).substring(2, 10)}`;
  console.log(`[Webhook] [${correlationId}] Inbound webhook request received.`);

  const supabase = (() => {
    try {
      return getSupabaseAdmin();
    } catch {
      return null;
    }
  })();

  if (!supabase) {
    return Response.json(
      { error: "Supabase service-role credentials not configured on server" },
      { status: 500 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let rawBody: Record<string, unknown> = {};

    // 1. Parse JSON or URL-Encoded payload formats
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      const dataParam = params.get("data");
      
      if (dataParam) {
        try {
          rawBody = JSON.parse(dataParam) as Record<string, unknown>;
        } catch {
          return Response.json(
            { error: "Invalid JSON format in url-encoded data parameter" },
            { status: 400 }
          );
        }
      } else {
        // Fallback: parse params flatly
        params.forEach((value, key) => {
          rawBody[key] = value;
        });
      }
    } else {
      rawBody = await request.json().catch(() => ({}));
    }

    console.log(`[Webhook] [${correlationId}] Parsed raw payload:`, JSON.stringify(rawBody));

    // 2. Translate Thai keys and extract values
    const parsedData: Record<string, unknown> = {};
    Object.entries(rawBody).forEach(([key, value]) => {
      const translatedKey = keyTranslationMap[key] || key;
      parsedData[translatedKey] = value;
    });

    const stationName = (parsedData.station as string)?.trim() || "";
    const reporter = (parsedData.reporter as string)?.trim() || "ไม่ระบุผู้แจ้งเหตุ";
    const issueDesc = (parsedData.issue_description || parsedData.description || "ไม่ระบุอาการเสีย") as string;
    const phone = (parsedData.phone || parsedData.reporter_phone || "-") as string;
    const equipmentType = (parsedData.equipment_type || null) as string | null;
    const priority = translatePriority(parsedData.priority as string);

    if (!stationName) {
      return Response.json(
        { error: "Missing required field: 'station' (สถานี)" },
        { status: 400 }
      );
    }

    // 3. Resolve Station details from public.stations for geometric coordinates mapping
    let assetId: string | null = null;
    let assetName: string | null = null;
    let province: string | null = null;
    let district: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    const { data: stationData, error: stationErr } = await supabase
      .from("stations")
      .select("id, station_name, province, district, latitude, longitude, code")
      .ilike("station_name", `%${stationName}%`)
      .limit(1);

    if (!stationErr && stationData && stationData.length > 0) {
      const station = stationData[0];
      assetId = station.id;
      assetName = station.station_name;
      province = station.province;
      district = station.district;
      latitude = station.latitude;
      longitude = station.longitude;
      console.log(`[Webhook] [${correlationId}] Linked to Station: ${station.station_name} (${station.code})`);
    } else {
      console.log(`[Webhook] [${correlationId}] Station matching "${stationName}" not found. Creating unmapped incident.`);
    }

    // 4. Save Incident into Supabase
    const { data: insertResult, error: insertErr } = await supabase
      .from("incidents")
      .insert({
        station: assetName || stationName,
        reporter,
        issue_description: issueDesc,
        phone,
        priority,
        equipment_type: equipmentType,
        asset_id: assetId,
        asset_type: assetId ? "station" : null,
        asset_name: assetName,
        province,
        district,
        latitude,
        longitude,
        raw_payload: rawBody,
      })
      .select()
      .single();

    if (insertErr || !insertResult) {
      console.error(`[Webhook] [${correlationId}] Database write failed:`, insertErr?.message);
      return Response.json(
        { error: `Database write failed: ${insertErr?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    const newIncident = insertResult;
    console.log(`[Webhook] [${correlationId}] Incident saved successfully. No: ${newIncident.incident_no}`);

    // 5. Send Primary LINE Flex Notification
    const lineResult = await sendLineFlexMessage(newIncident as unknown as Record<string, unknown>, correlationId);
    let smtpResult: { success: boolean; message: string } | null = null;

    // 6. Quota limitation auto-intercept + Email fallback
    if (!lineResult.success) {
      console.warn(`[Webhook] [${correlationId}] Primary LINE delivery failed. Triggering SMTP Fallback Email...`);
      smtpResult = await sendEmailFallbackNotification(
        newIncident as unknown as Record<string, unknown>,
        lineResult.message,
        correlationId
      );
    }

    return Response.json({
      success: true,
      incident: {
        id: newIncident.id,
        incident_no: newIncident.incident_no,
        station: newIncident.station,
        repair_status: newIncident.repair_status,
        sla_due_at: newIncident.sla_due_at,
        penalty_amount_baht: newIncident.penalty_amount_baht,
      },
      lineDelivery: {
        success: lineResult.success,
        channel: lineResult.channel,
        message: lineResult.message,
      },
      smtpFallback: smtpResult
        ? {
            success: smtpResult.success,
            message: smtpResult.message,
          }
        : undefined,
    });

  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    console.error(`[Webhook] [${correlationId}] Unexpected runtime error:`, errStr);
    return Response.json(
      { error: errStr },
      { status: 500 }
    );
  }
}
