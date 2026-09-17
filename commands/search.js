export default {
  name: 'search',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, message, senderJid, reply, ai }) {
    const query = String(argsText || '').trim();
    if (!query) throw new Error('Use .search <query>');
    if (!ai) throw new Error('AI service is unavailable');
    const result = await ai.search({ text: query, sessionId: message.sessionId, chatJid: message.chatJid, senderJid });
    await reply(result.text);
    return { provider: result.provider, model: result.model, usage: result.usage ?? null };
  }
};
