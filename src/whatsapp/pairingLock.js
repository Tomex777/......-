import crypto from 'node:crypto';
export class PairingAttemptLock {
  constructor() { this.active = new Map(); }
  claim(sessionId, method) { const id = String(sessionId).toLowerCase(); if (this.active.has(id)) return null; const token = crypto.randomUUID(); this.active.set(id, { token, method, startedAt: Date.now() }); return token; }
  release(sessionId, token) { const id = String(sessionId).toLowerCase(); const current = this.active.get(id); if (!current || current.token !== token) return false; this.active.delete(id); return true; }
  get(sessionId) { return this.active.get(String(sessionId).toLowerCase()) ?? null; }
}
