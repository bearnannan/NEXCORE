import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SystemSettings } from "./settings-store";
import type { IncidentPriority, RepairStatus } from "./types";
export { getStatusColor, getStatusLabelTh } from "./line-format";

export const DEFAULT_REPAIR_STATUS: RepairStatus = "รอดำเนินการ";
export const DEFAULT_PRIORITY: IncidentPriority = "medium";

export function getIncidentConfig() {
  return {
    lineChannelAccessToken:
      process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_TOKEN || "",
    lineGroupId: process.env.LINE_GROUP_ID || process.env.GROUP_ID || "",
    requestTimeoutMs: Number(process.env.LINE_REQUEST_TIMEOUT_MS || 10000),
    maxRetries: Number(process.env.LINE_MAX_RETRIES || 3),
    smtpHost: process.env.SMTP_HOST || "smtp.office365.com",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPassword: process.env.SMTP_PASSWORD || "",
    fallbackEmailTo:
      process.env.NOTIFICATION_EMAIL_TO || process.env.FALLBACK_EMAIL_TO || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
  };
}

function applySystemSettings(
  config: ReturnType<typeof getIncidentConfig>,
  settings: Partial<SystemSettings>,
) {
  if (settings.LINE_TOKEN || settings.line_backup_token) {
    config.lineChannelAccessToken = settings.LINE_TOKEN || settings.line_backup_token || "";
  }
  if (settings.GROUP_ID || settings.line_backup_group_id) {
    config.lineGroupId = settings.GROUP_ID || settings.line_backup_group_id || "";
  }
  if (settings.fallback_email_to) {
    config.fallbackEmailTo = settings.fallback_email_to;
  }
  if ((settings as any).resend_api_key) {
    config.resendApiKey = (settings as any).resend_api_key;
  }
}

export async function getIncidentConfigAsync() {
  const baseConfig = getIncidentConfig();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("system_settings").select("key, value");

    if (error) throw error;

    if (data && data.length > 0) {
      applySystemSettings(baseConfig, Object.fromEntries(data.map((item) => [item.key, item.value])));
    }
  } catch (error) {
    console.warn(
      "Failed to load public.system_settings; falling back to local/env incident settings.",
      error,
    );
    const { readLocalSystemSettings } = await import("./settings-store");
    applySystemSettings(baseConfig, await readLocalSystemSettings());
  }

  return baseConfig;
}

export function normalizePriority(priority?: string): IncidentPriority {
  if (
    priority === "critical" ||
    priority === "high" ||
    priority === "medium" ||
    priority === "low"
  ) {
    return priority;
  }

  return DEFAULT_PRIORITY;
}
