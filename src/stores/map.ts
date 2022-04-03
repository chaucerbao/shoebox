// Imports
import {
  DEFAULT_NAMESPACE,
  expandStoreSync,
  isDefined,
  isExpired,
  toStoreAsync,
} from '../helpers.js'
import { StoreAsync, StoreOptions, StoreRecord, StoreSync } from '../types.js'

// Type Definitions
interface MapOptions extends StoreOptions {
  client?: Map<string, StoreRecord<unknown>>
}

// Store
const mapStore = (options: MapOptions = {}) => {
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
    delete: remove,
    clear,
  }
}

export const mapSync = (options: MapOptions = {}): StoreSync =>
  expandStoreSync(mapStore(options))

export const mapAsync = (options: MapOptions = {}): StoreAsync =>
  toStoreAsync(mapSync(options))
