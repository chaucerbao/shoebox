// Imports and Exports
export { default as map } from './stores/map'
export { default as redis } from './stores/redis'
export { default as sqlite } from './stores/sqlite'

// Type Definitions
export interface StoreRecord<T = unknown> {
  value: T
  expiresAt?: number
}

export interface Store {
  import: <T = unknown>(key: string, value: StoreRecord<T>) => Promise<void>
  export: <T = unknown>(key: string) => Promise<StoreRecord<T> | undefined>
  get: <T = unknown>(key: string) => Promise<T | undefined>
  set: <T = unknown>(key: string, value: T, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export interface StoreOptions {
  namespace?: string
  debounce?: number
}
