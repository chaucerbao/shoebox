// Imports
import { Redis } from 'ioredis'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  getter,
  isDefined,
  serialize,
  setter,
} from '../helpers.js'
import { Store, StoreOptions, StoreRecord } from '../index.js'

// Type Definitions
interface RedisOptions extends StoreOptions {
  client: Redis
}

// Store
export default (options: RedisOptions): Store => {
  const { client, namespace = DEFAULT_NAMESPACE } = options

  const NAMESPACE = ['namespace', namespace].join(':')
  const addNamespacePrefix = (key: string) => [namespace, key].join(':')

  const clear = async () => {
    await client.del([...(await client.smembers(NAMESPACE)), NAMESPACE])
  }

  const remove = async (key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)

    await Promise.all([
      client.del(keyWithNamespace),
      client.srem(NAMESPACE, keyWithNamespace),
    ])
  }

  const importer = async <T>(key: string, record: StoreRecord<T>) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedRecord = serialize(record)
    const ttl = isDefined(record.expiresAt)
      ? record.expiresAt - Date.now()
      : undefined

    await Promise.all([
      isDefined(ttl)
        ? client.set(keyWithNamespace, serializedRecord, 'PX', ttl)
        : client.set(keyWithNamespace, serializedRecord),
      client.sadd(NAMESPACE, keyWithNamespace),
    ])
  }

  const exporter = async <T>(key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedRecord = await client.get(keyWithNamespace)
    const record = isDefined(serializedRecord)
      ? deserialize<StoreRecord<T>>(serializedRecord)
      : undefined

    return record
      ? ({
          value: typeof record.value !== 'undefined' ? record.value : undefined,
          expiresAt: record.expiresAt ?? undefined,
        } as StoreRecord<T>)
      : undefined
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
