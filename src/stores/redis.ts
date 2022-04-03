// Imports
import { Redis } from 'ioredis'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  expandStoreAsync,
  isDefined,
  serialize,
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
    delete: remove,
    clear,
  }
}

export const redisAsync = (options: RedisOptions): StoreAsync =>
  expandStoreAsync(redisStore(options))
