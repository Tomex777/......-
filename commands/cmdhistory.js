import { sendActivityReport } from '../src/reports/activityReport.js';

export default {
  name: 'cmdhistory',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'history',
  async execute({ args, activity, reply }) {
    return sendActivityReport({ activity, reply, kind: 'command', title: 'Night command history', pdf: String(args?.[0] || '').toLowerCase() === 'pdf' });
  }
};
