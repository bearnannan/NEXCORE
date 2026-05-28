import { createClient } from "@supabase/supabase-js";

const incidentTemplates = [
  {
    title: "Packet loss on metro uplink",
    description: "Sustained packet loss above threshold on the east metro path.",
    severity: "critical",
    status: "in_progress",
  },
  {
    title: "Station telemetry offline",
    description: "No heartbeat from relay controller for three polling windows.",
    severity: "high",
    status: "acknowledged",
  },
  {
    title: "Backup power warning",
    description: "UPS runtime dropped below the configured operational floor.",
    severity: "medium",
    status: "new",
  },
  {
    title: "GPS synchronization warning",
    description: "NTP reference clock jitter exceeds operational limit on GPS controller.",
    severity: "low",
    status: "new",
  },
  {
    title: "Shelter high temperature alert",
    description: "Thermal sensor registered 43°C, cooling system validation required immediately.",
    severity: "critical",
    status: "acknowledged",
  },
  {
    title: "Optical power level degraded",
    description: "Receiver light level registered -22 dBm on primary fiber line interface.",
    severity: "medium",
    status: "in_progress",
  },
  {
    title: "Intrusion alarm triggered",
    description: "Door contact sensor activated on primary equipment shelter.",
    severity: "high",
    status: "new",
  },
];

async function seedIncidents() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔍 Fetching existing stations from Supabase to link incidents...");
  const { data: stations, error: fetchError } = await supabase
    .from("stations")
    .select("id, name, code, latitude, longitude");

  if (fetchError) {
    console.error(`❌ Error fetching stations: ${fetchError.message}`);
    process.exit(1);
  }

  if (!stations || stations.length === 0) {
    console.log("⚠️ No stations found in the database. Please run the station seeder first.");
    return;
  }

  console.log(`⚡ Loaded ${stations.length} stations. Starting incident seeding...`);

  // We will distribute around 12 incidents across some stations
  const incidentsToInsert: Record<string, string | null>[] = [];
  
  // 1. Ensure the unmapped stations have at least one interesting incident to show the component in action
  const unmappedStations = stations.filter(s => s.latitude === null || s.longitude === null);
  if (unmappedStations.length > 0) {
    const unmappedStation = unmappedStations[0];
    console.log(`📌 Creating coordinate validation incident on unmapped station: ${unmappedStation.name} (${unmappedStation.code})`);
    incidentsToInsert.push({
      station: unmappedStation.name,
      reporter: "System Monitor",
      issue_description: "Station has active telemetry but lacks verified latitude/longitude coordinates on the dashboard.",
      priority: "low",
      repair_status: "รอดำเนินการ",
      asset_id: unmappedStation.id,
      asset_type: "station",
      asset_name: unmappedStation.name,
    });
  }

  // 2. Select 10 random stations to assign interesting incidents
  const shuffledStations = [...stations].sort(() => 0.5 - Math.random());
  const selectedStations = shuffledStations.slice(0, 10);

  selectedStations.forEach((station, index) => {
    // Pick a template randomly
    const template = incidentTemplates[index % incidentTemplates.length];
    
    let repairStatus = "รอดำเนินการ";
    if (template.status === "in_progress") repairStatus = "กำลังดำเนินการ";
    else if (template.status === "resolved" || template.status === "closed") repairStatus = "เสร็จสิ้น";

    incidentsToInsert.push({
      station: station.name,
      reporter: "Operator Agent",
      issue_description: `${template.description} (Ref: ${station.code})`,
      priority: template.severity,
      repair_status: repairStatus,
      asset_id: station.id,
      asset_type: "station",
      asset_name: station.name,
    });
  });

  console.log(`📤 Seeding ${incidentsToInsert.length} mock incidents into Supabase...`);
  
  const { data, error } = await supabase
    .from("incidents")
    .insert(incidentsToInsert)
    .select("*");

  if (error) {
    console.error(`❌ Error inserting incidents: ${error.message}`);
    process.exit(1);
  }

  console.log(`🎉 Seeded successfully! Inserted ${data?.length} incidents linked to stations!`);
}

seedIncidents().catch((err: unknown) => {
  console.error("❌ Seeding incidents failed with unexpected error:", err);
});
