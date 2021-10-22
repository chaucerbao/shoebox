// Imports
import { expiresAt, isDefined, isExpired, NAMESPACE_DEFAULT } from '../helpers'
import { Store, StoreOptions, StoreRecord } from '../index'

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

  const importRecord = async <T = unknown>(
    key: string,
    record: StoreRecord<T>
  ) => {
    client.set(addNamespacePrefix(key), record)
  }

  const exportRecord = async <T = unknown>(key: string) => {
    const record = client.get(addNamespacePrefix(key))

    if (isDefined(record)) {
      if (isExpired(record.expiresAt)) {
        await remove(key)

        return undefined
      }

      return record as StoreRecord<T>
    }

    return undefined
  }

  const set = <T = unknown>(key: string, value: T, ttl?: number) =>
    importRecord(key, { value, expiresAt: expiresAt(ttl) })

  const get = async <T = unknown>(key: string) =>
    (await exportRecord(key))?.value as T

  return {
    import: importRecord,
    export: exportRecord,
    get,
    set,
    delete: remove,
    clear,
  }
}
