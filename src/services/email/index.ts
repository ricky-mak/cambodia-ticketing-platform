import type { EmailProvider } from "./provider";
import { FakeEmailProvider } from "./fake-provider";
import { ResendEmailProvider } from "./resend-provider";

export * from "./provider";

let cached: EmailProvider | undefined;

/**
 * Select the active email provider from EMAIL_PROVIDER ("fake" | "resend").
 * Defaults to "fake" so local dev never depends on an email account.
 */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const name = (process.env.EMAIL_PROVIDER ?? "fake").toLowerCase();
  cached = name === "resend" ? new ResendEmailProvider() : new FakeEmailProvider();
  return cached;
}
