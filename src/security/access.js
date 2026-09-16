const BOOTSTRAP_COMMANDS = new Set(['allow', 'disallow', 'allowed', 'groups']);

export class AccessController {
  constructor({ ownerNumber = '', allowedChats = [] } = {}) { this.ownerNumber = normalizeNumber(ownerNumber); this.allowedChats = new Set(allowedChats); }
  isOwner(senderJid = '') { return normalizeNumber(senderJid) === this.ownerNumber && Boolean(this.ownerNumber); }
  isAllowed(chatJid) { return this.allowedChats.has(chatJid); }
  allow(chatJid) { this.allowedChats.add(chatJid); }
  disallow(chatJid) { this.allowedChats.delete(chatJid); }
  list() { return [...this.allowedChats].sort(); }
  canEnter({ chatJid, senderJid, commandName = null }) {
    if (this.isAllowed(chatJid)) return { allowed: true, reason: 'chat-allowed' };
    const bootstrap = commandName && BOOTSTRAP_COMMANDS.has(String(commandName).replace(/^\./, '').toLowerCase());
    if (bootstrap && this.isOwner(senderJid)) return { allowed: true, reason: 'owner-bootstrap' };
    return { allowed: false, reason: 'chat-disabled' };
  }
}
export function normalizeNumber(value = '') { const bare = String(value).split('@')[0].split(':')[0]; return bare.replace(/\D/g, ''); }
