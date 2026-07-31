import fs from "node:fs";
import path from "node:path";
import type { EmailProvider, SendEmailInput } from "./provider";
import { logger } from "@/lib/logging";

/**
 * Development email provider. Sends nothing; instead it logs the message and
 * writes an .html preview to ./.emails so you can open and inspect it.
 */
export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";

  async send(input: SendEmailInput): Promise<{ id?: string }> {
    const dir = path.join(process.cwd(), ".emails");
    try {
      fs.mkdirSync(dir, { recursive: true });
      const safeTo = input.to.replace(/[^a-z0-9]/gi, "_");
      const file = path.join(dir, `${Date.now()}-${safeTo}.html`);
      fs.writeFileSync(file, input.html, "utf8");
      logger.info("FakeEmailProvider wrote email preview", {
        to: input.to,
        subject: input.subject,
        file,
      });
      return { id: path.basename(file) };
    } catch {
      logger.warn("FakeEmailProvider could not write preview; logged only", {
        to: input.to,
        subject: input.subject,
      });
      return {};
    }
  }
}
