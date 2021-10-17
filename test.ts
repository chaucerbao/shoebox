// Imports
import test, { ExecutionContext } from 'ava'
import sqlite3 from 'sqlite3'
import { Adapter, map, sqlite } from './src'

const mapClient = new Map()
const sqliteClient = new sqlite3.Database(':memory:')

// Constants
const ADAPTERS = [
  {
    name: 'Map',
    adapters: [
      map({ client: mapClient, namespace: 'shoeA' }),
      map({ client: mapClient, namespace: 'shoeB' }),
    ],
  },
  {
    name: 'SQLite',
    adapters: [
      sqlite({ client: sqliteClient, namespace: 'shoeA' }),
      sqlite({ client: sqliteClient, namespace: 'shoeB' }),
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

// Mocks
let mockNow = Date.now()

test.before(() => {
  global.Date.now = () => mockNow
})

// Tests
ADAPTERS.forEach(({ name: adapterName, adapters: [adapterA, adapterB] }) => {
  // Use an index where the `value` is not null nor undefined
  const KEY_INDEX = 3
  const VALUE_ENTRIES = Object.entries(VALUES)

  // Helpers
  const ensureAllValuesUndefined = (t: ExecutionContext, adapter: Adapter) =>
    Promise.all(
      VALUE_ENTRIES.map(async (_, i) =>
        t.is(await adapter.get(`key-${i}`), undefined)
      )
    )

  const ensureAllValuesDefined = (t: ExecutionContext, adapter: Adapter) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        t.deepEqual(await adapter.get(`key-${i}`), value)
      })
    )

  const setAllValues = async (t: ExecutionContext, adapter: Adapter) => {
    await adapter.clear()
    await ensureAllValuesUndefined(t, adapter)

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => adapter.set(`key-${i}`, value))
    )

    await ensureAllValuesDefined(t, adapter)
  }

  // Tests
  test(`${adapterName}: Set, get, and clear`, async (t) => {
    await setAllValues(t, adapterA)
    await setAllValues(t, adapterB)

    // Clear all key-values from one namespace
    await adapterA.clear()

    // Ensure all key-values are undefined for that namespace only
    await ensureAllValuesUndefined(t, adapterA)
    await ensureAllValuesDefined(t, adapterB)
  })

  test(`${adapterName}: Set, get, and delete`, async (t) => {
    await setAllValues(t, adapterA)
    await setAllValues(t, adapterB)

    // Delete the key-value at KEY_INDEX for one namespace
    await adapterA.delete(`key-${KEY_INDEX}`)

    // Ensure that only the key-value at KEY_INDEX for that namespace is now undefined
    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const adapterValue = await adapterA.get(`key-${i}`)

        if (i === KEY_INDEX) t.is(adapterValue, undefined)
        else t.deepEqual(adapterValue, value)
      })
    )

    await ensureAllValuesDefined(t, adapterB)
  })

  test(`${adapterName}: Get with TTL`, async (t) => {
    await adapterA.clear()
    await ensureAllValuesUndefined(t, adapterA)
    await setAllValues(t, adapterB)

    // Set all values with a TTL for one namespace
    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) =>
        adapterA.set(`key-${i}`, value, i + 1)
      )
    )

    await ensureAllValuesDefined(t, adapterA)
    await ensureAllValuesDefined(t, adapterB)

    // Advance the time
    mockNow += KEY_INDEX + 1

    // Ensure that all key-values before (and including) KEY_INDEX are now
    // undefined, while key-values after KEY_INDEX are unchanged for that
    // namespace only
    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const adapterValue = await adapterA.get(`key-${i}`)

        if (i <= KEY_INDEX) t.is(adapterValue, undefined)
        else t.deepEqual(adapterValue, value)
      })
    )

    await ensureAllValuesDefined(t, adapterB)
  })
})
