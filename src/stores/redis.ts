// Imports
import { Redis } from 'ioredis'
import {
  deserialize,
  isDefined,
  NAMESPACE_DEFAULT,
  serialize,
  Store,
  StoreOptions,
} from '../index'

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

  const set = async <T = unknown>(key: string, value: T, ttl?: number) => {
    const keyWithNamespace = addNamespacePrefix(key)
    const serializedValue = serialize(value)

    await Promise.all([
      isDefined(ttl)
        ? await client.set(keyWithNamespace, serializedValue, 'PX', ttl)
        : await client.set(keyWithNamespace, serializedValue),
      client.sadd(NAMESPACES, keyWithNamespace),
    ])
  }

  const get = async <T = unknown>(key: string) => {
    const serializedValue = await client.get(addNamespacePrefix(key))

    return isDefined(serializedValue)
      ? deserialize<T>(serializedValue)
      : undefined
  }

  return { get, set, delete: remove, clear }
}
