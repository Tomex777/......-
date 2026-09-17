function fmtTop(rows = []) {
  if (!rows.length) return 'None yet';
  return rows.map((row, i) => `${i + 1}. .${row.name} — ${row.count}`).join('\n');
}

export default {
  name: 'usage',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'history',
  async execute({ args, activity, reply }) {
    if (!activity) throw new Error('Usage store is unavailable');
    const report = activity.usage();
    if (String(args?.[0] || '').toLowerCase() === 'pdf') {
      throw new Error('PDF export is not wired in this build yet. Use .usage for the live dashboard.');
    }
    const providers = report.providers?.length
      ? report.providers.map(x => `${x.provider}: ${x.count}`).join(', ')
      : 'None yet';
    await reply([
      'Night usage',
      '',
      `Total activity: ${report.total}`,
      `Commands: ${report.commands}`,
      `AI requests: ${report.ai}`,
      `Today: ${report.today}`,
      `AI providers: ${providers}`,
      '',
      'Top commands',
      fmtTop(report.topCommands)
    ].join('\n'));
    return report;
  }
};
