import { getRepo } from "@/lib/database";
import { Order } from "@/entities/order.entity";
import { Event } from "@/entities/event.entity";
import { getTicketSummariesForOrder } from "./ticket.service";
import { getEmailProvider } from "./email";
import { renderOrderConfirmationEmail } from "@/emails/order-confirmation";
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

  const provider = getEmailProvider();
  const result = await provider.send({
    to: order.customerEmail,
    subject,
    html,
    text,
  });
  logger.info("Order confirmation email sent", {
    orderId,
    provider: provider.name,
    to: order.customerEmail,
    id: result.id,
  });
}
