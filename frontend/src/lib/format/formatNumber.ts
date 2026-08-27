/**
 * A limit read back to a member is prose, not data: German groups thousands with a period,
 * so a bound reads "100.000 Zeichen" rather than "100000 Zeichen".
 */
export function formatCount(value: number): string {
  return value.toLocaleString('de-DE')
}

/**
 * A file's size in the unit somebody can read: „3,1 MB", never 3248143. Binary steps, because that
 * is what an operating system reports and what the upload limit is measured against.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${formatCount(bytes)} ${bytes === 1 ? 'Byte' : 'Bytes'}`
  }

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${formatCount(Math.round(kilobytes))} KB`
  }

  // One decimal from a megabyte up, which is the difference between reading as inside the limit
  // and outside it.
  return `${(kilobytes / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}
