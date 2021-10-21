// Imports
import {
  expiresAt,
  isDefined,
  isExpired,
  NAMESPACE_DEFAULT,
  Store,
  StoreOptions,
} from '../index'

// Type Definitions
interface MapOptions extends StoreOptions {
  client?: Map<string, MapRecord>
}

interface MapRecord {
  value: unknown
  expiresAt?: number
}

// Store
export default (options: MapOptions = {}): Store => {
  const {
    client = new Map<string, MapRecord>(),
    namespace = NAMESPACE_DEFAULT,
  } = options

  const addNamespacePrefix = (key: string) => [namespace, key].join(':')

  const clear = async () => {
    const namespacePrefix = addNamespacePrefix('')
    const namespacePrefixRegex = new RegExp(`^${namespacePrefix}`)

    client.forEach((_, keyWithNamespace) => {
      if (keyWithNamespace.startsWith(namespacePrefix))
        remove(keyWithNamespace.replace(namespacePrefixRegex, ''))
    })
  }

  const remove = async (key: string) => {
    client.delete(addNamespacePrefix(key))
  }

  const set = async <T = unknown>(key: string, value: T, ttl?: number) => {
    client.set(addNamespacePrefix(key), { value, expiresAt: expiresAt(ttl) })
  }

  const get = async <T = unknown>(key: string) => {
    const record = client.get(addNamespacePrefix(key))

    if (isDefined(record)) {
      if (isExpired(record.expiresAt)) {
        await remove(key)

        return undefined
      }

      return record.value as T
    }

    return undefined
  }

  return { get, set, delete: remove, clear }
}
