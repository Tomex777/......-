export default {
  name: 'ask',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, message, senderJid, reply, ai }) {
    const prompt = String(argsText || '').trim();
    if (!prompt) throw new Error('Use .ask <message>');
    if (!ai) throw new Error('AI service is unavailable');
    const result = await ai.ask({ text: prompt, sessionId: message.sessionId, chatJid: message.chatJid, senderJid, complexity: 0.45 });
    await reply(result.text);
    return { provider: result.provider, model: result.model, usage: result.usage ?? null };
  }
};
