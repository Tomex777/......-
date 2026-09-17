import fs from 'node:fs';
import path from 'node:path';

const BOOTSTRAP_COMMANDS = new Set(['allow', 'disallow', 'allowed', 'groups', 'observe', 'unobserve', 'observed']);

export class AccessController {
  constructor({ ownerNumber = '', allowedChats = [], storagePath = path.resolve('data/access.json') } = {}) {
    this.ownerNumber = normalizeNumber(ownerNumber);
    this.storagePath = storagePath;
    this.allowedChats = new Set([...allowedChats, ...this.#readPersisted()]);
  }
  #readPersisted() { try { const parsed = JSON.parse(fs.readFileSync(this.storagePath, 'utf8')); return Array.isArray(parsed.allowedChats) ? parsed.allowedChats : []; } catch { return []; } }
  #persist() {
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true, mode: 0o700 });
    const tmp = `${this.storagePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ allowedChats: this.list() }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.storagePath);
    try { fs.chmodSync(this.storagePath, 0o600); } catch {}
  }
  isOwner(senderJid = '') { return normalizeNumber(senderJid) === this.ownerNumber && Boolean(this.ownerNumber); }
  isAllowed(chatJid) { return this.allowedChats.has(chatJid); }
  allow(chatJid) { if (!chatJid) throw new Error('chat JID required'); this.allowedChats.add(chatJid); this.#persist(); return true; }
  disallow(chatJid) { const changed = this.allowedChats.delete(chatJid); if (changed) this.#persist(); return changed; }
  list() { return [...this.allowedChats].sort(); }
  canEnter({ chatJid, senderJid, commandName = null }) {
    if (this.isAllowed(chatJid)) return { allowed: true, reason: 'chat-allowed' };
    const bootstrap = commandName && BOOTSTRAP_COMMANDS.has(String(commandName).replace(/^\./, '').toLowerCase());
    if (bootstrap && this.isOwner(senderJid)) return { allowed: true, reason: 'owner-bootstrap' };
    return { allowed: false, reason: 'chat-disabled' };
  }
}
export function normalizeNumber(value = '') { const bare = String(value).split('@')[0].split(':')[0]; return bare.replace(/\D/g, ''); }
