const DEFAULT_ROLES = ['inbox', 'assistant', 'commands', 'media', 'status'];
const normalizeId = value => String(value || '').trim().toLowerCase();

export class SessionRoleManager {
  constructor({ sessions = ['main', 'assistant'], mode = 'split', inboxSession = 'main', aiSession = 'assistant', fallbackEnabled = true } = {}) {
    this.sessions = [...new Set(sessions.map(normalizeId).filter(Boolean))];
    this.mode = mode;
    this.inboxSession = normalizeId(inboxSession) || this.sessions[0] || 'main';
    this.aiSession = normalizeId(aiSession) || this.sessions[1] || this.inboxSession;
    this.fallbackEnabled = Boolean(fallbackEnabled);
    this.health = new Map(this.sessions.map(id => [id, false]));
    this.leases = new Map();
    this.#validate();
  }
  #validate() {
    if (!['split', 'main-all', 'assistant-all'].includes(this.mode)) throw new Error(`Invalid role mode: ${this.mode}`);
    for (const id of [this.inboxSession, this.aiSession]) if (!this.sessions.includes(id)) throw new Error(`Unknown WhatsApp session: ${id}`);
  }
  configure({ mode, inboxSession, aiSession, fallbackEnabled } = {}) {
    if (mode != null) this.mode = String(mode);
    if (inboxSession != null) this.inboxSession = normalizeId(inboxSession);
    if (aiSession != null) this.aiSession = normalizeId(aiSession);
    if (fallbackEnabled != null) this.fallbackEnabled = Boolean(fallbackEnabled);
    this.#validate(); this.releaseAllFallbacks(); return this.snapshotConfig();
  }
  preferred(role) {
    if (this.mode === 'main-all') return this.sessions[0] ?? null;
    if (this.mode === 'assistant-all') return this.sessions[1] ?? this.sessions[0] ?? null;
    return role === 'assistant' || role === 'commands' ? this.aiSession : this.inboxSession;
  }
  markHealth(sessionId, healthy) { const id = normalizeId(sessionId); if (!this.health.has(id)) this.health.set(id, false); this.health.set(id, Boolean(healthy)); }
  resolve(role) {
    const leased = this.leases.get(role); if (leased && this.health.get(leased)) return leased; if (leased) this.leases.delete(role);
    const preferred = this.preferred(role); if (preferred && this.health.get(preferred)) return preferred; if (!this.fallbackEnabled) return null;
    const fallback = this.sessions.find(id => id !== preferred && this.health.get(id)); if (!fallback) return null;
    this.leases.set(role, fallback); return fallback;
  }
  releaseFallback(role) { this.leases.delete(role); }
  releaseAllFallbacks() { this.leases.clear(); }
  snapshotConfig() { return { sessions: [...this.sessions], mode: this.mode, inboxSession: this.inboxSession, aiSession: this.aiSession, fallbackEnabled: this.fallbackEnabled }; }
  snapshot() { return { config: this.snapshotConfig(), roles: DEFAULT_ROLES.map(role => ({ role, preferred: this.preferred(role), active: this.resolve(role), fallback: this.leases.get(role) ?? null })), health: Object.fromEntries(this.health) }; }
}
