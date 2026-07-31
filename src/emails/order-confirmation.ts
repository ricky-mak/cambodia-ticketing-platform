import { formatMoney } from "@/lib/money";

export interface OrderConfirmationData {
  baseUrl: string;
  event: {
    name: string;
    startsAtIso: string | null;
    venueName: string | null;
    venueAddress: string | null;
    contactEmail: string | null;
  };
  order: {
    orderNumber: string;
    customerName: string;
    totalMinor: number;
    currency: string;
  };
  tickets: Array<{
    publicToken: string;
    ticketNumber: string;
    seatLabel: string;
    zoneName: string;
  }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date to be announced";
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso)) + " (UTC)"
  );
}

export function renderOrderConfirmationEmail(data: OrderConfirmationData): {
  subject: string;
  html: string;
  text: string;
} {
  const { baseUrl, event, order, tickets } = data;
  const subject = `Your tickets for ${event.name} — ${order.orderNumber}`;
  const when = formatDate(event.startsAtIso);
  const venue = [event.venueName, event.venueAddress]
    .filter(Boolean)
    .join(", ");

  const ticketBlocks = tickets
    .map((t) => {
      const ticketUrl = `${baseUrl}/ticket/${t.publicToken}`;
      const qrUrl = `${baseUrl}/api/tickets/${t.publicToken}/qr`;
      return `
      <table role="presentation" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;margin:12px 0;">
        <tr>
          <td style="padding:16px;vertical-align:top;">
            <div style="font-size:14px;color:#111827;font-weight:600;">${escapeHtml(t.zoneName)} — Seat ${escapeHtml(t.seatLabel)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Ticket ${escapeHtml(t.ticketNumber)}</div>
            <a href="${ticketUrl}" style="display:inline-block;margin-top:10px;font-size:13px;color:#2563eb;">View ticket &amp; QR &rarr;</a>
          </td>
          <td style="padding:16px;text-align:right;width:150px;">
            <img src="${qrUrl}" alt="QR code for seat ${escapeHtml(t.seatLabel)}" width="120" height="120" style="width:120px;height:120px;" />
          </td>
        </tr>
      </table>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;padding:24px;">
      <tr><td>
        <h1 style="font-size:20px;margin:0 0 4px;">${escapeHtml(event.name)}</h1>
        <p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(when)}</p>
        ${venue ? `<p style="margin:2px 0 0;color:#6b7280;font-size:14px;">${escapeHtml(venue)}</p>` : ""}

        <p style="margin:20px 0 0;font-size:14px;">Hi ${escapeHtml(order.customerName)}, your payment is confirmed. Order <strong>${escapeHtml(order.orderNumber)}</strong> — ${tickets.length} ticket(s), total ${escapeHtml(formatMoney(order.totalMinor, order.currency))}.</p>

        <h2 style="font-size:16px;margin:24px 0 4px;">Your tickets</h2>
        ${ticketBlocks || "<p style=\"font-size:14px;\">Your tickets will appear here.</p>"}

        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Present each QR code at the entrance. You can also open the ticket links above on your phone.</p>
        ${event.contactEmail ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Questions? Contact ${escapeHtml(event.contactEmail)}.</p>` : ""}
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `${event.name}`,
    when,
    venue,
    "",
    `Order ${order.orderNumber} — ${tickets.length} ticket(s), total ${formatMoney(order.totalMinor, order.currency)}.`,
    "",
    ...tickets.map(
      (t) =>
        `${t.zoneName} Seat ${t.seatLabel} (${t.ticketNumber}): ${baseUrl}/ticket/${t.publicToken}`,
    ),
    "",
    "Present each QR code at the entrance.",
    event.contactEmail ? `Questions? Contact ${event.contactEmail}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
