// Type Definitions
export interface Adapter {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

// Helpers
export const isDefined = <T>(value: T): value is NonNullable<T> =>
  typeof value !== 'undefined' && value !== null

export const createAttachNamespace = (namespace: string) => (key: string) =>
  [namespace, key].join(':')
