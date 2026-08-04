import { NextResponse } from "next/server";
import { getScopedAdminStaff } from "@/lib/api-auth";
import { inScope } from "@/lib/tenant";
import { isSameOrigin } from "@/lib/http";
import {
  getTicketOrganizerId,
  resendTicketEmail,
} from "@/services/admin-attendee.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gated = await getScopedAdminStaff();
  if (!gated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const { id } = await params;
  const orgId = await getTicketOrganizerId(id);
  if (!orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!inScope(gated.scope, orgId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await resendTicketEmail(id, gated.staff.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
