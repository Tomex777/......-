import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccessController } from '../src/security/access.js';
import { MessageDispatcher } from '../src/router/dispatcher.js';

const temp = name => fs.mkdtempSync(path.join(os.tmpdir(), `night-self-owner-${name}-`));

function allowRegistry() {
  return {
    resolveCommand(name) {
      if (name !== 'allow') return null;
      return {
        name: 'allow',
        ownerOnly: true,
        requiresAllowedChat: false,
        requiresAI: false,
        execute: async ({ message, access }) => access.allow(message.chatJid)
      };
    }
  };
}

test('owner can run a command from whichever session slot is linked to OWNER_NUMBER', async () => {
  const owner = '2348000000000';
  const access = new AccessController({ ownerNumber: owner, storagePath: path.join(temp('owner'), 'access.json') });
  const sessions = {
    sessionOwnJid(sessionId) {
      assert.equal(sessionId, 'assistant');
      return `${owner}@s.whatsapp.net`;
    },
    isBotSentMessage() { return false; },
    sendViaSession: async () => ({ key: { id: 'reply-1' } })
  };
  const dispatcher = new MessageDispatcher({ registry: allowRegistry(), access, sessions, config: { get: () => true }, roleManager: {} });
  const message = {
    id: 'manual-1',
    sessionId: 'assistant',
    chatJid: `${owner}@s.whatsapp.net`,
    senderJid: `${owner}@s.whatsapp.net`,
    participantJid: null,
    fromMe: true,
    text: '.allow'
  };
  const result = await dispatcher.handle(message);
  assert.equal(result.executed, true);
  assert.equal(access.isAllowed(message.chatJid), true);
});

test('fromMe command on a session linked to a non-owner number is ignored', async () => {
  const owner = '2348000000000';
  const access = new AccessController({ ownerNumber: owner, storagePath: path.join(temp('non-owner'), 'access.json') });
  const sessions = {
    sessionOwnJid() { return '2348111111111@s.whatsapp.net'; },
    isBotSentMessage() { return false; },
    sendViaSession: async () => ({})
  };
  const dispatcher = new MessageDispatcher({ registry: allowRegistry(), access, sessions, config: { get: () => true }, roleManager: {} });
  const message = {
    id: 'manual-2',
    sessionId: 'main',
    chatJid: '2348111111111@s.whatsapp.net',
    senderJid: '2348111111111@s.whatsapp.net',
    participantJid: null,
    fromMe: true,
    text: '.allow'
  };
  const result = await dispatcher.handle(message);
  assert.equal(result.handled, false);
  assert.equal(result.reason, 'self-non-owner');
  assert.equal(access.isAllowed(message.chatJid), false);
});

test('Night ignores its own bot-sent command-looking output to prevent loops', async () => {
  const owner = '2348000000000';
  const access = new AccessController({ ownerNumber: owner, storagePath: path.join(temp('bot-output'), 'access.json') });
  const sessions = {
    sessionOwnJid() { return `${owner}@s.whatsapp.net`; },
    isBotSentMessage(sessionId, messageId) {
      assert.equal(sessionId, 'assistant');
      return messageId === 'bot-1';
    },
    sendViaSession: async () => ({})
  };
  const dispatcher = new MessageDispatcher({ registry: allowRegistry(), access, sessions, config: { get: () => true }, roleManager: {} });
  const result = await dispatcher.handle({
    id: 'bot-1',
    sessionId: 'assistant',
    chatJid: `${owner}@s.whatsapp.net`,
    senderJid: `${owner}@s.whatsapp.net`,
    participantJid: null,
    fromMe: true,
    text: '.allow'
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, 'bot-output');
});
