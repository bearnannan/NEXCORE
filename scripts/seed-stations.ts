import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Mapping Thai Provinces to English Codes for clean Station Codes
const provinceCodeMap: Record<string, string> = {
  "กาญจนบุรี": "KAN",
  "กำแพงเพชร": "KPT",
  "ขอนแก่น": "KKN",
  "จันทบุรี": "CTI",
  "ตรัง": "TRG",
  "นครราชสีมา": "NMA",
  "นครศรีธรรมราช": "NRT",
  "นครสวรรค์": "NSN",
  "พิจิตร": "PJT",
  "เพชรบูรณ์": "PBN",
};

// Simple but robust CSV parser to handle quotes and newlines
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function seed() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    console.log("Please check your .env.local file.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const csvPath = join(process.cwd(), "181.csv");

  console.log(`📖 Reading CSV data from: ${csvPath}`);
  let content = "";
  try {
    content = readFileSync(csvPath, "utf-8");
  } catch (err: unknown) {
    console.error(`❌ Error reading CSV file: ${err instanceof Error ? err.message : "Unknown error"}`);
    process.exit(1);
  }

  // Split lines, filter out empty rows
  const rawLines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (rawLines.length <= 1) {
    console.log("⚠️ CSV file is empty or only has a header.");
    return;
  }

  // Extract records
  const stationsToInsert: Record<string, string | number | null>[] = [];
  const provinceCounts: Record<string, number> = {};

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Check for empty comma rows (e.g. ,,,,,,,)
    if (/^[,\s]+$/.test(line)) {
      continue;
    }

    const columns = parseCsvLine(line);
    if (columns.length < 5) {
      continue;
    }

    const name = columns[0]; // หมู่บ้าน
    const subDistrict = columns[1]; // ตำบล
    const district = columns[2]; // อำเภอ
    const province = columns[3]; // จังหวัด
    const rawLat = columns[4]; // Latitude
    const rawLng = columns[5]; // Longitude
    const rawSeaLevel = columns[6]; // sea level (m)
    const rawPoleHeight = columns[7]; // ความสูงเสา (ม.)
    const position = columns[8]; // ตำแหน่ง

    // Guard fields
    if (!name || !province) {
      continue;
    }

    // Coordinates conversion
    const latitude = rawLat && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
    const longitude = rawLng && !isNaN(Number(rawLng)) ? Number(rawLng) : null;
    const seaLevel = rawSeaLevel && !isNaN(Number(rawSeaLevel)) ? Number(rawSeaLevel) : null;
    const poleHeight = rawPoleHeight && !isNaN(Number(rawPoleHeight)) ? Number(rawPoleHeight) : null;

    // Track sequence per province to generate structured Codes
    provinceCounts[province] = (provinceCounts[province] || 0) + 1;
    const provKey = provinceCodeMap[province] || "UNK";
    const code = `${provKey}-${String(provinceCounts[province]).padStart(3, "0")}`;

    // Randomize initial operational status to keep the dashboard interesting
    const statusRand = Math.random();
    const operationalStatus = statusRand > 0.9 ? "offline" : statusRand > 0.8 ? "degraded" : "normal";

    stationsToInsert.push({
      code,
      name: `${subDistrict} - ${name}`,
      province,
      district,
      sub_district: subDistrict,
      latitude,
      longitude,
      sea_level: seaLevel,
      pole_height: poleHeight,
      position,
      operational_status: operationalStatus,
    });
  }

  console.log(`⚡ Found ${stationsToInsert.length} valid station records to import.`);
  
  // Bulk insert in chunks of 100 rows to prevent connection issues
  const chunkSize = 100;
  let succeeded = 0;

  for (let i = 0; i < stationsToInsert.length; i += chunkSize) {
    const chunk = stationsToInsert.slice(i, i + chunkSize);
    console.log(`📤 Seeding chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)...`);
    
    const { error } = await supabase.from("stations").insert(chunk);
    if (error) {
      console.error(`❌ Error inserting chunk: ${error.message}`);
      process.exit(1);
    }
    succeeded += chunk.length;
  }

  console.log(`🎉 Seeding completed successfully. Imported ${succeeded} stations into Supabase!`);
}

seed().catch((err: unknown) => {
  console.error("❌ Seeding failed with unexpected error:", err);
});
