// Imports
import { mapSync } from './stores/map.js'
import {
  StoreAsync,
  StoreCoreAsync,
  StoreCoreSync,
  StoreOptions,
  StoreRecord,
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
export const exportStoreRecord = <T>(
  storeRecord: StoreRecord<T> | undefined,
  {
    onExpire,
  }: { onExpire?: (storeRecord: StoreRecord<T>) => void | Promise<void> } = {}
) => {
  if (!isDefined(storeRecord)) return undefined

  if (isExpired(storeRecord.expiresAt)) {
    void onExpire?.(storeRecord)

    return undefined
  }

  return {
    value: storeRecord.value as T,
    expiresAt: storeRecord.expiresAt ?? undefined,
  }
}

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

export const toStoreCoreAsync = (store: StoreCoreSync): StoreCoreAsync => ({
  import: asyncify(store.import),
  export: async (key: string) => store.export(key),
  delete: asyncify(store.delete),
  clear: asyncify(store.clear),
})

export const withDebounce = (
  store: StoreCoreAsync,
  { debounce = {} }: StoreOptions
): StoreCoreAsync => {
  const cache = mapSync()
  const timeout = new Map<string, ReturnType<typeof setTimeout>>()
  const debounceEntries = Object.entries(debounce)
  const REGEX_PATTERN = /^\/(.*)\/(.*)$/

  const findDelay = (key: string) => {
    const matchFound = debounceEntries.find(([debounceKey]) => {
      const [, pattern, flags] = debounceKey.match(REGEX_PATTERN) ?? []

      return pattern?.length
        ? new RegExp(pattern, flags).test(key)
        : debounceKey === key
    })

    return isDefined(matchFound) ? matchFound[1] : undefined
  }

  const resetTimeout = (key: string) => {
    const timeoutKey = timeout.get(key)

    if (isDefined(timeoutKey)) {
      clearTimeout(timeoutKey)
      timeout.delete(key)
    }
  }

  const debounceWrite = async (
    key: string,
    writeTo: { cache: () => void; store: () => Promise<void> }
  ) => {
    const delay = findDelay(key)

    // Not debouncing, so write to the Store immediately
    if (!isDefined(delay)) return writeTo.store()

    // Reset the timeout
    resetTimeout(key)

    // Write to the Cache
    writeTo.cache()

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
    // Not debounced, only key-based writes can be debounced
    cache.clear()
    await store.clear()
  }

  const remove = async (key: string) =>
    debounceWrite(key, {
      cache: () => cache.set(key, undefined),
      store: () => store.delete(key),
    })

  const importer = async <T>(key: string, record: StoreRecord<T>) =>
    debounceWrite(key, {
      cache: () => cache.import<T>(key, record),
      store: () => store.import<T>(key, record),
    })

  const exporter = async <T>(key: string) => {
    const delay = findDelay(key)

    // Not debouncing, so return the record from the Store
    if (!isDefined(delay)) return store.export<T>(key)

    // If it exists, return the record from the Cache
    const cacheRecord = cache.export<T>(key)
    if (isDefined(cacheRecord)) return cacheRecord

    // If it doesn't exist, check the Store
    const storeRecord = await store.export<T>(key)
    if (isDefined(storeRecord)) cache.import<T>(key, storeRecord)

    return storeRecord
  }

  return {
    import: importer,
    export: exporter,
    delete: remove,
    clear,
  }
}
