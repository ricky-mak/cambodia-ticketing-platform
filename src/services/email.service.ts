import QRCode from "qrcode";
import { getRepo } from "@/lib/database";
import { Order } from "@/entities/order.entity";
import { Event } from "@/entities/event.entity";
import { getTicketSummariesForOrder } from "./ticket.service";
import { getEmailProvider } from "./email";
import type { EmailAttachment } from "./email";
import { renderOrderConfirmationEmail } from "@/emails/order-confirmation";
import { signTicketToken } from "@/lib/qr-signing";
import { logger } from "@/lib/logging";

/** Build and send the purchase confirmation email for a paid order. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await (await getRepo(Order)).findOne({ where: { id: orderId } });
  if (!order) return;
  const event = await (await getRepo(Event)).findOne({
    where: { id: order.eventId },
  });
  if (!event) return;

  const tickets = await getTicketSummariesForOrder(orderId);
  const baseUrl = process.env.APPLICATION_BASE_URL ?? "http://localhost:3000";

  const { subject, html, text } = renderOrderConfirmationEmail({
    baseUrl,
    event: {
      name: event.name,
      startsAtIso: event.startsAt ? event.startsAt.toISOString() : null,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      contactEmail: event.contactEmail,
    },
    order: {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalMinor: order.totalMinor,
      currency: order.currency,
    },
    tickets,
  });

  // Embed each ticket's QR inline (CID attachment) so it renders even when the
  // mail client blocks external images. Content-IDs match the template's cid refs.
  const attachments: EmailAttachment[] = await Promise.all(
    tickets.map(async (t) => {
      const token = signTicketToken({
        version: 1,
        ticketId: t.ticketId,
        eventId: t.eventId,
        tokenId: t.qrTokenId,
      });
      const png = await QRCode.toBuffer(token, {
        type: "png",
        width: 240,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return {
        filename: `${t.ticketNumber}.png`,
        content: png.toString("base64"),
        contentId: `qr-${t.ticketNumber}`,
        contentType: "image/png",
      };
    }),
  );

  const provider = getEmailProvider();
  const result = await provider.send({
    to: order.customerEmail,
    subject,
    html,
    text,
    attachments,
  });
  logger.info("Order confirmation email sent", {
    orderId,
    provider: provider.name,
    to: order.customerEmail,
    id: result.id,
  });
}
