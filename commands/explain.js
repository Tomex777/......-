export default {
  name: 'explain',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, message, senderJid, reply, ai }) {
    const text = String(argsText || '').trim();
    if (!text) throw new Error('Use .explain <text or topic>');
    const result = await ai.explain({ text, sessionId: message.sessionId, chatJid: message.chatJid, senderJid });
    await reply(result.text);
    return { provider: result.provider, model: result.model };
  }
};
