import type {
  IncidentSeverity,
  IncidentStatus,
} from "@/lib/mission-control/types";
import { requireOperatorSession } from "@/lib/auth/guards";
import { getMissionControlRepository } from "@/lib/mission-control/mission-control-repository";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireOperatorSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = {
    status: url.searchParams.getAll("status") as IncidentStatus[],
    severity: url.searchParams.getAll("severity") as IncidentSeverity[],
    stationId: url.searchParams.get("stationId") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
  };

  const repository = getMissionControlRepository();

  try {
    return Response.json(await repository.listIncidents(filters));
  } catch (error) {
    console.error("[Mission Control] Failed to list incidents", error);
    return Response.json(
      { error: "Incident data source unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await requireOperatorSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const stationName = body.station || body.title || "";
  const reporter = body.reporter || session.user.name || "Operations Operator";
  const issueDesc = body.issue_description || body.description || "ไม่ระบุอาการเสีย";
  const phone = body.phone || "-";
  const priority = body.priority || body.severity || "medium";
  const equipmentType = body.equipment_type || null;

  if (!stationName) {
    return Response.json({ error: "Missing required field: 'station'" }, { status: 400 });
  }

  const supabase = (() => {
    try {
      return getSupabaseAdmin();
    } catch {
      return null;
    }
  })();

  if (!supabase) {
    return Response.json({ error: "Server database configuration missing" }, { status: 500 });
  }

  // Resolve station details for mapping coordinates
  let assetId: string | null = null;
  let assetName: string | null = null;
  let province: string | null = null;
  let district: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  const { data: stationData } = await supabase
    .from("stations")
    .select("id, name, province, district, latitude, longitude")
    .ilike("name", `%${stationName}%`)
    .limit(1);

  if (stationData && stationData.length > 0) {
    const station = stationData[0];
    assetId = station.id;
    assetName = station.name;
    province = station.province;
    district = station.district;
    latitude = station.latitude;
    longitude = station.longitude;
  }

  // Insert into DB
  const { data: incident, error: insertErr } = await supabase
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
      created_by: session.user.name || "Operator",
    })
    .select()
    .single();

  if (insertErr || !incident) {
    return Response.json({ error: insertErr?.message || "Failed to create incident" }, { status: 500 });
  }

  // Send LINE Flex Message asynchronously
  const { sendLineFlexMessage } = await import("@/lib/mission-control/line-client");
  const correlationId = `manual-${Math.random().toString(36).substring(2, 10)}`;
  const lineResult = await sendLineFlexMessage(incident, correlationId);
  if (!lineResult.success) {
    const { sendEmailFallbackNotification } = await import("@/lib/mission-control/smtp-client");
    await sendEmailFallbackNotification(incident, lineResult.message, correlationId);
  }

  // Return compatible English-mapped structure
  const repository = getMissionControlRepository();
  const incidents = await repository.listIncidents();
  const createdIncident = incidents.find((inc) => inc.id === incident.id);

  return Response.json(createdIncident || incident);
}
