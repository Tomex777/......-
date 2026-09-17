function quotedText(raw) {
  const m = raw?.message ?? {};
  const node = m.extendedTextMessage ?? m.imageMessage ?? m.videoMessage ?? m.documentMessage ?? {};
  const q = node?.contextInfo?.quotedMessage ?? null;
  if (!q) return '';
  return String(q.conversation ?? q.extendedTextMessage?.text ?? q.imageMessage?.caption ?? q.videoMessage?.caption ?? q.documentMessage?.caption ?? '').trim();
}

export default {
  name: 'summarize',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, raw, message, senderJid, reply, ai }) {
    const text = String(argsText || '').trim() || quotedText(raw);
    if (!text) throw new Error('Send text after .summarize or reply to a text message with .summarize');
    const result = await ai.summarize({ text, sessionId: message.sessionId, chatJid: message.chatJid, senderJid });
    await reply(result.text);
    return { provider: result.provider, model: result.model };
  }
};
