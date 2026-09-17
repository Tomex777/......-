export default {
  name: 'guide',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, message, senderJid, reply, ai }) {
    const text = String(argsText || '').trim();
    if (!text) throw new Error('Use .guide <what you want Night to do>');
    const result = await ai.ask({
      text,
      sessionId: message.sessionId,
      chatJid: message.chatJid,
      senderJid,
      remember: false,
      complexity: 0.3,
      system: 'Act as Night feature guide. Point the owner to the best existing command or natural-language capability. Clearly say when a capability is planned but not wired yet. Do not invent commands.'
    });
    await reply(result.text);
    return { provider: result.provider, model: result.model };
  }
};
