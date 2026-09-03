export type Address = { street?: string; town: string }

/** Both or neither: „12345" alone says nothing, and a street with no town cannot be found. */
export function addressFrom(parts: {
  street?: string
  postalCode?: string
  city?: string
}): Address | undefined {
  if (parts.postalCode === undefined || parts.city === undefined) {
    return undefined
  }

  const town = `${parts.postalCode} ${parts.city}`
  return { ...(parts.street === undefined ? {} : { street: parts.street }), town }
}
