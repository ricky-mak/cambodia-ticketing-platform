import { redirect } from "next/navigation";

// The single-event settings page has been replaced by multi-event management
// under /admin/events. Keep this path working for old links/bookmarks.
export default function LegacyEventRedirect() {
  redirect("/admin/events");
}
