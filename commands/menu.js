const LABELS = {
  access: 'Access',
  system: 'System',
  ai: 'AI',
  history: 'History',
  media: 'Media',
  storage: 'Storage',
  games: 'Games',
  content: 'Content'
};

export default {
  name: 'menu',
  aliases: [],
  ownerOnly: false,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'system',
  async execute({ registry, reply }) {
    const commands = registry.snapshot().filter(item => item.name !== 'menu');
    const groups = new Map();
    for (const item of commands) {
      const key = item.feature || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(`.${item.name}`);
    }
    const preferred = ['system', 'access', 'ai', 'history', 'media', 'storage', 'content', 'games', 'other'];
    const lines = ['Night menu'];
    for (const key of preferred) {
      const items = groups.get(key);
      if (!items?.length) continue;
      lines.push('', `${LABELS[key] || 'Other'}`, items.sort().join('  '));
    }
    lines.push('', 'Use .guide <what you want to do> if you are not sure which command to use.');
    await reply(lines.join('\n'));
    return { count: commands.length };
  }
};
