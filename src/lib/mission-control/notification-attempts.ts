import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { LineApiResponse } from "./types";

export type NotificationAttemptChannel =
  | "line_primary"
  | "line_backup"
  | "smtp_fallback"
  | "manual_resend";

export interface NotificationAttemptInput {
  incidentId?: string | null;
  channel: NotificationAttemptChannel;
  status: "success" | "error";
  message?: string;
  statusCode?: number;
  correlationId?: string;
  tokenSource?: string;
}

export async function recordNotificationAttempt(input: NotificationAttemptInput) {
  if (!input.incidentId) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("incident_notification_attempts").insert({
      incident_id: input.incidentId,
      channel: input.channel,
      status: input.status,
      message: input.message || "",
      status_code: input.statusCode || null,
      correlation_id: input.correlationId || null,
      token_source: input.tokenSource || null,
    });
    if (error) throw error;
  } catch (error) {
    console.warn("Failed to record incident notification attempt:", error);
  }
}

export async function recordLineAttempt(input: {
  incidentId?: string | null;
  correlationId: string;
  response: LineApiResponse;
  channel?: NotificationAttemptChannel;
  tokenSource?: string;
}) {
  await recordNotificationAttempt({
    incidentId: input.incidentId,
    channel: input.channel || "line_primary",
    status: input.response.status,
    message: input.response.message,
    statusCode: input.response.statusCode,
    correlationId: input.correlationId,
    tokenSource: input.tokenSource,
  });
}
