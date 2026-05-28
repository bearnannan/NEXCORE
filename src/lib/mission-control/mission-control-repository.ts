import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  listIncidents as listMockIncidents,
  listStationsWithIncidents as listMockStationsWithIncidents,
  updateIncidentStatus as updateMockIncidentStatus,
} from "@/lib/mission-control/mock-store";
import { applyIncidentFilters } from "@/lib/mission-control/selectors";
import {
  fromDatabaseRepairStatus,
  getTransitionErrorMessage,
  isValidTransition,
  toDatabaseRepairStatus,
} from "./state-machine";
import type {
  Incident,
  IncidentFilters,
  IncidentStatus,
  Station,
  StationWithIncidents,
} from "@/lib/mission-control/types";

export type MissionControlRepository = {
  listStationsWithIncidents(): Promise<StationWithIncidents[]>;
  listIncidents(filters?: IncidentFilters): Promise<Incident[]>;
  updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident | null>;
};

type SupabaseServerConfig = {
  url: string;
  serviceKey: string;
};

type RecordValue = string | number | null | undefined;

const incidentStatusSchema = z.enum([
  "new",
  "acknowledged",
  "in_progress",
  "resolved",
  "closed",
]);
const incidentSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
const operationalStatusSchema = z.enum(["normal", "degraded", "offline"]);

const mockRepository: MissionControlRepository = {
  async listStationsWithIncidents() {
    return listMockStationsWithIncidents();
  },
  async listIncidents(filters = {}) {
    return listMockIncidents(filters);
  },
  async updateIncidentStatus(id, status) {
    return updateMockIncidentStatus(id, status);
  },
};

let supabaseClient: SupabaseClient | null = null;
let supabaseClientKeyFingerprint: string | null = null;

export function getMissionControlRepository(): MissionControlRepository {
  const config = getSupabaseServerConfig();

  if (!config) {
    return mockRepository;
  }

  return createSupabaseRepository(getSupabaseServerClient(config));
}

export function getMissionControlDataSource() {
  return getSupabaseServerConfig() ? "supabase" : "mock";
}

function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.warn("[Mission Control] Supabase server credentials missing; using mock repository.");
    return null;
  }

  const validation = validateSupabaseServerConfig(url, serviceKey);
  if (!validation.valid) {
    console.warn(`[Mission Control] ${validation.reason}; using mock repository.`);
    return null;
  }

  return { url, serviceKey };
}

function getSupabaseServerClient(config: SupabaseServerConfig) {
  const keyFingerprint = `${config.url}:${config.serviceKey.slice(0, 12)}:${config.serviceKey.slice(-8)}`;

  if (!supabaseClient || supabaseClientKeyFingerprint !== keyFingerprint) {
    supabaseClient = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "nexcore-mission-control-server",
        },
      },
    });
    supabaseClientKeyFingerprint = keyFingerprint;
  }

  return supabaseClient;
}

function createSupabaseRepository(
  supabase: SupabaseClient,
): MissionControlRepository {
  return {
    async listStationsWithIncidents() {
      const result = await withSupabaseFallback("listStationsWithIncidents", () =>
        Promise.all([fetchStations(supabase), fetchIncidents(supabase)]),
      );

      if (!result) return mockRepository.listStationsWithIncidents();

      const [stations, incidents] = result;

      return stations.map((station) => ({
        ...station,
        incidents: incidents.filter(
          (incident) => incident.stationId === station.id,
        ),
      }));
    },
    async listIncidents(filters = {}) {
      const result = await withSupabaseFallback("listIncidents", () =>
        Promise.all([fetchIncidents(supabase), fetchStations(supabase)]),
      );

      if (!result) return mockRepository.listIncidents(filters);

      const [incidents, stations] = result;

      return applyIncidentFilters(incidents, filters, stations);
    },
    async updateIncidentStatus(id, status) {
      // Fetch current incident to validate transition
      return (
        (await withSupabaseFallback("updateIncidentStatus", async () => {
          const { data: currentData, error: fetchError } = await supabase
            .from("incidents")
            .select("repair_status")
            .eq("id", id)
            .maybeSingle();

          if (fetchError) {
            throw new Error(`Supabase incident query failed: ${fetchError.message}`);
          }

          if (!currentData) {
            return null;
          }

          const currentStatus = fromDatabaseRepairStatus(
            currentData.repair_status,
          );

          if (!isValidTransition(currentStatus, status)) {
            throw new Error(getTransitionErrorMessage(currentStatus, status));
          }

          const repairStatus = toDatabaseRepairStatus(status);

          const { data, error } = await supabase
            .from("incidents")
            .update({ repair_status: repairStatus })
            .eq("id", id)
            .select("*")
            .maybeSingle();

          if (error) {
            throw new Error(`Supabase incident update failed: ${error.message}`);
          }

          if (data) {
            import("@/lib/mission-control/line-client").then(async ({ sendLineFlexMessage }) => {
              const correlationId = `update-${Math.random().toString(36).substring(2, 10)}`;
              const lineResult = await sendLineFlexMessage(data, correlationId);
              if (!lineResult.success) {
                const { sendEmailFallbackNotification } = await import("@/lib/mission-control/smtp-client");
                await sendEmailFallbackNotification(data, lineResult.message, correlationId);
              }
            }).catch(console.error);
          }

          return data ? toIncident(data as Record<string, RecordValue>) : null;
        })) ?? (await mockRepository.updateIncidentStatus(id, status))
      );
    },
  };
}

async function withSupabaseFallback<T>(
  operation: string,
  query: () => Promise<T>,
): Promise<T | null> {
  try {
    return await query();
  } catch (error) {
    if (!isSupabaseCredentialError(error)) {
      throw error;
    }

    console.warn(
      `[Mission Control] Supabase credential failure during ${operation}; using mock repository.`,
      error,
    );
    supabaseClient = null;
    supabaseClientKeyFingerprint = null;
    return null;
  }
}

async function fetchStations(supabase: SupabaseClient): Promise<Station[]> {
  const { data, error } = await supabase
    .from("stations")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Supabase station query failed: ${error.message}`);
  }

  return (data ?? []).map((record) =>
    toStation(record as Record<string, RecordValue>),
  );
}

async function fetchIncidents(supabase: SupabaseClient): Promise<Incident[]> {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("reported_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase incident query failed: ${error.message}`);
  }

  return (data ?? []).map((record) =>
    toIncident(record as Record<string, RecordValue>),
  );
}

function toStation(record: Record<string, RecordValue>): Station {
  return {
    id: readRequiredString(record, "id"),
    code: readRequiredString(record, "code"),
    name: readRequiredString(record, "name"),
    province: readOptionalString(record, "province"),
    latitude: readOptionalNumber(record, "latitude"),
    longitude: readOptionalNumber(record, "longitude"),
    operationalStatus: operationalStatusSchema.parse(
      readOptionalString(record, "operational_status", "operationalStatus") ??
        "normal",
    ),
  };
}

function toIncident(record: Record<string, RecordValue>): Incident {
  const dbStatus = record.repair_status || record.status;
  const status = fromDatabaseRepairStatus(dbStatus);

  // Map English priority/severity
  const dbPriority = record.priority || record.severity || "medium";

  return {
    id: readRequiredString(record, "id"),
    stationId: (record.asset_id || record.station_id || "") as string,
    title: (record.incident_no || record.title || "Incident") as string,
    description: (record.issue_description || record.description || "") as string,
    status: incidentStatusSchema.parse(status),
    severity: incidentSeveritySchema.parse(dbPriority),
    createdAt: readRequiredString(record, "reported_at", "created_at", "createdAt"),
    updatedAt: readRequiredString(record, "updated_at", "updatedAt"),
  };
}

function readRequiredString(
  record: Record<string, RecordValue>,
  ...keys: string[]
) {
  const value = readValue(record, keys);

  if (typeof value !== "string" || !value) {
    throw new Error(`Supabase row is missing required field: ${keys[0]}`);
  }

  return value;
}

function readOptionalString(
  record: Record<string, RecordValue>,
  ...keys: string[]
) {
  const value = readValue(record, keys);
  return typeof value === "string" && value ? value : undefined;
}

function readOptionalNumber(
  record: Record<string, RecordValue>,
  ...keys: string[]
) {
  const value = readValue(record, keys);

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readValue(record: Record<string, RecordValue>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return undefined;
}

function validateSupabaseServerConfig(
  url: string,
  serviceKey: string,
): { valid: true } | { valid: false; reason: string } {
  if (!isLikelySupabaseUrl(url)) {
    return { valid: false, reason: "SUPABASE_URL is not a valid Supabase project URL" };
  }

  if (serviceKey === url || serviceKey.includes("replace-with") || serviceKey.length < 40) {
    return { valid: false, reason: "SUPABASE_SERVICE_ROLE_KEY is missing or placeholder-like" };
  }

  if (serviceKey.startsWith("sb_secret_")) {
    return { valid: true };
  }

  const jwt = decodeSupabaseJwt(serviceKey);
  if (!jwt) {
    return { valid: false, reason: "SUPABASE_SERVICE_ROLE_KEY is not a valid JWT or Supabase secret key" };
  }

  if (jwt.role !== "service_role") {
    return { valid: false, reason: "SUPABASE_SERVICE_ROLE_KEY JWT role is not service_role" };
  }

  const projectRef = new URL(url).hostname.split(".")[0];
  if (jwt.ref && jwt.ref !== projectRef) {
    return { valid: false, reason: "SUPABASE_SERVICE_ROLE_KEY project ref does not match SUPABASE_URL" };
  }

  if (jwt.exp && jwt.exp * 1000 <= Date.now()) {
    return { valid: false, reason: "SUPABASE_SERVICE_ROLE_KEY JWT is expired" };
  }

  return { valid: true };
}

function decodeSupabaseJwt(value: string): { role?: string; ref?: string; exp?: number } | null {
  const [, payload] = value.split(".");
  if (!payload) return null;

  try {
    const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { role?: unknown; ref?: unknown; exp?: unknown };
    return {
      role: typeof parsed.role === "string" ? parsed.role : undefined,
      ref: typeof parsed.ref === "string" ? parsed.ref : undefined,
      exp: typeof parsed.exp === "number" ? parsed.exp : undefined,
    };
  } catch {
    return null;
  }
}

function isLikelySupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isSupabaseCredentialError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid api key|jwserror|jwsinvalidsignature|no api key|authorization/i.test(message);
}
