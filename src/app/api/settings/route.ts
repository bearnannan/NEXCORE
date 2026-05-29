import { NextResponse } from "next/server";
import { requireOperatorSession } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  normalizeSystemSettings,
  readLocalSystemSettings,
  writeLocalSystemSettings,
  type SystemSettings,
} from "@/lib/mission-control/settings-store";

export const dynamic = "force-dynamic";

const SETTINGS_KEYS = ["LINE_TOKEN", "GROUP_ID", "fallback_email_to"] as const;

function isSupabaseSettingsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "PGRST205" ||
    candidate.message?.includes("system_settings") ||
    candidate.message?.includes("SUPABASE_SERVICE_ROLE_KEY")
  );
}

async function readSupabaseSettings(): Promise<SystemSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value");

  if (error) throw error;

  const settingsMap = Object.fromEntries((data || []).map((item) => [item.key, item.value]));
  return normalizeSystemSettings(settingsMap);
}

async function writeSupabaseSettings(settings: SystemSettings) {
  const supabase = getSupabaseAdmin();
  const updates = SETTINGS_KEYS.map((key) => ({ key, value: settings[key] || "" }));

  const { error } = await supabase
    .from("system_settings")
    .upsert(updates, { onConflict: "key" });

  if (error) throw error;
}

export async function GET() {
  const session = await requireOperatorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await readSupabaseSettings());
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    const settings = await readLocalSystemSettings();
    return NextResponse.json({
      ...settings,
      storage: "local_fallback",
      warning: isSupabaseSettingsUnavailable(error)
        ? "Settings table is not initialized in Supabase. Using local fallback storage."
        : "Unable to load Supabase settings. Using local fallback storage.",
    });
  }
}

export async function POST(req: Request) {
  const session = await requireOperatorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings = normalizeSystemSettings(body);

    try {
      await writeSupabaseSettings(settings);
      return NextResponse.json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
      if (!isSupabaseSettingsUnavailable(error)) throw error;

      console.warn("Supabase settings table unavailable; saving settings locally.", error);
      await writeLocalSystemSettings(settings);

      return NextResponse.json({
        success: true,
        storage: "local_fallback",
        message: "Settings saved locally (LINE_TOKEN excluded for security compliance)",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update system settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
