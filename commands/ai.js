export default {
  name: 'ai',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'ai',
  async execute({ args, argsText, message, reply, config, ai }) {
    const sub = String(args?.[0] || '').toLowerCase();
    if (!sub) {
      const status = ai?.status?.() ?? {};
      await reply([
        `AI: ${status.enabled ? 'on' : 'off'}`,
        `Route: ${status.route || config.get('AI_DEFAULT_ROUTE', 'auto')}`,
        `Groq: ${status.groqConfigured ? 'configured' : 'not configured'}`,
        `Model: ${status.groqModel || config.get('GROQ_MODEL', 'openai/gpt-oss-120b')}`,
        `Search: ${status.groqSearchModel || config.get('GROQ_SEARCH_MODEL', 'groq/compound-mini')}`
      ].join('\n'));
      return status;
    }

    if (sub === 'on' || sub === 'off') {
      const enabled = sub === 'on';
      config.setRuntime('AI_ENABLED', enabled);
      await reply(`Night AI is ${enabled ? 'on' : 'off'}.`);
      return { enabled };
    }

    if (sub === 'model') {
      const value = argsText.slice(argsText.toLowerCase().indexOf('model') + 5).trim();
      if (!value) throw new Error('Use .ai model <model name>');
      if (['groq', 'phi', 'deepseek', 'auto'].includes(value.toLowerCase())) {
        config.setRuntime('AI_DEFAULT_ROUTE', value.toLowerCase());
        await reply(`AI route set to ${value.toLowerCase()}.`);
        return { route: value.toLowerCase() };
      }
      config.setRuntime('GROQ_MODEL', value);
      config.setRuntime('AI_DEFAULT_ROUTE', 'groq');
      await reply(`Groq model set to ${value}.`);
      return { route: 'groq', model: value };
    }

    if (sub === 'clear') {
      ai?.clear?.({ sessionId: message.sessionId, chatJid: message.chatJid });
      await reply('AI conversation context cleared for this chat.');
      return { cleared: true };
    }

    throw new Error('Use .ai, .ai on, .ai off, .ai model <name>, or .ai clear');
  }
};
