// Imports
import { Database } from 'better-sqlite3'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  expandStoreSync,
  isDefined,
  isExpired,
  serialize,
  toStoreAsync,
} from '../helpers.js'
import { StoreAsync, StoreOptions, StoreRecord, StoreSync } from '../types.js'

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
const sqliteStore = (options: SqliteOptions) => {
  const { client, table = 'shoebox', namespace = DEFAULT_NAMESPACE } = options

  client
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS [${table}] (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          expires_at INTEGER,
          PRIMARY KEY (namespace, key)
        )
      `
    )
    .run()

  const clear = () => {
    client.prepare(`DELETE FROM [${table}] WHERE namespace = ?`).run(namespace)
  }

  const remove = (key: string) => {
    client
      .prepare(`DELETE FROM [${table}] WHERE namespace = ? AND key = ?`)
      .run(namespace, key)
  }

  const importer = <T>(key: string, record: StoreRecord<T>) => {
    client
      .prepare(
        `INSERT OR REPLACE INTO [${table}] (namespace, key, value, expires_at) VALUES (?, ?, ?, ?)`
      )
      .run(namespace, key, serialize(record.value), record.expiresAt)
  }

  const exporter = <T>(key: string) => {
    const record = client
      .prepare(
        `SELECT * FROM [${table}] WHERE namespace = ? AND key = ? LIMIT 1`
      )
      .get(namespace, key) as SqlRecord | undefined

    if (!isDefined(record)) return undefined

    if (isExpired(record.expires_at)) {
      remove(key)
      return undefined
    }

    return {
      value: deserialize<T>(record.value),
      expiresAt: record.expires_at ?? undefined,
    } as StoreRecord<T>
  }

  return {
    import: importer,
    export: exporter,
    delete: remove,
    clear,
  }
}

export const sqliteSync = (options: SqliteOptions): StoreSync =>
  expandStoreSync(sqliteStore(options))

export const sqliteAsync = (options: SqliteOptions): StoreAsync =>
  toStoreAsync(sqliteSync(options))
