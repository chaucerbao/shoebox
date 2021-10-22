// Constants
export const NAMESPACE_DEFAULT = 'default'
const UNDEFINED = '__UNDEFINED__'

// Helpers
export const isDefined = <T>(value: T): value is NonNullable<T> =>
  typeof value !== 'undefined' && value !== null

export const isExpired = (expiresAt?: number) =>
  isDefined(expiresAt) && expiresAt <= Date.now()

export const expiresAt = (ttl?: number) =>
  isDefined(ttl) ? Date.now() + ttl : undefined

export const serialize = (value: unknown) =>
  JSON.stringify(value, (_, v) => (typeof v === 'undefined' ? UNDEFINED : v))

export const deserialize = <T = unknown>(serializedValue: string) =>
  JSON.parse(serializedValue, (_, v) => (v === UNDEFINED ? undefined : v)) as T

export const debounce = <T extends unknown[], U>(
  callback: (...args: T) => PromiseLike<U> | U,
  delay: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...params: T): Promise<U> => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(callback(...params)), delay)
    })
  }
}
