const DEFAULT_ROLES = ['inbox', 'assistant', 'commands', 'media', 'status'];
export class SessionRoleManager {
  constructor({ sessions = ['main', 'assistant'], mode = 'split', inboxSession = 'main', aiSession = 'assistant', fallbackEnabled = true } = {}) {
    this.sessions = [...new Set(sessions)]; this.mode = mode; this.inboxSession = inboxSession; this.aiSession = aiSession;
    this.fallbackEnabled = fallbackEnabled; this.health = new Map(this.sessions.map(id => [id, false])); this.leases = new Map();
  }
  preferred(role) { if (this.mode === 'main-all') return 'main'; if (this.mode === 'assistant-all') return 'assistant'; return role === 'assistant' || role === 'commands' ? this.aiSession : this.inboxSession; }
  markHealth(sessionId, healthy) { if (!this.health.has(sessionId)) this.health.set(sessionId, false); this.health.set(sessionId, Boolean(healthy)); }
  resolve(role) {
    const leased = this.leases.get(role); if (leased && this.health.get(leased)) return leased; if (leased) this.leases.delete(role);
    const preferred = this.preferred(role); if (this.health.get(preferred)) return preferred; if (!this.fallbackEnabled) return null;
    const fallback = this.sessions.find(id => id !== preferred && this.health.get(id)); if (!fallback) return null;
    this.leases.set(role, fallback); return fallback;
  }
  releaseFallback(role) { this.leases.delete(role); }
  releaseAllFallbacks() { this.leases.clear(); }
  snapshot() { return DEFAULT_ROLES.map(role => ({ role, preferred: this.preferred(role), active: this.resolve(role) })); }
}
