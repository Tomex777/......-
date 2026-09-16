import test from 'node:test';
import assert from 'node:assert/strict';
import { runStartupPairing } from '../src/whatsapp/startupPairing.js';

const config = values => ({ get(key, fallback) { return key in values ? values[key] : fallback; } });

test('startup pairing is disabled when no phone number is configured', async () => {
  let called = false;
  const result = await runStartupPairing({
    config: config({ PAIRING_SESSION: 'main', PAIRING_PHONE_NUMBER: '' }),
    sessions: { hasStoredAuth: () => false, isRegistered: () => false },
    pairing: { startCode: async () => { called = true; } },
    logger: { info() {} }
  });
  assert.equal(result.status, 'disabled');
  assert.equal(called, false);
});

test('startup pairing skips a session that already has saved auth', async () => {
  let called = false;
  const result = await runStartupPairing({
    config: config({ PAIRING_SESSION: 'main', PAIRING_PHONE_NUMBER: '2348012345678' }),
    sessions: { hasStoredAuth: () => true, isRegistered: () => false },
    pairing: { startCode: async () => { called = true; } },
    logger: { info() {} }
  });
  assert.equal(result.status, 'already-paired');
  assert.equal(called, false);
});

test('startup pairing requests one code for an unpaired configured session', async () => {
  let request = null;
  const result = await runStartupPairing({
    config: config({ PAIRING_SESSION: 'main', PAIRING_PHONE_NUMBER: '+234 801 234 5678' }),
    sessions: { hasStoredAuth: () => false, isRegistered: () => false },
    pairing: { startCode: async (sessionId, phoneNumber) => { request = { sessionId, phoneNumber }; return { code: 'ABCD-1234' }; } },
    logger: { info() {} }
  });
  assert.deepEqual(request, { sessionId: 'main', phoneNumber: '2348012345678' });
  assert.equal(result.status, 'waiting');
  assert.equal(result.code, 'ABCD-1234');
});
