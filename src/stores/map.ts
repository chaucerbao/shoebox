// Imports
import {
  DEFAULT_NAMESPACE,
  expandStoreAsync,
  expandStoreSync,
  exportStoreRecord,
  toStoreCoreAsync,
  withDebounce,
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

  const importer = <T>(key: string, storeRecord: StoreRecord<T>) => {
    client.set(addNamespacePrefix(key), storeRecord)
  }

  const exporter = <T>(key: string) => {
    const storeRecord = client.get(addNamespacePrefix(key)) as StoreRecord<T>

    return exportStoreRecord<T>(storeRecord, { onExpire: () => remove(key) })
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
  expandStoreAsync(withDebounce(toStoreCoreAsync(mapSync(options)), options))
