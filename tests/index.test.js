// Imports
import test from 'ava'
import SqliteDatabase from 'better-sqlite3'
import Redis from 'ioredis'
import { map, redis, sqlite } from '../dist/index.js'

const mapClient = new Map()
const sqliteClient = new SqliteDatabase(':memory:')
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
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

// Tests
STORES.forEach(({ name: storeName, stores: [storeA, storeB] }) => {
  // Use an index where the `value` is not null nor undefined
  const KEY_INDEX = 3
  const VALUE_ENTRIES = Object.entries(VALUES)
  const TTL = 100

  // Helpers
  const ensureAllValuesUndefined = (t, store) =>
    Promise.all(
      VALUE_ENTRIES.map(async (_, i) =>
        t.is(await store.get(`key-${i}`), undefined)
      )
    )

  const ensureAllValuesDefined = (t, store) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        t.deepEqual(await store.get(`key-${i}`), value)
      })
    )

  const setAllValues = async (t, store) => {
    await store.clear()
    await ensureAllValuesUndefined(t, store)

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => store.set(`key-${i}`, value))
    )

    await ensureAllValuesDefined(t, store)
  }

  const ensureValueUndefinedOnlyAtKeyIndex = (t, store) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const storeValue = await store.get(`key-${i}`)

        if (i === KEY_INDEX) t.is(storeValue, undefined)
        else t.deepEqual(storeValue, value)
      })
    )

  // Tests
  test.serial(`${storeName}: Set, get, and clear`, async (t) => {
    await setAllValues(t, storeA)
    await setAllValues(t, storeB)

    // Clear all key-values from one namespace
    await storeA.clear()

    // Ensure all key-values are undefined for that namespace
    await ensureAllValuesUndefined(t, storeA)
    await ensureAllValuesDefined(t, storeB)
  })

  test.serial(`${storeName}: Set, get, and delete`, async (t) => {
    await setAllValues(t, storeA)
    await setAllValues(t, storeB)

    // Delete the key-value at KEY_INDEX for one namespace
    await storeA.delete(`key-${KEY_INDEX}`)

    // Ensure that only the key-value at KEY_INDEX is undefined in that namespace
    await ensureValueUndefinedOnlyAtKeyIndex(t, storeA)
    await ensureAllValuesDefined(t, storeB)
  })

  test.serial(`${storeName}: Import and export with TTL`, async (t) => {
    await storeA.clear()
    await storeB.clear()

    const expiresAt = Date.now() + TTL

    await storeA.import('key', { value: VALUES.string })
    await storeB.import('key', { value: VALUES.string, expiresAt })

    t.deepEqual(await storeA.export('key'), { value: VALUES.string })

    const record = await storeB.export('key')
    if (typeof record !== 'undefined') {
      t.deepEqual(record.value, VALUES.string)

      // Check that `expiresAt` is within a 5ms margin of error, since some
      // Stores have their own TTL mechanism
      t.assert(
        typeof record.expiresAt !== 'undefined' &&
          record.expiresAt < expiresAt + 5
      )
    } else {
      t.fail()
    }

    await delay(TTL)

    t.deepEqual(await storeA.export('key'), { value: VALUES.string })
    t.is(await storeB.export('key'), undefined)
  })

  test.serial(`${storeName}: Get and set with TTL`, async (t) => {
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
