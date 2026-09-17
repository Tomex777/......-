import 'dotenv/config';
import path from 'node:path';
import pino from 'pino';
import { ConfigRegistry } from './config/registry.js';
import { AccessController } from './security/access.js';
import { SessionRoleManager } from './whatsapp/roles.js';
import { HotModuleRegistry } from './hotload/registry.js';
import { InboxStore } from './inbox/store.js';
import { ActivityStore } from './history/activityStore.js';
import { NightAIService } from './ai/service.js';
import { CapabilityHub } from './features/hub.js';
import { NightSessionManager } from './whatsapp/sessionManager.js';
import { PairingService } from './whatsapp/pairingService.js';
import { runStartupPairing } from './whatsapp/startupPairing.js';
import { MessageDispatcher } from './router/dispatcher.js';
import { CortexEventHub } from './api/eventHub.js';
import { createCortexServer } from './api/server.js';

const logger = pino({ level: process.env.NIGHT_LOG_LEVEL || 'info' });
const config = new ConfigRegistry();
const runtime = config.runtime();
const access = new AccessController({ ownerNumber: runtime.ownerNumber });
const roleManager = new SessionRoleManager({
  sessions: runtime.sessions,
  mode: runtime.roleMode,
  inboxSession: runtime.inboxSession,
  aiSession: runtime.aiSession,
  fallbackEnabled: runtime.fallbackEnabled
});
const registry = new HotModuleRegistry({ commandDir: path.resolve('commands'), utilDir: path.resolve('utils') });
await registry.loadAll();
registry.startWatching();
const inbox = new InboxStore();
const activity = new ActivityStore();
const events = new CortexEventHub();
const sessions = new NightSessionManager({ roleManager });
const pairing = new PairingService({ sessions, allowedSessions: runtime.sessions });
const ai = new NightAIService({ config, activity, logger });
const features = new CapabilityHub({ config, sessions, inbox, ai, logger });
const dispatcher = new MessageDispatcher({ registry, access, sessions, config, roleManager, ai, activity, features, logger });

registry.on('loaded', data => events.publish('module.loaded', data));
registry.on('load-error', data => events.publish('module.load-error', { kind: data.kind, file: data.file, error: data.error?.message }));
registry.on('watch-error', error => events.publish('module.watch-error', { error: error.message }));
sessions.on('session', state => events.publish('session.update', state));
sessions.on('qr', state => events.publish('pairing.qr', state));
sessions.on('creds', state => events.publish('session.credentials', state));
sessions.on('messages.update', state => events.publish('message.update', state));
sessions.on('messages.delete', state => events.publish('message.delete', state));
sessions.on('messages.reaction', state => events.publish('message.reaction', state));
pairing.on('update', state => events.publish('pairing.update', state));

async function maybeHandleNaturalAI(message, raw, dispatched) {
  if (dispatched.handled || dispatched.reason === 'bot-output' || dispatched.reason === 'self-non-owner') return false;
  if (!message?.chatJid || !message?.text || !access.isAllowed(message.chatJid) || !config.get('AI_ENABLED', true)) return false;

  const sender = await dispatcher.resolveSender(message);
  if (sender.ignored || !access.isOwner(sender.senderJid)) return false;

  const isGroup = message.chatJid.endsWith('@g.us');
  const preferredAI = String(config.get('WHATSAPP_AI_SESSION', runtime.aiSession || 'assistant')).toLowerCase();
  let prompt = String(message.text || '').trim();

  if (isGroup) {
    const match = prompt.match(/^@?night(?:\s*[:,\-])?\s+([\s\S]+)$/i);
    if (!match) return false;
    prompt = match[1].trim();
  } else if (String(message.sessionId).toLowerCase() !== preferredAI) {
    return false;
  }

  if (!prompt || prompt.startsWith('.')) return false;
  try {
    const answer = await ai.ask({
      text: prompt,
      sessionId: message.sessionId,
      chatJid: message.chatJid,
      senderJid: sender.senderJid,
      complexity: 0.45
    });
    await sessions.sendViaSession(message.sessionId, message.chatJid, { text: answer.text }, raw?.key ? { quoted: raw } : {});
    events.publish('ai.response', { sessionId: message.sessionId, chatJid: message.chatJid, provider: answer.provider, model: answer.model });
    return true;
  } catch (error) {
    logger.warn({ err: error.message, sessionId: message.sessionId, chatJid: message.chatJid }, 'natural AI reply failed');
    try { await sessions.sendViaSession(message.sessionId, message.chatJid, { text: `AI failed: ${error.message}` }, raw?.key ? { quoted: raw } : {}); } catch {}
    return true;
  }
}

sessions.on('message', async (message, raw) => {
  events.publish('message.received', { sessionId: message.sessionId, chatJid: message.chatJid, id: message.id, type: message.type, fromMe: message.fromMe });
  const dispatched = await dispatcher.handle(message, raw);
  if (dispatched.handled) events.publish('command.dispatch', { sessionId: message.sessionId, chatJid: message.chatJid, ...dispatched, error: dispatched.error?.message });
  if (message.chatJid && (access.isAllowed(message.chatJid) || features.isObserved(message.chatJid))) {
    inbox.upsertMessage(message);
    events.publish('inbox.message', message);
  }
  await maybeHandleNaturalAI(message, raw, dispatched);
});

for (const sessionId of runtime.sessions) {
  if (!sessions.hasStoredAuth(sessionId)) { events.publish('session.unpaired', { sessionId }); continue; }
  sessions.connect(sessionId).catch(error => {
    logger.warn({ sessionId, err: error.message }, 'startup WhatsApp connection failed');
    events.publish('session.startup-error', { sessionId, error: error.message });
  });
}

const server = createCortexServer({ config, registry, roleManager, sessions, pairing, inbox, access, events });
server.listen(runtime.port, runtime.host, async () => {
  logger.info({ host: runtime.host, port: runtime.port, ai: ai.status() }, 'Night Core listening');
  try { await runStartupPairing({ config, sessions, pairing, logger }); }
  catch (error) { logger.error({ err: error.message }, 'Startup pairing failed'); }
});

let shuttingDown = false;
const shutdown = async signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Night shutting down');
  registry.stopWatching();
  server.close();
  await sessions.closeAll();
  inbox.close();
  activity.close();
  features.close();
  setTimeout(() => process.exit(1), 5000).unref();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
