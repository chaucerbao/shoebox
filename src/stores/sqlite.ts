// Imports
import { Database } from 'sqlite3'
import {
  deserialize,
  expiresAt,
  isDefined,
  isExpired,
  NAMESPACE_DEFAULT,
  serialize,
  Store,
  StoreOptions,
} from '../index'

// Type Definitions
interface SqliteOptions extends StoreOptions {
  client: Database
  table?: string
}

interface SqlRecord {
  namespace: string
  key: string
  value: string
  expires_at?: number
}

// Store
export default (options: SqliteOptions): Store => {
  const { client, table = 'shoebox', namespace = NAMESPACE_DEFAULT } = options
  let isInitialized = false

  const createTable = () =>
    new Promise<void>((resolve, reject) => {
      if (!isInitialized) {
        client.run(
          `
            CREATE TABLE IF NOT EXISTS ${table} (
              namespace TEXT NOT NULL,
              key TEXT NOT NULL,
              value TEXT,
              expires_at INTEGER,
              PRIMARY KEY (namespace, key)
            )
          `,
          (error) => {
            isInitialized = true

            return isDefined(error) ? reject(error) : resolve()
          }
        )
      } else {
        return resolve()
      }
    })

  const clear = () =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `DELETE FROM ${table} WHERE namespace = ?`,
        namespace,
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const remove = (key: string) =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `DELETE FROM ${table} WHERE namespace = ? AND key = ?`,
        [namespace, key],
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const set = <T = unknown>(key: string, value: T, ttl?: number) =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `INSERT OR REPLACE INTO ${table} (namespace, key, value, expires_at) VALUES (?, ?, ?, ?)`,
        [namespace, key, serialize(value), expiresAt(ttl)],
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const get = <T = unknown>(key: string) =>
    new Promise<T | undefined>(async (resolve, reject) => {
      await createTable()

      client.get(
        `SELECT * FROM ${table} WHERE namespace = ? AND key = ? LIMIT 1`,
        [namespace, key],
        (error, record: SqlRecord) => {
          if (isDefined(error)) return reject(error)

          if (isDefined(record)) {
            if (isExpired(record.expires_at)) {
              return remove(key).then(() => resolve(undefined))
            }

            return resolve(deserialize<T>(record.value))
          }

          return resolve(undefined)
        }
      )
    })

  return { get, set, delete: remove, clear }
}
