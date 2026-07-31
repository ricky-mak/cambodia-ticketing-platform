import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { logger } from "@/lib/logging";

// TypeORM/pg need the Node runtime, not the Edge runtime.
export const runtime = "nodejs";
// Always execute; never statically cache the health result.
export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  let database: "connected" | "disconnected" = "disconnected";

  try {
    const dataSource = await getDataSource();
    await dataSource.query("SELECT 1");
    database = "connected";
  } catch (error) {
    logger.error("Health check database failure", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const ok = database === "connected";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", database, timestamp },
    { status: ok ? 200 : 503 },
  );
}
