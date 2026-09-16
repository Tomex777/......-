const commandPattern = /^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i;

export class MessageDispatcher {
  constructor({ registry, access, sessions, config, roleManager, logger = console } = {}) {
    this.registry = registry; this.access = access; this.sessions = sessions; this.config = config; this.roleManager = roleManager; this.logger = logger;
  }
  parse(text = '') { const match = String(text).trim().match(commandPattern); if (!match) return null; return { name: match[1].toLowerCase(), argsText: (match[2] || '').trim(), args: (match[2] || '').trim().split(/\s+/).filter(Boolean) }; }
  async handle(message, raw = null) {
    if (!message || message.fromMe || !message.chatJid) return { handled: false, reason: 'ignored' };
    const parsed = this.parse(message.text || ''); if (!parsed) return { handled: false, reason: 'not-command' };
    const command = this.registry.resolveCommand(parsed.name);
    const gate = this.access.canEnter({ chatJid: message.chatJid, senderJid: message.participantJid || message.chatJid, commandName: parsed.name });
    if (!gate.allowed) return { handled: true, executed: false, reason: gate.reason };
    if (!command) return { handled: true, executed: false, reason: 'command-not-found' };
    const senderJid = message.participantJid || message.chatJid;
    if (command.ownerOnly && !this.access.isOwner(senderJid)) return { handled: true, executed: false, reason: 'owner-only' };
    if (command.requiresAllowedChat && !this.access.isAllowed(message.chatJid)) return { handled: true, executed: false, reason: 'chat-disabled' };
    if (command.requiresAI && !this.config.get('AI_ENABLED', true)) return { handled: true, executed: false, reason: 'ai-disabled' };
    const reply = async content => { const payload = typeof content === 'string' ? { text: content } : content; return this.sessions.sendViaSession(message.sessionId, message.chatJid, payload, raw?.key ? { quoted: raw } : {}); };
    try {
      const result = await command.execute({ message, raw, args: parsed.args, argsText: parsed.argsText, reply, access: this.access, sessions: this.sessions, config: this.config, roleManager: this.roleManager, registry: this.registry });
      return { handled: true, executed: true, command: command.name, result };
    } catch (error) {
      this.logger.error?.({ command: command.name, error }, 'command failed');
      try { await reply(`Command failed: ${error.message}`); } catch {}
      return { handled: true, executed: false, command: command.name, reason: 'command-error', error };
    }
  }
}
