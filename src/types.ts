// Type Definitions
export interface StoreOptions {
  namespace?: string
  debounce?: Record<string, number>
}

export interface StoreRecord<T> {
  value: T
  expiresAt: number | undefined
}

export interface StoreSync {
  import: <T>(key: string, value: StoreRecord<T>) => void
  export: <T>(key: string) => StoreRecord<T> | undefined
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, value: T, ttl?: number) => void
  delete: (key: string) => void
  clear: () => void
}

export interface StoreAsync {
  import: <T>(key: string, value: StoreRecord<T>) => Promise<void>
  export: <T>(key: string) => Promise<StoreRecord<T> | undefined>
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

type StoreCore = 'import' | 'export' | 'delete' | 'clear'
export type StoreCoreSync = Pick<StoreSync, StoreCore>
export type StoreCoreAsync = Pick<StoreAsync, StoreCore>
