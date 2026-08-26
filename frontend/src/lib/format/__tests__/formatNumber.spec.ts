import { describe, expect, it } from 'vitest'
import { formatBytes, formatCount } from '../formatNumber'

describe('formatCount', () => {
  it('groups thousands the German way', () => {
    expect(formatCount(100_000)).toBe('100.000')
  })
})

describe('formatBytes', () => {
  /** The old inline version rounded everything up to a kilobyte, so 200 bytes read as „1 KB". */
  it('reports small files in bytes rather than rounding them up', () => {
    expect(formatBytes(200)).toBe('200 Bytes')
    expect(formatBytes(1)).toBe('1 Byte')
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('switches to kilobytes at a kilobyte', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1023)).toBe('1.023 Bytes')
    expect(formatBytes(200 * 1024)).toBe('200 KB')
  })

  it('switches to megabytes with one decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(Math.round(3.14 * 1024 * 1024))).toBe('3,1 MB')
  })

  /** The upload limit is 4 MB, so a file at and just past it has to read unambiguously. */
  it('reads clearly either side of the upload limit', () => {
    expect(formatBytes(4 * 1024 * 1024)).toBe('4 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})
