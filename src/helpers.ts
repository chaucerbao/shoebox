import { Store } from '.'

// Constants
export const DEFAULT_NAMESPACE = 'default'
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

// Store Helpers
export const asyncify =
  <T extends unknown[], U>(fn: (...params: T) => U) =>
  async (...params: T) =>
    fn(...params)

export const setter =
  (importer: Store['import']) =>
  <T>(key: string, value: T, ttl?: number) =>
    importer(key, { value, expiresAt: expiresAt(ttl) })

export const getter =
  (exporter: Store['export']) =>
  async <T>(key: string) =>
    (await exporter(key))?.value as T
