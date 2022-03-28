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
    createStore: (options = {}) => map({ ...options, client: mapClient }),
  },
  {
    name: 'Redis',
    createStore: (options = {}) => redis({ ...options, client: redisClient }),
  },
  {
    name: 'SQLite',
    createStore: (options = {}) => sqlite({ ...options, client: sqliteClient }),
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
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

// Tests
STORES.forEach(({ name: storeName, createStore }) => {
  const TTL = 100
  const VALUE_ENTRIES = Object.entries(VALUES)

  const testKey = (index) => `key-${index}`

  const setValues = ({ store }) =>
    Promise.all(
      VALUE_ENTRIES.map(([, value], i) => store.set(testKey(i), value))
    )

  const testValues = ({ t, store, exclude = [], isDefined }) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        if (exclude.includes(testKey(i))) return

        if (isDefined) t.deepEqual(await store.get(testKey(i)), value)
        else t.is(await store.get(testKey(i)), undefined)
      })
    )

  // Tests
  test(`${storeName}: Namespaces`, async (t) => {
    const storeA = createStore()
    const storeB = createStore({ namespace: 'namespace' })

    await setValues({ store: storeA })
    await testValues({ isDefined: true, store: storeA, t })

    await testValues({ isDefined: false, store: storeB, t })
    await setValues({ store: storeB })
    await testValues({ isDefined: true, store: storeB, t })

    await storeA.clear()
    await testValues({ isDefined: false, store: storeA, t })
    await testValues({ isDefined: true, store: storeB, t })

    await storeB.clear()
    await testValues({ isDefined: false, store: storeB, t })
  })

  test(`${storeName}: Get`, async (t) => {
    const store = createStore({ namespace: 'get' })

    await setValues({ store })

    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) =>
        t.deepEqual(await store.get(testKey(i)), value)
      )
    )
  })

  test(`${storeName}: Set`, async (t) => {
    const store = createStore({ namespace: 'set' })

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => store.set(testKey(i), value))
    )

    await testValues({ isDefined: true, store, t })
  })

  test(`${storeName}: Import`, async (t) => {
    const store = createStore({ namespace: 'import' })

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => store.import(testKey(i), { value }))
    )

    await testValues({ isDefined: true, store, t })
  })

  test(`${storeName}: Export`, async (t) => {
    const store = createStore({ namespace: 'export' })

    await setValues({ store })

    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) =>
        t.deepEqual(await store.export(testKey(i)), {
          value,
          expiresAt: undefined,
        })
      )
    )
  })

  test(`${storeName}: Delete`, async (t) => {
    const store = createStore({ namespace: 'delete' })

    await setValues({ store })
    await testValues({ isDefined: true, store, t })

    await store.delete(testKey(3))
    t.is(await store.get(testKey(3)), undefined)

    await testValues({ isDefined: true, store, t, exclude: [testKey(3)] })
  })

  test(`${storeName}: Clear`, async (t) => {
    const store = createStore({ namespace: 'clear' })

    await setValues({ store })
    await testValues({ isDefined: true, store, t })

    await store.clear()

    await testValues({ isDefined: false, store, t })
  })

  test(`${storeName}: Get and Set with TTL`, async (t) => {
    const store = createStore({ namespace: 'get-and-set-with-ttl' })

    await store.set(testKey(2), 'string', TTL)
    t.is(await store.get(testKey(2)), 'string')

    await wait(TTL * 0.8)
    t.is(await store.get(testKey(2)), 'string')

    await wait(TTL * 0.2)
    t.is(await store.get(testKey(2)), undefined)
  })

  test(`${storeName}: Export and Import with 'expiresAt'`, async (t) => {
    const store = createStore({
      namespace: 'export-and-import-with-expires_at',
    })
    const expiresAt = new Date().getTime() + TTL

    await store.import(testKey(2), { value: 'string', expiresAt })
    t.deepEqual(await store.export(testKey(2)), { value: 'string', expiresAt })

    await wait(TTL * 0.8)
    t.deepEqual(await store.export(testKey(2)), { value: 'string', expiresAt })

    await wait(TTL * 0.2)
    t.is(await store.get(testKey(2)), undefined)
  })
})
