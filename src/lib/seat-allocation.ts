export interface LockedSeat {
  id: string;
  rowLabel: string;
  seatNumber: number;
}

/**
 * Choose `quantity` seats from a set of currently-lockable seats.
 *
 * Preference: a contiguous block within a single row (same rowLabel,
 * consecutive seatNumber). Falls back to the first `quantity` seats (which the
 * caller supplies pre-sorted by rowLabel then seatNumber) if no contiguous
 * block exists. Returns null if there aren't enough seats.
 *
 * Pure and deterministic so it can be unit tested without a database.
 */
export function chooseContiguousSeats(
  locked: LockedSeat[],
  quantity: number,
): LockedSeat[] | null {
  if (quantity < 1) return null;
  if (locked.length < quantity) return null;
  if (quantity === 1) return [locked[0]!];

  // Group seats by row, preserving first-seen row order.
  const rowOrder: string[] = [];
  const byRow = new Map<string, LockedSeat[]>();
  for (const seat of locked) {
    let arr = byRow.get(seat.rowLabel);
    if (!arr) {
      arr = [];
      byRow.set(seat.rowLabel, arr);
      rowOrder.push(seat.rowLabel);
    }
    arr.push(seat);
  }

  for (const rowLabel of rowOrder) {
    const seats = byRow
      .get(rowLabel)!
      .slice()
      .sort((a, b) => a.seatNumber - b.seatNumber);
    for (let i = 0; i + quantity <= seats.length; i++) {
      const first = seats[i]!;
      const last = seats[i + quantity - 1]!;
      if (last.seatNumber - first.seatNumber === quantity - 1) {
        return seats.slice(i, i + quantity);
      }
    }
  }

  // No contiguous run — take the first `quantity` available seats.
  return locked.slice(0, quantity);
}
