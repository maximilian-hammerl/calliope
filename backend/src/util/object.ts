export function pickFromObject<T extends object, K extends keyof T>(
  obj: T,
  ...keys: Array<K>
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter((key) => key in obj).map((key) => [key, obj[key]]),
  ) as Pick<
    T,
    K
  >;
}

export function omitFromObject<T extends object, K extends keyof T>(
  obj: T,
  ...keys: Array<K>
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
}
