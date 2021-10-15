// Imports
import test from 'ava'
import map from './src/adapters/map'

const stores = [map()]

const VALUES = {
  string: 'string',
  number: 42,
  boolean: false,
  object: { a: 'string', b: 42 },
  array: ['string', 42, { a: 'string', b: 42 }],
}

stores.forEach((store) => {
  test.beforeEach(() => store.clear())

  test('Get non-existing key-value', async (t) => {
    t.is(await store.get('does-not-exist'), undefined)
  })

  test('Delete non-existing key-value', async (t) => {
    t.is(await store.delete('does-not-exist'), false)
  })

  test('Clear', async (t) => {
    await Promise.all([
      store.set('existing-key-1', true),
      store.set('existing-key-2', false),
    ])

    t.is(await store.get('existing-key-1'), true)
    t.is(await store.get('existing-key-2'), false)

    t.is(await store.clear(), undefined)

    t.is(await store.get('existing-key-1'), undefined)
    t.is(await store.get('existing-key-2'), undefined)
  })

  Object.entries(VALUES).forEach(([type, VALUE]) => {
    test.serial(`Get existing ${type} key-value`, async (t) => {
      await store.set('existing-key', VALUE)
      t.is(await store.get('existing-key'), VALUE)
    })

    test.serial(`Delete existing ${type} key-value`, async (t) => {
      await store.set('existing-key', VALUE)
      t.is(await store.delete('existing-key'), true)
    })
  })
})
