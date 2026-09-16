import test from 'node:test';
import assert from 'node:assert/strict';
import { createNightSocketOptions, shouldSyncNightHistoryMessage } from '../src/whatsapp/socketPolicy.js';

test('Night rejects all WhatsApp history-sync messages', () => {
  for (const syncType of ['RECENT', 'FULL', 'INITIAL_BOOTSTRAP', 'PUSH_NAME', 'NON_BLOCKING_DATA']) {
    assert.equal(
      shouldSyncNightHistoryMessage({ syncType }),
      false,
      `history sync type ${syncType} must be rejected`
    );
  }
});

test('Night socket policy does not enter Lia history wait', () => {
  const auth = { creds: {} };
  const logger = { child() { return this; } };
  const browser = ['Mac OS', 'Chrome', '1'];
  const options = createNightSocketOptions({ auth, logger, browser });

  assert.equal(options.syncFullHistory, false);
  assert.equal(options.fireInitQueries, true);
  assert.equal(options.markOnlineOnConnect, false);
  assert.equal(options.shouldSyncHistoryMessage({ syncType: 'RECENT' }), false);
  assert.equal(options.shouldSyncHistoryMessage({ syncType: 'FULL' }), false);
  assert.equal(options.auth, auth);
  assert.equal(options.logger, logger);
  assert.equal(options.browser, browser);
});
