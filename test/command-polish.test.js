import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import allowedCommand from '../commands/allowed.js';
import healthCommand from '../commands/health.js';
import { PairingService } from '../src/whatsapp/pairingService.js';

test('.allowed prefers readable labels over raw internal JIDs', async () => {
  let output = '';
  const result = await allowedCommand.execute({
    access: { list: () => ['25693048041628@lid'] },
    sessions: { describeChat: async () => 'Tester — +2348000000000' },
    message: { sessionId: 'main' },
    reply: async text => { output = text; }
  });

  assert.deepEqual(result, ['Tester — +2348000000000']);
  assert.equal(output, 'Allowed chats:\nTester — +2348000000000');
  assert.equal(output.includes('@lid'), false);
});

test('.health reports every configured WhatsApp slot', async () => {
  let output = '';
  const states = {
    main: { id: 'main', state: 'open', registered: true },
    assistant: { id: 'assistant', state: 'idle', registered: false }
  };
  const roleSnapshot = {
    config: { sessions: ['main', 'assistant'] },
    roles: [],
    health: { main: true, assistant: false }
  };

  await healthCommand.execute({
    sessions: {
      sessionSnapshot: id => states[id],
      hasStoredAuth: () => false
    },
    roleManager: { snapshot: () => roleSnapshot },
    reply: async text => { output = text; }
  });

  assert.match(output, /main: connected/);
  assert.match(output, /assistant: not paired/);
  assert.match(output, /1\/2 WhatsApp session\(s\) connected\./);
});

class FakeSessions extends EventEmitter {
  constructor() {
    super();
    this.registered = false;
    this.state = 'idle';
  }
  isRegistered() { return this.registered; }
  sessionSnapshot(id) { return { id, state: this.state, registered: this.registered, lastError: null }; }
  async requestPairingCode() { this.state = 'connecting'; return 'ABCD1234'; }
  async disconnect() { this.state = 'idle'; }
  clearAuth() {}
  async logout() { this.registered = false; this.state = 'idle'; }
}

test('successful pairing removes the completed attempt and its code', async () => {
  const sessions = new FakeSessions();
  const pairing = new PairingService({ sessions, allowedSessions: ['main'], attemptTtlMs: 10_000 });

  const waiting = await pairing.startCode('main', '2348000000000');
  assert.equal(waiting.code, 'ABCD1234');
  assert.equal(pairing.attempts.has('main'), true);

  sessions.registered = true;
  sessions.state = 'open';
  sessions.emit('session', { id: 'main', state: 'open', registered: true });

  const paired = pairing.snapshot('main');
  assert.equal(paired.status, 'paired');
  assert.equal(paired.code, null);
  assert.equal(paired.method, null);
  assert.equal(pairing.attempts.has('main'), false);
});
