// Imports
import {
  Adapter,
  AdapterOptions,
  createAttachNamespace,
  expiresAt,
  isDefined,
  isExpired,
} from '../index'

// Type Definitions
interface MapOptions extends AdapterOptions {
  client?: Map<string, MapRecord>
}

interface MapRecord {
  value: unknown
  expiresAt?: number
}

// Adapter
export default (options: MapOptions): Adapter => {
  const { client = new Map<string, MapRecord>(), namespace = 'shoe' } = options
  const attachNamespace = createAttachNamespace(namespace)

  const clear = async () => {
    const startsWithNamespace = new RegExp(`^${attachNamespace('')}`)

    client.forEach((_, namespacedKey) => {
      if (namespacedKey.startsWith(attachNamespace(''))) {
        remove(namespacedKey.replace(startsWithNamespace, ''))
      }
    })
  }

  const remove = async (key: string) => {
    client.delete(attachNamespace(key))
  }

  const set = async <T = unknown>(key: string, value: T, ttl?: number) => {
    client.set(attachNamespace(key), { value, expiresAt: expiresAt(ttl) })
  }

  const get = async <T = unknown>(key: string) => {
    const record = client.get(attachNamespace(key))

    if (isDefined(record)) {
      if (isExpired(record.expiresAt)) {
        remove(key)

        return undefined
      }

      return record.value as T
    }

    return undefined
  }

  return { get, set, delete: remove, clear }
}
