"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchRow {
  ticketId: string;
  ticketNumber: string;
  attendeeName: string;
  zoneName: string;
  seatLabel: string;
  status: string;
  orderNumber: string;
}

export default function CheckInSearchPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setRows(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function checkIn(ticketId: string) {
    setBusyId(ticketId);
    try {
      const res = await fetch("/api/tickets/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json();
      setRows((prev) =>
        prev.map((r) =>
          r.ticketId === ticketId
            ? {
                ...r,
                status:
                  data.outcome === "CHECKED_IN" ? "CHECKED_IN" : r.status,
              }
            : r,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Find attendee</h1>
        <p className="text-sm text-muted-foreground">
          Search by name, email, ticket number, or order number.
        </p>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sok Dara, TKT-…, ORD-…"
        />
        <Button type="submit" disabled={loading || q.trim().length < 2}>
          {loading ? "…" : "Search"}
        </Button>
      </form>

      <div className="space-y-2">
        {searched && !loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching tickets.</p>
        )}
        {rows.map((r) => (
          <div
            key={r.ticketId}
            className="flex items-center justify-between rounded border p-3 text-sm"
          >
            <div>
              <p className="font-medium">{r.attendeeName}</p>
              <p className="text-muted-foreground">
                {r.zoneName} · Seat {r.seatLabel} · {r.ticketNumber}
              </p>
              <p className="text-xs text-muted-foreground">{r.status}</p>
            </div>
            {r.status === "VALID" ? (
              <Button
                size="sm"
                onClick={() => checkIn(r.ticketId)}
                disabled={busyId === r.ticketId}
              >
                {busyId === r.ticketId ? "…" : "Check in"}
              </Button>
            ) : r.status === "CHECKED_IN" ? (
              <span className="text-xs font-semibold text-green-600">
                Checked in
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {r.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
