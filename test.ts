// Imports
import test, { ExecutionContext } from 'ava'
import Redis from 'ioredis'
import sqlite3 from 'sqlite3'
import { map, redis, sqlite, Store } from './src'

const mapClient = new Map()
const sqliteClient = new sqlite3.Database(':memory:')
const redisClient = new Redis()

// Constants
const STORES = [
  {
    name: 'Map',
    stores: [
      map({ client: mapClient }),
      map({ client: mapClient, namespace: 'namespace' }),
    ],
  },
  {
    name: 'Redis',
    stores: [
      redis({ client: redisClient }),
      redis({ client: redisClient, namespace: 'namespace' }),
    ],
  },
  {
    name: 'SQLite',
    stores: [
      sqlite({ client: sqliteClient }),
      sqlite({ client: sqliteClient, namespace: 'namespace' }),
    ],
  },
]

const VALUES = {
  undefined: undefined,
  null: null,
  string: 'string',
  number: 42,
  boolean: false,
  object: { a: 'string', b: 42 },
  array: [undefined, null, 'string', 42, true, { a: 'string', b: 42 }],
}

// Helpers
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

// Tests
STORES.forEach(({ name: storeName, stores: [storeA, storeB] }) => {
  // Use an index where the `value` is not null nor undefined
  const KEY_INDEX = 3
  const VALUE_ENTRIES = Object.entries(VALUES)
  const TTL = 100

  // Helpers
  const ensureAllValuesUndefined = (t: ExecutionContext, store: Store) =>
    Promise.all(
      VALUE_ENTRIES.map(async (_, i) =>
        t.is(await store.get(`key-${i}`), undefined)
      )
    )

  const ensureAllValuesDefined = (t: ExecutionContext, store: Store) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        t.deepEqual(await store.get(`key-${i}`), value)
      })
    )

  const setAllValues = async (t: ExecutionContext, store: Store) => {
    await store.clear()
    await ensureAllValuesUndefined(t, store)

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => store.set(`key-${i}`, value))
    )

    await ensureAllValuesDefined(t, store)
  }

  const ensureValueUndefinedOnlyAtKeyIndex = (
    t: ExecutionContext,
    store: Store
  ) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const storeValue = await store.get(`key-${i}`)

        if (i === KEY_INDEX) t.is(storeValue, undefined)
        else t.deepEqual(storeValue, value)
      })
    )

  // Tests
  test(`${storeName}: Set, get, and clear`, async (t) => {
    await setAllValues(t, storeA)
    await setAllValues(t, storeB)

    // Clear all key-values from one namespace
    await storeA.clear()

    // Ensure all key-values are undefined for that namespace
    await ensureAllValuesUndefined(t, storeA)
    await ensureAllValuesDefined(t, storeB)
  })

  test(`${storeName}: Set, get, and delete`, async (t) => {
    await setAllValues(t, storeA)
    await setAllValues(t, storeB)

    // Delete the key-value at KEY_INDEX for one namespace
    await storeA.delete(`key-${KEY_INDEX}`)

    // Ensure that only the key-value at KEY_INDEX is undefined in that namespace
    await ensureValueUndefinedOnlyAtKeyIndex(t, storeA)
    await ensureAllValuesDefined(t, storeB)
  })

  test(`${storeName}: Get with TTL`, async (t) => {
    await setAllValues(t, storeA)
    await setAllValues(t, storeB)

    // Set the key-value at KEY_INDEX with a TTL in one namespace
    const [, value] = VALUE_ENTRIES[KEY_INDEX]
    storeA.set(`key-${KEY_INDEX}`, value, TTL)

    // Ensure all values are currently defined
    await ensureAllValuesDefined(t, storeA)
    await ensureAllValuesDefined(t, storeB)

    // Wait for the TTL to pass
    await delay(TTL)

    // Ensure that only the key-value at KEY_INDEX is undefined in that namespace
    await ensureValueUndefinedOnlyAtKeyIndex(t, storeA)
    await ensureAllValuesDefined(t, storeB)
  })
})
