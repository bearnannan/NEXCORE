import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getIncidentConfigAsync } from "./config";
import { createLineFlexMessage } from "./flex-message";
import { maskPhoneNumber } from "./format";
import { formatThaiDate, getStatusColor, getStatusLabelTh } from "./line-format";
import { incidentRecordToPayload } from "./payload";
import { recordLineAttempt, recordNotificationAttempt } from "./notification-attempts";
import type { LineApiResponse, LineFlexMessage, NotificationPayload } from "./types";

export { formatThaiDate, getStatusColor, getStatusLabelTh };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === "string" && /\d{7,}/.test(value.replace(/\D/g, ""))) {
    return maskPhoneNumber(value);
  }
  return value;
}

function logLineEvent(event: string, payload: Record<string, unknown>) {
  const safePayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, sanitizeLogValue(value)]),
  );
  console.info(JSON.stringify({ event, ...safePayload }));
}

function parseLineErrorMessage(responseText: string, statusCode: number) {
  let lineMessage = responseText || "LINE push failed";

  try {
    const parsed = JSON.parse(responseText) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      lineMessage = parsed.message.trim();
    }
  } catch {
    // LINE usually returns JSON, but keep the raw response when it does not.
  }

  const normalized = lineMessage.replace(/\.+$/, "");

  if (statusCode === 401) {
    return `LINE authentication failed: ${normalized}. Check LINE_TOKEN/LINE_CHANNEL_ACCESS_TOKEN in system_settings or .env.local.`;
  }

  if (statusCode === 400) {
    return `LINE rejected the request: ${normalized}`;
  }

  if (statusCode === 403) {
    return `LINE authorization/quota failure: ${normalized}`;
  }

  return normalized;
}

export function generateFlexMessagePayload(
  incident: Record<string, unknown>,
): Record<string, unknown> {
  return createLineFlexMessage(incidentRecordToPayload(incident)) as unknown as Record<string, unknown>;
}

export async function sendLineNotification(
  message: LineFlexMessage,
  correlationId = crypto.randomUUID(),
  payload?: NotificationPayload,
  options?: { incidentId?: string | null },
): Promise<LineApiResponse> {
  const config = await getIncidentConfigAsync();

  if (!config.lineChannelAccessToken || !config.lineGroupId) {
    const response = {
      status: "error" as const,
      message: "LINE_CHANNEL_ACCESS_TOKEN/LINE_TOKEN or LINE_GROUP_ID/GROUP_ID is not configured",
    };
    await recordLineAttempt({
      incidentId: options?.incidentId,
      correlationId,
      response,
      tokenSource: "env_or_system_settings_missing",
    });
    return response;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      logLineEvent("line_push_attempt", { correlationId, attempt });

      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.lineChannelAccessToken}`,
        },
        body: JSON.stringify({
          to: config.lineGroupId,
          messages: [message],
        }),
      });

      const responseText = await response.text();

      if (response.ok) {
        const result = {
          status: "success" as const,
          message: "Flex Message sent successfully",
          statusCode: response.status,
        };
        logLineEvent("line_push_success", { correlationId, statusCode: response.status });
        await recordLineAttempt({
          incidentId: options?.incidentId,
          correlationId,
          response: result,
          tokenSource: "env_or_system_settings",
        });
        return result;
      }

      const lineErrorMessage = parseLineErrorMessage(responseText, response.status);
      lastError = new Error(lineErrorMessage);

      if (![429, 500, 502, 503, 504].includes(response.status)) {
        const result = {
          status: "error" as const,
          message: lineErrorMessage,
          statusCode: response.status,
        };
        await recordLineAttempt({
          incidentId: options?.incidentId,
          correlationId,
          response: result,
          tokenSource: "env_or_system_settings",
        });

        if (payload && (response.status === 400 || response.status === 403)) {
          await recordNotificationAttempt({
            incidentId: options?.incidentId,
            channel: "smtp_fallback",
            status: "success",
            message: "SMTP fallback should be triggered after LINE quota/error response",
            correlationId,
          });
        }

        return result;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < config.maxRetries) {
      await wait(250 * 2 ** (attempt - 1));
    }
  }

  const messageText = lastError instanceof Error ? lastError.message : "LINE push failed";
  const result = {
    status: "error" as const,
    message: messageText,
    statusCode: 502,
  };
  logLineEvent("line_push_error", { correlationId, message: messageText });
  await recordLineAttempt({
    incidentId: options?.incidentId,
    correlationId,
    response: result,
    tokenSource: "env_or_system_settings",
  });
  return result;
}

export async function sendLineFlexMessage(
  incident: Record<string, unknown>,
  correlationId = `corr-${Math.random().toString(36).substring(2, 10)}`,
): Promise<{ success: boolean; channel: string; message: string; statusCode?: number }> {
  const payload = incidentRecordToPayload(incident);
  const lineMessage = createLineFlexMessage(payload);
  const incidentId = typeof incident.id === "string" ? incident.id : null;
  const response = await sendLineNotification(lineMessage, correlationId, payload, { incidentId });

  if (response.status === "success" && incidentId) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("incidents")
        .update({
          line_notification_sent_at: new Date().toISOString(),
          line_notification_error: null,
        })
        .eq("id", incidentId);
    } catch (error) {
      console.warn("Failed to update LINE success metadata:", error);
    }
  }

  if (response.status === "error" && incidentId) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("incidents")
        .update({ line_notification_error: response.message })
        .eq("id", incidentId);
    } catch (error) {
      console.warn("Failed to update LINE error metadata:", error);
    }
  }

  return {
    success: response.status === "success",
    channel: "line_primary",
    message: response.message,
    statusCode: response.statusCode,
  };
}
