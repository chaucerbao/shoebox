// Imports
import { Redis } from 'ioredis'
import {
  deserialize,
  isDefined,
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
  const { client, namespace = 'default' } = options

  const namespaceSet = ['namespace', namespace].join(':')
  const attachNamespace = (key: string) => [namespace, key].join(':')

  const clear = async () => {
    client.del([...(await client.smembers(namespaceSet)), namespaceSet])
  }

  const remove = async (key: string) => {
    await Promise.all([
      client.del(attachNamespace(key)),
      client.srem(namespaceSet, attachNamespace(key)),
    ])
  }

  const set = async <T = unknown>(key: string, value: T, ttl?: number) => {
    const serializedValue = serialize(value)

    await Promise.all([
      isDefined(ttl)
        ? await client.set(attachNamespace(key), serializedValue, 'PX', ttl)
        : await client.set(attachNamespace(key), serializedValue),
      client.sadd(namespaceSet, attachNamespace(key)),
    ])
  }

  const get = async <T = unknown>(key: string) => {
    const serializedValue = await client.get(attachNamespace(key))

    return isDefined(serializedValue)
      ? deserialize<T>(serializedValue)
      : undefined
  }

  return { get, set, delete: remove, clear }
}
