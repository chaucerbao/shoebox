// Imports
import { Redis } from 'ioredis'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  expiresAt,
  getter,
  isDefined,
  serialize,
  setter,
} from '../helpers'
import { Store, StoreOptions, StoreRecord } from '../index'

// Type Definitions
interface RedisOptions extends StoreOptions {
  client: Redis
  debounce?: number
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

  const importer = async <T = unknown>(key: string, record: StoreRecord<T>) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedValue = serialize(record.value)
    const ttl = isDefined(record.expiresAt)
      ? record.expiresAt - Date.now()
      : undefined

    await Promise.all([
      isDefined(ttl)
        ? client.set(keyWithNamespace, serializedValue, 'PX', ttl)
        : client.set(keyWithNamespace, serializedValue),
      client.sadd(NAMESPACE, keyWithNamespace),
    ])
  }

  const exporter = async <T = unknown>(key: string) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const [serializedValue, ttl] = await Promise.all([
      client.get(keyWithNamespace),
      client.pttl(keyWithNamespace),
    ])

    return isDefined(serializedValue)
      ? {
          value: deserialize<T>(serializedValue),
          ...(ttl > 0 ? { expiresAt: expiresAt(ttl) } : {}),
        }
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
