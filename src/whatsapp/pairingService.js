import { EventEmitter } from 'node:events';
import { PairingAttemptLock } from './pairingLock.js';

const normalizeId = value => String(value || '').trim().toLowerCase();

export class PairingService extends EventEmitter {
  constructor({ sessions, allowedSessions = [], attemptTtlMs = 5 * 60_000 } = {}) {
    super();
    if (!sessions) throw new Error('sessions manager required');
    this.sessions = sessions;
    this.allowedSessions = new Set(allowedSessions.map(normalizeId));
    this.attemptTtlMs = attemptTtlMs;
    this.lock = new PairingAttemptLock();
    this.attempts = new Map();

    sessions.on('qr', event => {
      const attempt = this.attempts.get(event.sessionId);
      if (attempt?.method === 'qr') {
        attempt.qr = event.qr;
        attempt.updatedAt = Date.now();
        this.emit('update', this.snapshot(event.sessionId));
      }
    });
    sessions.on('session', event => {
      if (event.state === 'open') this.#finish(event.id ?? event.sessionId, 'paired');
      this.emit('update', this.snapshot(event.id ?? event.sessionId));
    });
  }

  #assertSession(sessionId) {
    const id = normalizeId(sessionId);
    if (!id || (this.allowedSessions.size && !this.allowedSessions.has(id))) throw new Error(`Unknown WhatsApp session: ${id || sessionId}`);
    return id;
  }

  #start(sessionId, method) {
    const id = this.#assertSession(sessionId);
    if (this.sessions.isRegistered(id)) throw new Error(`Session ${id} is already paired`);
    const token = this.lock.claim(id, method);
    if (!token) throw new Error(`Pairing already active for ${id}`);
    const now = Date.now();
    const attempt = { sessionId: id, method, token, status: 'starting', startedAt: now, updatedAt: now, expiresAt: now + this.attemptTtlMs, code: null, qr: null, error: null };
    this.attempts.set(id, attempt);
    attempt.timer = setTimeout(() => {
      this.#finish(id, 'expired');
      Promise.resolve(this.sessions.disconnect(id)).finally(() => this.sessions.clearAuth?.(id)).catch(() => {});
    }, this.attemptTtlMs);
    attempt.timer.unref?.();
    return attempt;
  }

  #finish(sessionId, status) {
    const id = normalizeId(sessionId);
    const attempt = this.attempts.get(id);
    if (!attempt) return false;
    if (attempt.timer) clearTimeout(attempt.timer);
    attempt.timer = null;
    attempt.status = status;
    attempt.updatedAt = Date.now();
    this.lock.release(id, attempt.token);
    this.emit('update', this.snapshot(id));
    return true;
  }

  async startCode(sessionId, phoneNumber) {
    const attempt = this.#start(sessionId, 'code');
    try {
      const code = await this.sessions.requestPairingCode(attempt.sessionId, phoneNumber);
      attempt.code = code;
      attempt.status = 'waiting';
      attempt.updatedAt = Date.now();
      this.emit('update', this.snapshot(attempt.sessionId));
      return this.snapshot(attempt.sessionId);
    } catch (error) {
      attempt.error = error.message;
      this.#finish(attempt.sessionId, 'failed');
      throw error;
    }
  }

  async startQr(sessionId) {
    const attempt = this.#start(sessionId, 'qr');
    try {
      await this.sessions.connect(attempt.sessionId, { force: true });
      attempt.status = 'waiting';
      attempt.updatedAt = Date.now();
      const current = this.sessions.sessionSnapshot(attempt.sessionId, { includeQr: true });
      if (current.qr) attempt.qr = current.qr;
      this.emit('update', this.snapshot(attempt.sessionId));
      return this.snapshot(attempt.sessionId);
    } catch (error) {
      attempt.error = error.message;
      this.#finish(attempt.sessionId, 'failed');
      throw error;
    }
  }

  async cancel(sessionId) {
    const id = this.#assertSession(sessionId);
    const attempt = this.attempts.get(id);
    if (!attempt) return false;
    this.#finish(id, 'cancelled');
    await this.sessions.disconnect(id);
    this.sessions.clearAuth?.(id);
    return true;
  }

  snapshot(sessionId) {
    const id = this.#assertSession(sessionId);
    const attempt = this.attempts.get(id);
    const session = this.sessions.sessionSnapshot(id, { includeQr: true });
    return {
      sessionId: id,
      registered: session.registered,
      connection: session.state,
      method: attempt?.method ?? null,
      status: session.registered ? 'paired' : attempt?.status ?? 'idle',
      startedAt: attempt?.startedAt ?? null,
      updatedAt: attempt?.updatedAt ?? null,
      expiresAt: attempt?.expiresAt ?? null,
      code: attempt?.status === 'waiting' ? attempt.code : null,
      qr: attempt?.status === 'waiting' ? (attempt.qr ?? session.qr ?? null) : null,
      error: attempt?.error ?? session.lastError ?? null
    };
  }

  all() { return [...this.allowedSessions].map(id => this.snapshot(id)); }
}
