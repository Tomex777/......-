export default {
  name: 'allowed',
  ownerOnly: true,
  requiresAllowedChat: false,
  requiresAI: false,
  feature: 'access',
  async execute({ access, sessions, message, reply }) {
    const items = access.list();
    if (!items.length) {
      await reply('No chats are enabled.');
      return [];
    }

    const rows = [];
    for (const jid of items) {
      let label = jid;
      try { label = await sessions.describeChat(message.sessionId, jid); } catch {}
      rows.push(label || jid);
    }

    await reply(`Allowed chats:\n${rows.join('\n')}`);
    return rows;
  }
};
