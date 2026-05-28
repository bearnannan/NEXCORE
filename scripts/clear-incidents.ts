import { createClient } from "@supabase/supabase-js";

async function clearIncidents() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🗑️ Clearing all mock incidents from Supabase 'incidents' table...");

  // Supabase delete requires a filter, we delete all records where id is not null
  const { data, error } = await supabase
    .from("incidents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");

  if (error) {
    console.error(`❌ Error clearing incidents: ${error.message}`);
    process.exit(1);
  }

  console.log(`🎉 Cleared successfully! Removed ${data?.length ?? 0} incidents from the database.`);
}

clearIncidents().catch(err => {
  console.error("❌ Clearing incidents failed with unexpected error:", err);
});
