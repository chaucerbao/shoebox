// Imports
import { Adapter, isDefined } from '../index'

// Type Definitions
interface Record {
  value: unknown
  expiresAt?: number
}

// Adapter
export default (): Adapter => {
  const store = new Map<string, Record>()

  const get = async (key: string) => {
    const record = store.get(key)

    if (isDefined(record)) {
      if (isDefined(record.expiresAt) && record.expiresAt < Date.now()) {
        store.delete(key)

        return undefined
      }

      return record.value
    }

    return undefined
  }

  const set = async (key: string, value: unknown, ttl?: number) => {
    store.set(key, {
      value,
      expiresAt: isDefined(ttl) ? Date.now() + ttl : undefined,
    })
  }

  const remove = async (key: string) => store.delete(key)

  const clear = async () => store.clear()

  return { get, set, delete: remove, clear }
}
