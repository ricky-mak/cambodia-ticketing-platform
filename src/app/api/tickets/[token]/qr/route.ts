import QRCode from "qrcode";
import { getTicketByPublicToken } from "@/services/ticket.service";
import { signTicketToken } from "@/lib/qr-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the QR code PNG for a ticket. The encoded value is the signed token
 * derived from the ticket's ids — not the public URL token.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const view = await getTicketByPublicToken(token);
  if (!view) {
    return new Response("Not found", { status: 404 });
  }

  const signed = signTicketToken({
    version: 1,
    ticketId: view.ticket.id,
    eventId: view.ticket.eventId,
    tokenId: view.ticket.qrTokenId,
  });

  const png = await QRCode.toBuffer(signed, {
    type: "png",
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
