import { NextResponse } from "next/server";
import { getAdminStaff } from "@/lib/api-auth";
import { isSameOrigin } from "@/lib/http";
import { refundOrder } from "@/services/admin-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await getAdminStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const { id } = await params;
  const result = await refundOrder(id, staff.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
