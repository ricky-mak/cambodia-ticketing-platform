/**
 * Spreadsheet-style bijective base-26 row labels:
 * 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB", ...
 */
export function rowLabelForIndex(index: number): string {
  let n = index + 1; // 1-based
  let label = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}
