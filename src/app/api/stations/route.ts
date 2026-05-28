import { requireOperatorSession } from "@/lib/auth/guards";
import { getMissionControlRepository } from "@/lib/mission-control/mission-control-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOperatorSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repository = getMissionControlRepository();

  try {
    return Response.json(await repository.listStationsWithIncidents());
  } catch (error) {
    console.error("[Mission Control] Failed to list stations", error);
    return Response.json(
      { error: "Station data source unavailable" },
      { status: 500 },
    );
  }
}
