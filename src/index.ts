// Imports
import { getter, isDefined, setter } from './helpers.js'
import map from './stores/map.js'
import redis from './stores/redis.js'
import sqlite from './stores/sqlite.js'

// Type Definitions
export interface StoreRecord<T = unknown> {
  value: T
  expiresAt?: number
}

export interface Store {
  import: <T = unknown>(key: string, value: StoreRecord<T>) => Promise<void>
  export: <T = unknown>(key: string) => Promise<StoreRecord<T> | undefined>
  get: <T = unknown>(key: string) => Promise<T | undefined>
  set: <T = unknown>(key: string, value: T, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export interface StoreOptions {
  namespace?: string
}

// Helpers
export const withDebounce = (
  delays: Record<string, number>,
  store: Store
): Store => {
  const cache = map()
  const timeout = new Map<string, ReturnType<typeof setTimeout>>()

  const resetTimeout = (key: string) => {
    const timeoutKey = timeout.get(key)

    if (isDefined(timeoutKey)) {
      clearTimeout(timeoutKey)
      timeout.delete(key)
    }
  }

  const debounceWrite = async (
    key: string,
    writeTo: { cache: () => Promise<void>; store: () => Promise<void> }
  ) => {
    const delay = delays[key]

    // Not debouncing, so write to the Store immediately
    if (!isDefined(delay)) return writeTo.store()

    // Reset the timeout
    resetTimeout(key)

    // Write to the Cache
    await writeTo.cache()

    // Schedule writing to the Store after a delay
    timeout.set(
      key,
      setTimeout(() => {
        resetTimeout(key)
        void writeTo.store()
      }, delay)
    )
  }

  const clear = async () => {
    await Promise.all([cache.clear(), store.clear()])
  }

  const remove = async (key: string) =>
    debounceWrite(key, {
      cache: () => cache.set(key, undefined),
      store: () => store.delete(key),
    })

  const importer = async <T = unknown>(key: string, record: StoreRecord<T>) =>
    debounceWrite(key, {
      cache: () => cache.import<T>(key, record),
      store: () => store.import<T>(key, record),
    })

  const exporter = async <T = unknown>(key: string) => {
    const delay = delays[key]

    // Not debouncing, so return the record from the Store
    if (!isDefined(delay)) return store.export<T>(key)

    // If it exists, return the record from the Cache
    const cacheRecord = await cache.export<T>(key)
    if (isDefined(cacheRecord)) return cacheRecord

    // If it doesn't exist, check the Store
    const storeRecord = await store.export<T>(key)
    if (isDefined(storeRecord)) await cache.import<T>(key, storeRecord)

    return storeRecord
  }

  return {
    import: importer,
    export: exporter,
    get: getter(exporter),
    set: setter(importer),
    delete: remove,
    clear,
  }
}

// Exports
export { map, redis, sqlite }
