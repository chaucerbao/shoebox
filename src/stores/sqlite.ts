// Imports
import { Database } from 'better-sqlite3'
import {
  DEFAULT_NAMESPACE,
  deserialize,
  getter,
  isDefined,
  isExpired,
  serialize,
  setter,
} from '../helpers.js'
import { Store, StoreOptions, StoreRecord } from '../index.js'

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

  const clear = async () => {
    client.prepare(`DELETE FROM [${table}] WHERE namespace = ?`).run(namespace)
  }

  const remove = async (key: string) => {
    client
      .prepare(`DELETE FROM [${table}] WHERE namespace = ? AND key = ?`)
      .run(namespace, key)
  }

  const importer = async <T = unknown>(key: string, record: StoreRecord<T>) => {
    client
      .prepare(
        `INSERT OR REPLACE INTO [${table}] (namespace, key, value, expires_at) VALUES (?, ?, ?, ?)`
      )
      .run(namespace, key, serialize(record.value), record.expiresAt)
  }

  const exporter = async <T = unknown>(key: string) => {
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
    get: getter(exporter),
    set: setter(importer),
    delete: remove,
    clear,
  }
}
