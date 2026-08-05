import { getDataSource, getRepo } from "@/lib/database";
import { AuditLog } from "@/entities/audit-log.entity";
import { AuditAction } from "@/types/enums";
import { logger } from "@/lib/logging";

export interface WriteAuditInput {
  staffUserId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Persist an audit-log entry. Auditing must never break the primary action, so
 * failures are logged and swallowed rather than thrown.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    const repo = await getRepo(AuditLog);
    await repo.save(
      repo.create({
        staffUserId: input.staffUserId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        previousData: input.previousData ?? null,
        newData: input.newData ?? null,
        metadata: input.metadata ?? null,
      }),
    );
  } catch (error) {
    logger.error("Failed to write audit log", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface AuditLogRow {
  action: string;
  entityType: string | null;
  entityId: string | null;
  staffName: string | null;
  createdAt: string;
}

/**
 * Recent audit entries. When `scopeOrganizerId` is set (an organizer admin),
 * only entries whose actor belongs to that organizer are returned — so an
 * organizer sees their own staff's actions but not other tenants' or the
 * platform's. Platform admins pass null and see everything.
 *
 * Note: scoping is by the acting staff member's organizer (audit_logs has no
 * organizer_id of its own yet), so platform-staff actions on an organizer and
 * system rows with no actor are not shown to that organizer. Adding an
 * organizer_id column to audit_logs would make this exact; deferred.
 */
export async function listAuditLogs(
  limit = 100,
  scopeOrganizerId: string | null = null,
): Promise<AuditLogRow[]> {
  const ds = await getDataSource();
  const rows: Array<{
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    staff_name: string | null;
    created_at: Date;
  }> = await ds.query(
    `SELECT a.action, a.entity_type, a.entity_id, u.name AS staff_name, a.created_at
       FROM audit_logs a
       LEFT JOIN staff_users u ON u.id = a.staff_user_id
      WHERE $2::uuid IS NULL OR u.organizer_id = $2
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit, scopeOrganizerId],
  );
  return rows.map((r) => ({
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    staffName: r.staff_name,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
