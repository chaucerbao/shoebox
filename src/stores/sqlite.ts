// Imports
import { Database } from 'better-sqlite3'
import {
  asyncify,
  DEFAULT_NAMESPACE,
  deserialize,
  expiresAt,
  isDefined,
  isExpired,
  serialize,
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
export const sqliteSync = (options: SqliteOptions) => {
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
    get: <T>(key: string) => exporter(key)?.value as T,
    set: <T>(key: string, value: T, ttl?: number) =>
      importer(key, { value, expiresAt: expiresAt(ttl) }),
    delete: remove,
    clear,
  }
}

export default (options: SqliteOptions): Store => {
  const sqlite = sqliteSync(options)

  return {
    import: asyncify(sqlite.import),
    export: async (key: string) => sqlite.export(key),
    get: async (key: string) => sqlite.get(key),
    set: asyncify(sqlite.set),
    delete: asyncify(sqlite.delete),
    clear: asyncify(sqlite.clear),
  }
}
