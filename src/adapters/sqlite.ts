// Imports
import { Database } from 'sqlite3'
import {
  Adapter,
  AdapterOptions,
  createAttachNamespace,
  expiresAt,
  isDefined,
  isExpired,
} from '../index'

// Type Definitions
interface SqliteOptions extends AdapterOptions {
  client: Database
  table?: string
}

// Constants
const UNDEFINED = '__UNDEFINED__'

// Adapter
export default (options: SqliteOptions): Adapter => {
  const { client, table = 'shoebox', namespace = 'shoe' } = options
  const attachNamespace = createAttachNamespace(namespace)
  let isInitialized = false

  const createTable = () =>
    new Promise<void>((resolve, reject) => {
      if (!isInitialized) {
        client.run(
          `
            CREATE TABLE IF NOT EXISTS ${table} (
              key TEXT UNIQUE,
              value TEXT,
              expires_at INTEGER
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
        `DELETE FROM ${table} WHERE key LIKE ?`,
        `${attachNamespace('')}%`,
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const remove = (key: string) =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `DELETE FROM ${table} WHERE key = ?`,
        attachNamespace(key),
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const set = (key: string, value: unknown, ttl?: number) =>
    new Promise<void>(async (resolve, reject) => {
      await createTable()

      client.run(
        `INSERT OR REPLACE INTO ${table} (key, value, expires_at) VALUES ($key, $value, $expiresAt)`,
        {
          $key: attachNamespace(key),
          $value: JSON.stringify(value, (k, v) =>
            typeof v === 'undefined' ? UNDEFINED : v
          ),
          $expiresAt: expiresAt(ttl),
        },
        (error) => (isDefined(error) ? reject(error) : resolve())
      )
    })

  const get = (key: string) =>
    new Promise(async (resolve, reject) => {
      await createTable()

      client.get(
        `SELECT * FROM ${table} WHERE key = ?`,
        attachNamespace(key),
        (error, record) => {
          if (isDefined(error)) return reject(error)

          if (isDefined(record)) {
            if (isExpired(record.expires_at)) {
              return remove(key).then(() => resolve(undefined))
            }

            return resolve(
              JSON.parse(record.value, (k, v) =>
                v === UNDEFINED ? undefined : v
              )
            )
          }

          return resolve(undefined)
        }
      )
    })

  return { get, set, delete: remove, clear }
}
