// Imports
import test from 'ava'
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

// Tests
let isClearBeforeEachInitialized = false

ADAPTERS.forEach(({ name, adapter }) => {
  if (!isClearBeforeEachInitialized) {
    test.beforeEach(async () => {
      await adapter.clear()
    })

    isClearBeforeEachInitialized = true
  }

  test(`${name}: Get non-existing key-value`, async (t) => {
    t.is(await adapter.get('does-not-exist'), undefined)
  })

  test(`${name}: Delete non-existing key-value`, async (t) => {
    await adapter.delete('does-not-exist')

    t.is(await adapter.get('does-not-exist'), undefined)
  })

  test(`${name}: Clear`, async (t) => {
    await Promise.all([
      adapter.set('existing-key-1', true),
      adapter.set('existing-key-2', false),
    ])

    t.is(await adapter.get('existing-key-1'), true)
    t.is(await adapter.get('existing-key-2'), false)

    t.is(await adapter.clear(), undefined)

    t.is(await adapter.get('existing-key-1'), undefined)
    t.is(await adapter.get('existing-key-2'), undefined)
  })

  Object.entries(VALUES).forEach(([type, VALUE]) => {
    test.serial(`${name}: Get existing ${type} key-value`, async (t) => {
      await adapter.set('existing-key', VALUE)

      t.deepEqual(await adapter.get('existing-key'), VALUE)
    })

    test.serial(`${name}: Delete existing ${type} key-value`, async (t) => {
      await adapter.set('existing-key', VALUE)

      t.deepEqual(await adapter.get('existing-key'), VALUE)

      await adapter.delete('existing-key')

      t.is(await adapter.get('existing-key'), undefined)
    })
  })
})
