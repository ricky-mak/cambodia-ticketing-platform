import "reflect-metadata";
import dataSource from "@/data-source";
import { StaffUser } from "@/entities/staff-user.entity";
import { StaffRole, StaffStatus } from "@/types/enums";
import { hashPassword } from "@/lib/password";

/**
 * Create (or re-activate) the initial ADMIN staff account.
 *
 * Usage (PowerShell):
 *   $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="a-strong-password"; $env:ADMIN_NAME="Your Name"; yarn create-admin
 *
 * Re-running with an existing email updates that account's password, name, and
 * role, and re-activates it. Never commit real credentials.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(StaffUser);
    const passwordHash = await hashPassword(password);

    const existing = await repo.findOne({ where: { email } });
    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.role = StaffRole.ADMIN;
      existing.status = StaffStatus.ACTIVE;
      await repo.save(existing);
      console.log(`Updated existing admin: ${email}`);
    } else {
      const staff = repo.create({
        name,
        email,
        passwordHash,
        role: StaffRole.ADMIN,
        status: StaffStatus.ACTIVE,
      });
      await repo.save(staff);
      console.log(`Created admin: ${email}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
