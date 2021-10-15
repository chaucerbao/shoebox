// Imports
import { Adapter, expiresAt, isDefined, isExpired } from '../index'

// Type Definitions
interface Record {
  value: unknown
  expiresAt?: number
}

// Adapter
export default (): Adapter => {
  const store = new Map<string, Record>()

  const clear = async () => store.clear()

  const remove = async (key: string) => {
    store.delete(key)
  }

  const set = async (key: string, value: unknown, ttl?: number) => {
    store.set(key, { value, expiresAt: expiresAt(ttl) })
  }

  const get = async (key: string) => {
    const record = store.get(key)

    if (isDefined(record)) {
      if (isExpired(record.expiresAt)) {
        remove(key)

        return undefined
      }

      return record.value
    }

    return undefined
  }

  return { get, set, delete: remove, clear }
}
