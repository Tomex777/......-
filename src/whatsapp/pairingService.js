import { EventEmitter } from 'node:events';
import { PairingAttemptLock } from './pairingLock.js';

const normalizeId = value => String(value || '').trim().toLowerCase();
const ACTIVE = new Set(['starting', 'waiting']);

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
      if (attempt?.method === 'qr' && ACTIVE.has(attempt.status)) {
        attempt.qr = event.qr;
        attempt.status = 'waiting';
        attempt.updatedAt = Date.now();
        this.emit('update', this.snapshot(event.sessionId));
      }
    });

    sessions.on('session', event => {
      const id = event.id ?? event.sessionId;
      if (event.state === 'open') this.#finish(id, 'paired');
      this.emit('update', this.snapshot(id));
    });
  }

  #assertSession(sessionId) {
    const id = normalizeId(sessionId);
    if (!id || (this.allowedSessions.size && !this.allowedSessions.has(id))) {
      throw new Error(`Unknown WhatsApp session: ${id || sessionId}`);
    }
    return id;
  }

  async #prepare(sessionId, { replaceExisting = false } = {}) {
    const id = this.#assertSession(sessionId);
    const currentAttempt = this.attempts.get(id);

    if (currentAttempt && ACTIVE.has(currentAttempt.status)) {
      await this.cancel(id);
    }

    if (this.sessions.isRegistered(id)) {
      if (!replaceExisting) throw new Error(`Session ${id} is already paired`);
      await this.sessions.logout(id);
    } else if (this.sessions.sessionSnapshot(id).state !== 'idle') {
      await this.sessions.disconnect(id);
      this.sessions.clearAuth?.(id);
    }

    return id;
  }

  #begin(sessionId, method) {
    const token = this.lock.claim(sessionId, method);
    if (!token) throw new Error(`Pairing already active for ${sessionId}`);

    const now = Date.now();
    const attempt = {
      sessionId,
      method,
      token,
      status: 'starting',
      startedAt: now,
      updatedAt: now,
      expiresAt: now + this.attemptTtlMs,
      code: null,
      qr: null,
      error: null
    };

    this.attempts.set(sessionId, attempt);
    attempt.timer = setTimeout(async () => {
      this.#finish(sessionId, 'expired');
      try {
        await this.sessions.disconnect(sessionId);
        if (!this.sessions.isRegistered(sessionId)) this.sessions.clearAuth?.(sessionId);
      } catch {}
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

  async #fail(attempt, error) {
    attempt.error = error.message;
    this.#finish(attempt.sessionId, 'failed');
    try {
      await this.sessions.disconnect(attempt.sessionId);
      if (!this.sessions.isRegistered(attempt.sessionId)) this.sessions.clearAuth?.(attempt.sessionId);
    } catch {}
    throw error;
  }

  async startCode(sessionId, phoneNumber, { replaceExisting = false } = {}) {
    const id = await this.#prepare(sessionId, { replaceExisting });
    const attempt = this.#begin(id, 'code');

    try {
      const code = await this.sessions.requestPairingCode(id, phoneNumber);
      attempt.code = code;
      attempt.status = 'waiting';
      attempt.updatedAt = Date.now();
      this.emit('update', this.snapshot(id));
      return this.snapshot(id);
    } catch (error) {
      return this.#fail(attempt, error);
    }
  }

  async startQr(sessionId, { replaceExisting = false } = {}) {
    const id = await this.#prepare(sessionId, { replaceExisting });
    const attempt = this.#begin(id, 'qr');

    try {
      await this.sessions.connect(id, { force: true });
      attempt.status = 'waiting';
      attempt.updatedAt = Date.now();
      const current = this.sessions.sessionSnapshot(id, { includeQr: true });
      if (current.qr) attempt.qr = current.qr;
      this.emit('update', this.snapshot(id));
      return this.snapshot(id);
    } catch (error) {
      return this.#fail(attempt, error);
    }
  }

  async cancel(sessionId) {
    const id = this.#assertSession(sessionId);
    const attempt = this.attempts.get(id);
    if (!attempt || !ACTIVE.has(attempt.status)) return false;

    this.#finish(id, 'cancelled');
    await this.sessions.disconnect(id);
    if (!this.sessions.isRegistered(id)) this.sessions.clearAuth?.(id);
    return true;
  }

  snapshot(sessionId) {
    const id = this.#assertSession(sessionId);
    const attempt = this.attempts.get(id);
    const session = this.sessions.sessionSnapshot(id, { includeQr: true });
    const active = Boolean(attempt && ACTIVE.has(attempt.status));

    return {
      sessionId: id,
      registered: session.registered,
      connection: session.state,
      method: active ? attempt.method : null,
      status: session.registered ? 'paired' : attempt?.status ?? 'idle',
      startedAt: active ? attempt.startedAt : null,
      updatedAt: attempt?.updatedAt ?? null,
      expiresAt: active ? attempt.expiresAt : null,
      code: active && attempt.method === 'code' ? attempt.code : null,
      qr: active && attempt.method === 'qr' ? (attempt.qr ?? session.qr ?? null) : null,
      error: attempt?.error ?? session.lastError ?? null,
      canPair: !session.registered,
      canRepair: session.registered,
      canReplaceAttempt: active
    };
  }

  all() { return [...this.allowedSessions].map(id => this.snapshot(id)); }
}
