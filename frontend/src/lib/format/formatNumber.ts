/**
 * A limit read back to a member is prose, not data: German groups thousands with a period,
 * so a bound reads "100.000 Zeichen" rather than "100000 Zeichen".
 */
export function formatCount(value: number): string {
  return value.toLocaleString('de-DE')
}
