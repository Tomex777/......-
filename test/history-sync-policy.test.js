import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_HISTORY_SYNC_TYPE,
  createNightSocketOptions,
  shouldSyncNightHistoryMessage
} from '../src/whatsapp/socketPolicy.js';

test('Night blocks FULL history but preserves bootstrap/LID sync classes', () => {
  assert.equal(shouldSyncNightHistoryMessage({ syncType: FULL_HISTORY_SYNC_TYPE }), false);
  for (const syncType of [0, 1, 3, 4, 5, 6, 7, 'RECENT', 'INITIAL_BOOTSTRAP', 'PUSH_NAME', 'NON_BLOCKING_DATA']) {
    assert.equal(
      shouldSyncNightHistoryMessage({ syncType }),
      true,
      `essential non-FULL history sync type ${syncType} must remain enabled`
    );
  }
});

test('Night socket policy keeps init queries and refuses only FULL archive sync', () => {
  const auth = { creds: {} };
  const logger = { child() { return this; } };
  const browser = ['Windows', 'Chrome', '1'];
  const options = createNightSocketOptions({ auth, logger, browser });

  assert.equal(options.syncFullHistory, false);
  assert.equal(options.fireInitQueries, true);
  assert.equal(options.markOnlineOnConnect, false);
  assert.equal(options.downloadHistory, false);
  assert.equal(options.keepAliveIntervalMs, 30_000);
  assert.equal(options.retryRequestDelayMs, 250);
  assert.equal(options.shouldSyncHistoryMessage({ syncType: FULL_HISTORY_SYNC_TYPE }), false);
  assert.equal(options.shouldSyncHistoryMessage({ syncType: 1 }), true);
  assert.equal(options.shouldSyncHistoryMessage({ syncType: 3 }), true);
  assert.equal(options.auth, auth);
  assert.equal(options.logger, logger);
  assert.equal(options.browser, browser);
});
