// Imports and Exports
export { default as map } from './stores/map'
export { default as redis } from './stores/redis'
export { default as sqlite } from './stores/sqlite'

// Type Definitions
export interface Store {
  get: <T = unknown>(key: string) => Promise<T | undefined>
  set: <T = unknown>(key: string, value: T, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export interface StoreOptions {
  namespace?: string
}
