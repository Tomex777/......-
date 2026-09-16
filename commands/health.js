export default {
  name: 'health',
  aliases: ['bot'],
  ownerOnly: false,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'system',
  async execute({ sessions, roleManager, reply }) {
    const roles = roleManager.snapshot();
    const configured = roles?.config?.sessions ?? [];
    const states = configured.map(id => sessions.sessionSnapshot(id));
    const connected = states.filter(session => session.state === 'open').length;

    const lines = states.map(session => {
      if (session.state === 'open') return `${session.id}: connected`;
      if (session.registered || sessions.hasStoredAuth(session.id)) return `${session.id}: paired, reconnecting`;
      return `${session.id}: not paired`;
    });

    const text = [
      'Night is running.',
      ...lines,
      `${connected}/${configured.length} WhatsApp session(s) connected.`
    ].join('\n');

    await reply(text);
    return { sessions: states, roles };
  }
};
