import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { autopilotFindings } from "@/src/db/schema";

const VALID_STATUSES = [
  "detected",
  "validated",
  "reported",
  "dismissed",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body;

    if (
      !status ||
      !VALID_STATUSES.includes(
        status as (typeof VALID_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: `Ongeldige status. Geldige waarden: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(autopilotFindings)
      .set({ status, updatedAt: new Date() })
      .where(eq(autopilotFindings.findingId, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Bevinding niet gevonden" },
        { status: 404 },
      );
    }

    return NextResponse.json({ finding: updated });
  } catch (_err) {
    return NextResponse.json(
      { error: "Interne serverfout" },
      { status: 500 },
    );
  }
}

