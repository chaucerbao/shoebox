// Imports
import { Redis } from 'ioredis'
import {
  deserialize,
  expiresAt,
  isDefined,
  NAMESPACE_DEFAULT,
  serialize,
} from '../helpers'
import { Store, StoreOptions, StoreRecord } from '../index'

// Type Definitions
interface RedisOptions extends StoreOptions {
  client: Redis
}

// Store
export default (options: RedisOptions): Store => {
  const { client, namespace = NAMESPACE_DEFAULT } = options

  const NAMESPACES = ['namespace', namespace].join(':')
  const addNamespacePrefix = (key: string) => [namespace, key].join(':')

  const clear = async () => {
    client.del([...(await client.smembers(NAMESPACES)), NAMESPACES])
  }

  const remove = async (key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)

    await Promise.all([
      client.del(keyWithNamespace),
      client.srem(NAMESPACES, keyWithNamespace),
    ])
  }

  const importRecord = async <T = unknown>(
    key: string,
    record: StoreRecord<T>
  ) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedValue = serialize(record.value)
    const ttl = isDefined(record.expiresAt)
      ? record.expiresAt - Date.now()
      : undefined

    await Promise.all([
      isDefined(ttl)
        ? client.set(keyWithNamespace, serializedValue, 'PX', ttl)
        : client.set(keyWithNamespace, serializedValue),
      client.sadd(NAMESPACES, keyWithNamespace),
    ])
  }

  const exportRecord = async <T = unknown>(key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const [serializedValue, ttl] = await Promise.all([
      client.get(keyWithNamespace),
      client.pttl(keyWithNamespace),
    ])

    return isDefined(serializedValue)
      ? {
          value: deserialize<T>(serializedValue),
          expiresAt: ttl > 0 ? expiresAt(ttl) : undefined,
        }
      : undefined
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
