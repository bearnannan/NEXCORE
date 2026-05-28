import { z } from "zod";
import { requireOperatorSession } from "@/lib/auth/guards";
import { getMissionControlRepository } from "@/lib/mission-control/mission-control-repository";
import {
  fromDatabaseRepairStatus,
  isStatusTransitionError,
  toDatabaseRepairStatus,
} from "@/lib/mission-control/state-machine";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const updateIncidentSchema = z.object({
  status: z.enum(["new", "acknowledged", "in_progress", "resolved", "closed"]),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireOperatorSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateIncidentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid incident status" }, { status: 400 });
  }

  const { id } = await context.params;
  const repository = getMissionControlRepository();
  
  try {
    const incident = await repository.updateIncidentStatus(id, parsed.data.status);

    if (!incident) {
      return Response.json({ error: "Incident not found" }, { status: 404 });
    }

    return Response.json(incident);
  } catch (error: unknown) {
    if (!isStatusTransitionError(error)) {
      console.error("[Mission Control] Failed to patch incident status", error);
      return Response.json(
        { error: "Incident data source unavailable" },
        { status: 500 },
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid status transition" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireOperatorSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const supabase = (() => {
    try {
      return getSupabaseAdmin();
    } catch {
      return null;
    }
  })();

  if (!supabase) {
    return Response.json({ error: "Database configuration missing" }, { status: 500 });
  }

  // 1. Fetch current incident first to see if status is changing
  const { data: currentData } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .single();

  if (!currentData) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  // 2. Perform updates
  const updates: Record<string, unknown> = {};
  
  if (body.reporter !== undefined) updates.reporter = body.reporter;
  if (body.issue_description !== undefined) updates.issue_description = body.issue_description;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.severity !== undefined) updates.priority = body.severity;
  if (body.equipment_type !== undefined) updates.equipment_type = body.equipment_type;

  // Handle status translations
  let newRepairStatus = currentData.repair_status;
  if (body.status !== undefined) {
    const parsedStatus = updateIncidentSchema.shape.status.safeParse(
      body.status,
    );

    if (!parsedStatus.success) {
      return Response.json({ error: "Invalid incident status" }, { status: 400 });
    }

    newRepairStatus = toDatabaseRepairStatus(parsedStatus.data);
  } else if (body.repair_status !== undefined) {
    newRepairStatus = toDatabaseRepairStatus(
      fromDatabaseRepairStatus(body.repair_status),
    );
  }
  updates.repair_status = newRepairStatus;

  const statusChanged = currentData.repair_status !== newRepairStatus;

  const { data: updatedIncident, error: updateErr } = await supabase
    .from("incidents")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedIncident) {
    return Response.json({ error: updateErr?.message || "Update failed" }, { status: 500 });
  }

  // 3. Trigger LINE notifications asynchronously if status changed
  if (statusChanged) {
    const { sendLineFlexMessage } = await import("@/lib/mission-control/line-client");
    const correlationId = `update-${Math.random().toString(36).substring(2, 10)}`;
    const lineResult = await sendLineFlexMessage(updatedIncident, correlationId);
    if (!lineResult.success) {
      const { sendEmailFallbackNotification } = await import("@/lib/mission-control/smtp-client");
      await sendEmailFallbackNotification(updatedIncident, lineResult.message, correlationId);
    }
  }

  const repository = getMissionControlRepository();
  const incidentsList = await repository.listIncidents();
  const matched = incidentsList.find((inc) => inc.id === id);

  return Response.json(matched || updatedIncident);
}
