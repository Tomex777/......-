export default {
  name: 'rewrite',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, message, senderJid, reply, ai }) {
    const text = String(argsText || '').trim();
    if (!text) throw new Error('Use .rewrite <text or instruction>');
    const result = await ai.rewrite({ text, sessionId: message.sessionId, chatJid: message.chatJid, senderJid });
    await reply(result.text);
    return { provider: result.provider, model: result.model };
  }
};
