// Imports
import { Database } from 'sqlite3'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  getter,
  isDefined,
  isExpired,
  serialize,
  setter,
} from '../helpers'
import { Store, StoreOptions, StoreRecord } from '../index'

// Type Definitions
interface SqliteOptions extends StoreOptions {
  client: Database
  table?: string
  debounce?: number
}

interface SqlRecord {
  namespace: string
  key: string
  value: string
  expires_at?: number
}

// Store
export default (options: SqliteOptions): Store => {
  const { client, table = 'shoebox', namespace = DEFAULT_NAMESPACE } = options
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

  const importer = <T = unknown>(key: string, record: StoreRecord<T>) =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `INSERT OR REPLACE INTO ${table} (namespace, key, value, expires_at) VALUES (?, ?, ?, ?)`,
        [namespace, key, serialize(record.value), record.expiresAt],
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const exporter = <T = unknown>(key: string) =>
    new Promise<StoreRecord<T> | undefined>(async (resolve, reject) => {
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

            return resolve({
              value: deserialize<T>(record.value),
              ...(record.expires_at ? { expiresAt: record.expires_at } : {}),
            } as StoreRecord<T>)
          }

          return resolve(undefined)
        }
      )
    })

  return {
    import: importer,
    export: exporter,
    get: getter(exporter),
    set: setter(importer),
    delete: remove,
    clear,
  }
}
