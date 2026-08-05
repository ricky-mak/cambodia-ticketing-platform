/**
 * Name of the cookie that remembers the admin's active event. Kept in its own
 * module (no server-only imports) so the client EventSelector can reference it
 * without pulling in `next/headers`.
 */
export const ACTIVE_EVENT_COOKIE = "admin_active_event";
