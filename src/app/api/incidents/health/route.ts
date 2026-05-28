import { getIncidentConfigAsync } from "@/lib/mission-control/config";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const status: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      line_api: "disabled",
      smtp_fallback: "disabled",
    },
  };

  // 1. Verify Database
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("stations").select("id").limit(1);

    const services = status.services as Record<string, string>;
    if (!error) {
      services.database = "ok";
    } else {
      status.status = "error";
      services.database = `error: ${error.message}`;
    }
  } catch (err: unknown) {
    status.status = "error";
    const services = status.services as Record<string, string>;
    services.database = `exception: ${err instanceof Error ? err.message : String(err)}`;
  }

  const config = await getIncidentConfigAsync();

  // 2. Verify LINE Token Config
  if (config.lineChannelAccessToken && config.lineGroupId) {
    const services = status.services as Record<string, string>;
    services.line_api = "enabled";
  }

  // 3. Verify SMTP Config
  if (config.smtpUser && config.smtpPassword && config.fallbackEmailTo) {
    const services = status.services as Record<string, string>;
    services.smtp_fallback = "enabled";
  }

  const statusCode = status.status === "ok" ? 200 : 503;
  return Response.json(status, { status: statusCode });
}
