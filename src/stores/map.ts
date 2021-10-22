// Imports
import {
  DEFAULT_NAMESPACE,
  getter,
  isDefined,
  isExpired,
  setter,
} from '../helpers'
import { Store, StoreOptions, StoreRecord } from '../index'

// Type Definitions
interface MapOptions extends StoreOptions {
  client?: Map<string, StoreRecord>
}

// Store
export default (options: MapOptions = {}): Store => {
  const {
    client = new Map<string, StoreRecord>(),
    namespace = DEFAULT_NAMESPACE,
  } = options

  const addNamespacePrefix = (key: string) => [namespace, key].join(':')

  const clear = async () => {
    const namespacePrefix = addNamespacePrefix('')

    client.forEach((_, keyWithNamespace) => {
      if (keyWithNamespace.startsWith(namespacePrefix))
        client.delete(keyWithNamespace)
    })
  }

  const remove = async (key: string) => {
    client.delete(addNamespacePrefix(key))
  }

  const importer = async <T = unknown>(key: string, record: StoreRecord<T>) => {
    client.set(addNamespacePrefix(key), record)
  }

  const exporter = async <T = unknown>(key: string) => {
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

  return {
    import: importer,
    export: exporter,
    get: getter(exporter),
    set: setter(importer),
    delete: remove,
    clear,
  }
}
