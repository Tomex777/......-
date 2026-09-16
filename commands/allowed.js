export default {
  name: 'allowed',
  ownerOnly: true,
  requiresAllowedChat: false,
  requiresAI: false,
  feature: 'access',
  async execute({ access, reply }) {
    const items = access.list();
    const text = items.length ? items.join('\n') : 'No chats are enabled.';
    await reply(text);
    return items;
  }
};
