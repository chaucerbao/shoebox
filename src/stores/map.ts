// Imports
import {
  asyncify,
  DEFAULT_NAMESPACE,
  expiresAt,
  isDefined,
  isExpired,
} from '../helpers.js'
import { Store, StoreOptions, StoreRecord } from '../index.js'

// Type Definitions
interface MapOptions extends StoreOptions {
  client?: Map<string, StoreRecord<unknown>>
}

// Store
export const mapSync = (options: MapOptions = {}) => {
  const {
    client = new Map<string, StoreRecord<unknown>>(),
    namespace = DEFAULT_NAMESPACE,
  } = options

  const addNamespacePrefix = (key: string) => [namespace, key].join(':')

  const clear = () => {
    const namespacePrefix = addNamespacePrefix('')

    client.forEach((_, keyWithNamespace) => {
      if (keyWithNamespace.startsWith(namespacePrefix))
        client.delete(keyWithNamespace)
    })
  }

  const remove = (key: string) => {
    client.delete(addNamespacePrefix(key))
  }

  const importer = <T>(key: string, record: StoreRecord<T>) => {
    client.set(addNamespacePrefix(key), record)
  }

  const exporter = <T>(key: string) => {
    const record = client.get(addNamespacePrefix(key))

    if (isDefined(record)) {
      if (isExpired(record.expiresAt)) {
        remove(key)

        return undefined
      }

      return {
        value: record.value,
        expiresAt: record.expiresAt,
      } as StoreRecord<T>
    }

    return undefined
  }

  return {
    import: importer,
    export: exporter,
    get: <T>(key: string) => exporter(key)?.value as T,
    set: <T>(key: string, value: T, ttl?: number) =>
      importer(key, { value, expiresAt: expiresAt(ttl) }),
    delete: remove,
    clear,
  }
}

export default (options: MapOptions = {}): Store => {
  const map = mapSync(options)

  return {
    import: asyncify(map.import),
    export: async (key: string) => map.export(key),
    get: async (key: string) => map.get(key),
    set: asyncify(map.set),
    delete: asyncify(map.delete),
    clear: asyncify(map.clear),
  }
}
