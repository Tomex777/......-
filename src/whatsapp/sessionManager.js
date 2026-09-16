import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { normalizeMessage } from './normalizeMessage.js';

const normalizeId = value => String(value || '').trim().toLowerCase();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function statusCode(error) {
  return error?.output?.statusCode ?? error?.statusCode ?? error?.data?.statusCode ?? null;
}

export class NightSessionManager extends EventEmitter {
  constructor({ dataDir = path.resolve('data/sessions'), roleManager, pairingReadyTimeoutMs = 15_000, pairingSettleMs = 1_500 } = {}) {
    super();
    this.dataDir = dataDir;
    this.roleManager = roleManager;
    this.pairingReadyTimeoutMs = pairingReadyTimeoutMs;
    this.pairingSettleMs = pairingSettleMs;
    this.sessions = new Map();
    this.logger = pino({ level: process.env.NIGHT_LOG_LEVEL || 'info' });
    fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
  }

  async #library() { return import('@itsliaaa/baileys'); }
  authDir(sessionId) { return path.join(this.dataDir, normalizeId(sessionId)); }

  #secureAuthDir(sessionId) {
    const dir = this.authDir(sessionId);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch {}
    try {
      for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isFile()) fs.chmodSync(full, 0o600);
      }
    } catch {}
  }

  #record(id) {
    if (!this.sessions.has(id)) {
      this.sessions.set(id, { id, state: 'idle', registered: false, socket: null, reconnectTimer: null, reconnects: 0, saveCreds: null, qr: null, lastError: null, connectedAt: null, generation: 0, pairingReady: false });
    }
    return this.sessions.get(id);
  }

  async connect(sessionId, { force = false } = {}) {
    const id = normalizeId(sessionId);
    if (!id) throw new Error('session id required');
    const current = this.#record(id);
    if (!force && (current.state === 'open' || current.state === 'connecting')) return current.socket;

    if (current.reconnectTimer) { clearTimeout(current.reconnectTimer); current.reconnectTimer = null; }
    if (force && current.socket) {
      try { current.socket.end?.(new Error('Night reconnect')); } catch {}
      try { current.socket.ws?.close?.(); } catch {}
    }

    const lib = await this.#library();
    const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = lib;
    this.#secureAuthDir(id);
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir(id));
    const generation = ++current.generation;

    current.state = 'connecting';
    current.registered = Boolean(state?.creds?.registered);
    current.qr = null;
    current.lastError = null;
    current.pairingReady = false;
    current.saveCreds = async () => { await saveCreds(); this.#secureAuthDir(id); };
    this.roleManager?.markHealth(id, false);

    const socketOptions = {
      auth: state,
      logger: this.logger.child({ session: id }),
      browser: Browsers.macOS('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    };
    const override = String(process.env.NIGHT_WA_VERSION || '').trim();
    if (override) socketOptions.version = override.split(',').map(Number);

    const sock = makeWASocket(socketOptions);
    current.socket = sock;

    sock.ev.on('creds.update', async update => {
      if (generation !== current.generation) return;
      current.registered = Boolean(update?.registered ?? state?.creds?.registered ?? current.registered);
      await current.saveCreds();
      this.emit('creds', { sessionId: id, registered: current.registered });
    });

    sock.ev.on('messages.upsert', ({ messages = [], type }) => {
      if (generation !== current.generation) return;
      for (const raw of messages) this.emit('message', normalizeMessage(raw, { sessionId: id }), raw, { type });
    });
    sock.ev.on('messages.update', update => this.emit('messages.update', { sessionId: id, update }));
    sock.ev.on('messages.delete', update => this.emit('messages.delete', { sessionId: id, update }));
    sock.ev.on('messages.reaction', update => this.emit('messages.reaction', { sessionId: id, update }));
    sock.ev.on('messaging-history.set', history => this.emit('history', { sessionId: id, history }));

    sock.ev.on('connection.update', update => {
      if (generation !== current.generation) return;
      if (update.qr) {
        current.qr = update.qr;
        if (!current.registered && !current.pairingReady) {
          current.pairingReady = true;
          this.emit('pairing-ready', { sessionId: id, via: 'qr' });
        }
        this.emit('qr', { sessionId: id, qr: update.qr, at: Date.now() });
      }
      if (update.connection === 'open') {
        current.state = 'open'; current.registered = true; current.qr = null; current.lastError = null; current.connectedAt = Date.now(); current.reconnects = 0; current.pairingReady = false;
        this.roleManager?.markHealth(id, true); this.emit('session', this.sessionSnapshot(id));
      } else if (update.connection === 'close') {
        current.state = 'closed'; current.qr = null; current.connectedAt = null; current.lastError = String(update.lastDisconnect?.error ?? ''); current.pairingReady = false;
        this.roleManager?.markHealth(id, false); this.emit('session', this.sessionSnapshot(id));
        const code = statusCode(update.lastDisconnect?.error);
        if (code !== DisconnectReason.loggedOut) this.#scheduleReconnect(id); else current.registered = false;
      } else if (update.connection === 'connecting') {
        current.state = 'connecting';
        if (!current.registered && !current.pairingReady) {
          current.pairingReady = true;
          this.emit('pairing-ready', { sessionId: id, via: 'connecting' });
        }
        this.emit('session', this.sessionSnapshot(id));
      }
    });

    this.emit('session', this.sessionSnapshot(id));
    return sock;
  }

  async #waitForPairingReady(sessionId) {
    const id = normalizeId(sessionId);
    const record = this.#record(id);
    if (record.pairingReady) return;

    await new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        this.off('pairing-ready', onReady);
        this.off('session', onSession);
      };
      const onReady = event => {
        if (event?.sessionId !== id) return;
        cleanup();
        resolve();
      };
      const onSession = event => {
        const eventId = event?.id ?? event?.sessionId;
        if (eventId !== id || event?.state !== 'closed') return;
        cleanup();
        reject(new Error(record.lastError || `WhatsApp transport closed before pairing was ready for ${id}`));
      };

      this.on('pairing-ready', onReady);
      this.on('session', onSession);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for WhatsApp pairing transport for ${id}`));
      }, this.pairingReadyTimeoutMs);
      timer.unref?.();

      if (record.pairingReady) {
        cleanup();
        resolve();
      }
    });
  }

  #scheduleReconnect(sessionId) {
    const record = this.#record(sessionId);
    if (record.reconnectTimer) return;
    const delayMs = Math.min(30_000, 1_500 * (2 ** Math.min(record.reconnects++, 4)));
    record.reconnectTimer = setTimeout(async () => {
      record.reconnectTimer = null;
      try { await this.connect(sessionId, { force: true }); }
      catch (error) { this.logger.error({ sessionId, err: error }, 'reconnect failed'); record.lastError = error.message; this.#scheduleReconnect(sessionId); }
    }, delayMs);
    record.reconnectTimer.unref?.();
  }

  async requestPairingCode(sessionId, phoneNumber) {
    const id = normalizeId(sessionId);
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 16) throw new Error('valid phone number required');

    await this.connect(id);
    const record = this.#record(id);
    if (record.registered) throw new Error(`Session ${id} is already paired`);

    await this.#waitForPairingReady(id);
    if (this.pairingSettleMs > 0) await delay(this.pairingSettleMs);

    if (record.registered) throw new Error(`Session ${id} became paired before code request`);
    const socket = record.socket;
    if (typeof socket?.requestPairingCode !== 'function') throw new Error('Baileys pairing-code API unavailable');
    return socket.requestPairingCode(digits);
  }

  async resolveUserJid(sessionId, jid) {
    const value = String(jid || '').trim();
    if (!value || !value.endsWith('@lid')) return value;
    const socket = this.#record(normalizeId(sessionId)).socket;
    if (typeof socket?.findUserId !== 'function') return value;
    try {
      const ids = await socket.findUserId(value);
      return ids?.phoneNumber || value;
    } catch {
      return value;
    }
  }

  getSocket(sessionId) { return this.#record(normalizeId(sessionId)).socket; }
  isRegistered(sessionId) { return Boolean(this.#record(normalizeId(sessionId)).registered); }
  hasStoredAuth(sessionId) { return fs.existsSync(path.join(this.authDir(sessionId), 'creds.json')); }

  clearAuth(sessionId) {
    const id = normalizeId(sessionId);
    fs.rmSync(this.authDir(id), { recursive: true, force: true });
    const record = this.#record(id); record.registered = false; record.qr = null; record.pairingReady = false;
  }

  async sendViaSession(sessionId, jid, content, options = {}) {
    const id = normalizeId(sessionId); const record = this.#record(id);
    if (!record.socket || record.state !== 'open') throw new Error(`Session ${id} is not connected`);
    return record.socket.sendMessage(jid, content, options);
  }

  async send(role, jid, content, options = {}) {
    const sessionId = this.roleManager?.resolve(role) ?? normalizeId(role);
    if (!sessionId) throw new Error(`No healthy WhatsApp session for role ${role}`);
    return this.sendViaSession(sessionId, jid, content, options);
  }

  async reconnect(sessionId) { return this.connect(sessionId, { force: true }); }

  async disconnect(sessionId) {
    const id = normalizeId(sessionId); const record = this.#record(id); record.generation += 1;
    if (record.reconnectTimer) clearTimeout(record.reconnectTimer); record.reconnectTimer = null;
    try { record.socket?.end?.(new Error('Night disconnect')); } catch {}
    try { record.socket?.ws?.close?.(); } catch {}
    record.socket = null; record.state = 'idle'; record.qr = null; record.connectedAt = null; record.pairingReady = false;
    this.roleManager?.markHealth(id, false); this.emit('session', this.sessionSnapshot(id));
  }

  async logout(sessionId) {
    const id = normalizeId(sessionId); const record = this.#record(id); record.generation += 1;
    if (record.reconnectTimer) clearTimeout(record.reconnectTimer); record.reconnectTimer = null;
    try { await record.socket?.logout?.(); } catch {}
    try { record.socket?.ws?.close?.(); } catch {}
    record.socket = null; record.state = 'idle'; record.registered = false; record.qr = null; record.connectedAt = null; record.pairingReady = false;
    this.roleManager?.markHealth(id, false); fs.rmSync(this.authDir(id), { recursive: true, force: true }); this.emit('session', this.sessionSnapshot(id));
  }

  sessionSnapshot(sessionId, { includeQr = false } = {}) {
    const r = this.#record(normalizeId(sessionId));
    return { id: r.id, state: r.state, registered: r.registered, reconnects: r.reconnects, connectedAt: r.connectedAt, lastError: r.lastError, ...(includeQr ? { qr: r.qr } : {}) };
  }

  snapshot() { return [...this.sessions.keys()].map(id => this.sessionSnapshot(id)); }
  async closeAll() { await Promise.allSettled([...this.sessions.keys()].map(id => this.disconnect(id))); }
}
