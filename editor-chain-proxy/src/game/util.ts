// bigint/Result → string helpers, matching the client's convertBN* utilities
// (values are kept as exact strings, never coerced to JS number).
export function bnArrayToStrings(arr: ArrayLike<unknown>): string[] {
  return Array.from(arr, (v) => (v as { toString(): string }).toString());
}

export function bn2dArrayToStrings(arr: ArrayLike<ArrayLike<unknown>>): string[][] {
  return Array.from(arr, (row) => bnArrayToStrings(row));
}
