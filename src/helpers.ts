// Imports
import {
  StoreAsync,
  StoreCoreAsync,
  StoreCoreSync,
  StoreSync,
} from './types.js'

// Constants
export const DEFAULT_NAMESPACE = 'default'
const UNDEFINED = '__UNDEFINED__'

// General Helpers
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
const asyncify =
  <T extends unknown[], U>(fn: (...params: T) => U) =>
  async (...params: T) =>
    fn(...params)

export const expandStoreSync = (store: StoreCoreSync): StoreSync => ({
  ...store,
  get: <T>(key: string) => store.export(key)?.value as T,
  set: <T>(key: string, value: T, ttl?: number) =>
    store.import(key, { value, expiresAt: expiresAt(ttl) }),
})

export const expandStoreAsync = (store: StoreCoreAsync): StoreAsync => ({
  ...store,
  get: async <T>(key: string) => (await store.export(key))?.value as T,
  set: <T>(key: string, value: T, ttl?: number) =>
    store.import(key, { value, expiresAt: expiresAt(ttl) }),
})

export const toStoreAsync = (store: StoreSync): StoreAsync => ({
  import: asyncify(store.import),
  export: async (key: string) => store.export(key),
  get: async (key: string) => store.get(key),
  set: asyncify(store.set),
  delete: asyncify(store.delete),
  clear: asyncify(store.clear),
})
