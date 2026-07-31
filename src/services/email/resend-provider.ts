import type { EmailProvider, SendEmailInput } from "./provider";

/**
 * Resend email provider (https://resend.com). Uses the REST API directly, so
 * no SDK dependency. Requires EMAIL_API_KEY and a verified EMAIL_FROM address.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(input: SendEmailInput): Promise<{ id?: string }> {
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error(
        "EMAIL_API_KEY and EMAIL_FROM must be set to use the Resend provider.",
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id };
  }
}
