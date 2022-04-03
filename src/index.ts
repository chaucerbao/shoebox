// Imports
import { expandStoreAsync, isDefined } from './helpers.js'
import { mapAsync, mapSync } from './stores/map.js'
import { redisAsync } from './stores/redis.js'
import { sqliteAsync, sqliteSync } from './stores/sqlite.js'
import { StoreAsync, StoreRecord } from './types.js'

// Helpers
export const withDebounce = (
  store: StoreAsync,
  delays: Record<string, number>
): StoreAsync => {
  const cache = mapSync()
  const delayEntries = Object.entries(delays)
  const timeout = new Map<string, ReturnType<typeof setTimeout>>()
  const REGEX_PATTERN = /^\/(.*)\/(.*)$/

  const findDelay = (key: string) => {
    const matchFound = delayEntries.find(([delayKey]) => {
      const [, pattern, flags] = delayKey.match(REGEX_PATTERN) ?? []

      return pattern?.length
        ? new RegExp(pattern, flags).test(key)
        : delayKey === key
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

  return expandStoreAsync({
    import: importer,
    export: exporter,
    delete: remove,
    clear,
  })
}

// Exports
export { mapAsync, mapSync, redisAsync, sqliteAsync, sqliteSync }
