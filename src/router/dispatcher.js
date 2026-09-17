const commandPattern = /^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i;

export class MessageDispatcher {
  constructor({ registry, access, sessions, config, roleManager, ai = null, activity = null, features = null, logger = console } = {}) {
    this.registry = registry;
    this.access = access;
    this.sessions = sessions;
    this.config = config;
    this.roleManager = roleManager;
    this.ai = ai;
    this.activity = activity;
    this.features = features;
    this.logger = logger;
  }

  parse(text = '') {
    const match = String(text).trim().match(commandPattern);
    if (!match) return null;
    return {
      name: match[1].toLowerCase(),
      argsText: (match[2] || '').trim(),
      args: (match[2] || '').trim().split(/\s+/).filter(Boolean)
    };
  }

  async #senderFor(message) {
    let senderJid = message.senderJid || message.participantJid || message.chatJid;
    if (message.fromMe) {
      if (typeof this.sessions?.isBotSentMessage === 'function' && this.sessions.isBotSentMessage(message.sessionId, message.id)) {
        return { ignored: 'bot-output', senderJid: null };
      }
      let ownJid = typeof this.sessions?.sessionOwnJid === 'function'
        ? this.sessions.sessionOwnJid(message.sessionId)
        : senderJid;
      if (ownJid?.endsWith?.('@lid') && typeof this.sessions?.resolveUserJid === 'function') {
        ownJid = await this.sessions.resolveUserJid(message.sessionId, ownJid);
      }
      if (!this.access.isOwner(ownJid)) return { ignored: 'self-non-owner', senderJid: ownJid };
      senderJid = ownJid;
    } else if (senderJid?.endsWith?.('@lid') && typeof this.sessions?.resolveUserJid === 'function') {
      senderJid = await this.sessions.resolveUserJid(message.sessionId, senderJid);
    }
    return { ignored: null, senderJid };
  }

  async resolveSender(message) { return this.#senderFor(message); }

  async handle(message, raw = null) {
    if (!message || !message.chatJid) return { handled: false, reason: 'ignored' };
    const parsed = this.parse(message.text || '');
    if (!parsed) return { handled: false, reason: 'not-command' };

    const sender = await this.#senderFor(message);
    if (sender.ignored) return { handled: false, reason: sender.ignored };
    const senderJid = sender.senderJid;

    const command = this.registry.resolveCommand(parsed.name);
    const gate = this.access.canEnter({ chatJid: message.chatJid, senderJid, commandName: parsed.name });
    if (!gate.allowed) return { handled: true, executed: false, reason: gate.reason };
    if (!command) return { handled: true, executed: false, reason: 'command-not-found' };
    if (command.ownerOnly && !this.access.isOwner(senderJid)) return { handled: true, executed: false, reason: 'owner-only' };
    if (command.requiresAllowedChat && !this.access.isAllowed(message.chatJid)) return { handled: true, executed: false, reason: 'chat-disabled' };
    if (command.requiresAI && !this.config.get('AI_ENABLED', true)) return { handled: true, executed: false, reason: 'ai-disabled' };

    const reply = async content => {
      const payload = typeof content === 'string' ? { text: content } : content;
      return this.sessions.sendViaSession(message.sessionId, message.chatJid, payload, raw?.key ? { quoted: raw } : {});
    };

    const started = Date.now();
    try {
      const result = await command.execute({
        message, raw,
        args: parsed.args,
        argsText: parsed.argsText,
        senderJid,
        reply,
        access: this.access,
        sessions: this.sessions,
        config: this.config,
        roleManager: this.roleManager,
        registry: this.registry,
        ai: this.ai,
        activity: this.activity,
        features: this.features
      });
      this.activity?.logCommand?.({
        at: Date.now(), sessionId: message.sessionId, chatJid: message.chatJid, senderJid,
        name: command.name, input: parsed.argsText, success: true, durationMs: Date.now() - started
      });
      return { handled: true, executed: true, command: command.name, result };
    } catch (error) {
      this.activity?.logCommand?.({
        at: Date.now(), sessionId: message.sessionId, chatJid: message.chatJid, senderJid,
        name: command.name, input: parsed.argsText, output: error.message, success: false, durationMs: Date.now() - started
      });
      this.logger.error?.({ command: command.name, error }, 'command failed');
      try { await reply(`Command failed: ${error.message}`); } catch {}
      return { handled: true, executed: false, command: command.name, reason: 'command-error', error };
    }
  }
}
