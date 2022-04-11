// Imports
import { Redis } from 'ioredis'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  expandStoreAsync,
  exportStoreRecord,
  isDefined,
  serialize,
  withDebounce,
} from '../helpers.js'
import { StoreAsync, StoreOptions, StoreRecord } from '../types.js'

// Type Definitions
interface RedisOptions extends StoreOptions {
  client: Redis
}

// Store
const redisStore = (options: RedisOptions) => {
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

  const importer = async <T>(key: string, storeRecord: StoreRecord<T>) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedStoreRecord = serialize(storeRecord)
    const ttl = isDefined(storeRecord.expiresAt)
      ? storeRecord.expiresAt - Date.now()
      : undefined

    await Promise.all([
      isDefined(ttl)
        ? client.set(keyWithNamespace, serializedStoreRecord, 'PX', ttl)
        : client.set(keyWithNamespace, serializedStoreRecord),
      client.sadd(NAMESPACE, keyWithNamespace),
    ])
  }

  const exporter = async <T>(key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedStoreRecord = await client.get(keyWithNamespace)
    const storeRecord = isDefined(serializedStoreRecord)
      ? deserialize<StoreRecord<T>>(serializedStoreRecord)
      : undefined

    return exportStoreRecord<T>(storeRecord)
  }

  return {
    import: importer,
    export: exporter,
    delete: remove,
    clear,
  }
}

export const redisAsync = (options: RedisOptions): StoreAsync =>
  expandStoreAsync(withDebounce(redisStore(options), options))
