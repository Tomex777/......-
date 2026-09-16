import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NightSessionManager } from '../src/whatsapp/sessionManager.js';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'night-pair-ready-'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('pairing code request waits for real transport readiness', async () => {
  const manager = new NightSessionManager({
    dataDir: temp(),
    pairingReadyTimeoutMs: 1_000,
    pairingSettleMs: 0
  });

  let requested = false;
  let receivedNumber = null;
  const fakeSocket = {
    async requestPairingCode(number) {
      requested = true;
      receivedNumber = number;
      return 'ABCD1234';
    }
  };

  manager.connect = async sessionId => {
    manager.sessions.set(sessionId, {
      id: sessionId,
      state: 'connecting',
      registered: false,
      socket: fakeSocket,
      reconnectTimer: null,
      reconnects: 0,
      saveCreds: null,
      qr: null,
      lastError: null,
      connectedAt: null,
      generation: 1,
      pairingReady: false
    });
    return fakeSocket;
  };

  const pending = manager.requestPairingCode('main', '+234 801 234 5678');
  await tick();
  assert.equal(requested, false, 'must not request a code before WhatsApp transport is ready');

  manager.emit('pairing-ready', { sessionId: 'main', via: 'connecting' });
  const code = await pending;

  assert.equal(requested, true);
  assert.equal(receivedNumber, '2348012345678');
  assert.equal(code, 'ABCD1234');
});
