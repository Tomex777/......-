import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWaVersion, resolveWaVersion } from '../src/whatsapp/waVersion.js';

test('parseWaVersion accepts a valid three-part override only', () => {
  assert.deepEqual(parseWaVersion('2,3000,1042466098'), [2, 3000, 1042466098]);
  assert.deepEqual(parseWaVersion('2.3000.1042466098'), [2, 3000, 1042466098]);
  assert.equal(parseWaVersion('2,3000'), null);
  assert.equal(parseWaVersion('abc'), null);
});

test('resolveWaVersion prefers NIGHT_WA_VERSION', async () => {
  let liveCalled = false;
  const result = await resolveWaVersion(
    { fetchLatestWaWebVersion: async () => { liveCalled = true; return { version: [9, 9, 9] }; } },
    { env: { NIGHT_WA_VERSION: '2,3000,1042466098' }, logger: { warn() {} } }
  );
  assert.deepEqual(result, { version: [2, 3000, 1042466098], source: 'NIGHT_WA_VERSION' });
  assert.equal(liveCalled, false);
});

test('resolveWaVersion uses live WA Web revision and safely falls back', async () => {
  const live = await resolveWaVersion(
    { fetchLatestWaWebVersion: async () => ({ version: [2, 3000, 1234567890] }) },
    { env: {}, logger: { warn() {} } }
  );
  assert.deepEqual(live, { version: [2, 3000, 1234567890], source: 'web.whatsapp.com' });

  const fallback = await resolveWaVersion(
    { fetchLatestWaWebVersion: async () => { throw new Error('offline'); } },
    { env: {}, logger: { warn() {} } }
  );
  assert.deepEqual(fallback, { version: null, source: 'library-default' });
});
