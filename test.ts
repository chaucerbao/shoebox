// Imports
import test, { ExecutionContext } from 'ava'
import sqlite3 from 'sqlite3'
import { map, sqlite } from './src'

// Constants
const ADAPTERS = [
  { name: 'Map', adapter: map() },
  {
    name: 'SQLite',
    adapter: sqlite({ client: new sqlite3.Database(':memory:') }),
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
ADAPTERS.forEach(({ name: adapterName, adapter }) => {
  // Use an index where the `value` is not null nor undefined
  const KEY_INDEX = 3
  const VALUE_ENTRIES = Object.entries(VALUES)

  // Helpers
  const ensureAllValuesUndefined = (t: ExecutionContext) =>
    Promise.all(
      VALUE_ENTRIES.map(async (_, i) => {
        t.is(await adapter.get(`key-${i}`), undefined)
      })
    )

  const ensureAllValuesDefined = (t: ExecutionContext) =>
    Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        t.deepEqual(await adapter.get(`key-${i}`), value)
      })
    )

  const setAllValues = async (t: ExecutionContext) => {
    await adapter.clear()

    await ensureAllValuesUndefined(t)

    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => adapter.set(`key-${i}`, value))
    )

    await ensureAllValuesDefined(t)
  }

  // Tests
  test(`${adapterName}: Set, get, and clear`, async (t) => {
    await setAllValues(t)

    // Clear all key-values
    await adapter.clear()

    // Ensure all key-values are undefined
    await ensureAllValuesUndefined(t)
  })

  test(`${adapterName}: Set, get, and delete`, async (t) => {
    await setAllValues(t)

    // Delete the key-value at KEY_INDEX
    await adapter.delete(`key-${KEY_INDEX}`)

    // Ensure that only the key-value at KEY_INDEX is now undefined
    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const adapterValue = await adapter.get(`key-${i}`)

        if (i === KEY_INDEX) t.is(adapterValue, undefined)
        else t.deepEqual(adapterValue, value)
      })
    )
  })

  test(`${adapterName}: Get with TTL`, async (t) => {
    await adapter.clear()

    await ensureAllValuesUndefined(t)

    // Set all values with a TTL
    await Promise.all(
      VALUE_ENTRIES.map(([, value], i) => adapter.set(`key-${i}`, value, i + 1))
    )

    await ensureAllValuesDefined(t)

    // Advance the time
    mockNow += KEY_INDEX + 1

    // Ensure that all key-values before (and including) KEY_INDEX are now
    // undefined, while key-values after KEY_INDEX are unchanged
    await Promise.all(
      VALUE_ENTRIES.map(async ([, value], i) => {
        const adapterValue = await adapter.get(`key-${i}`)

        if (i <= KEY_INDEX) t.is(adapterValue, undefined)
        else t.deepEqual(adapterValue, value)
      })
    )
  })
})
