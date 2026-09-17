import { sendActivityReport } from '../src/reports/activityReport.js';

export default {
  name: 'aihistory',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'history',
  async execute({ args, activity, reply }) {
    return sendActivityReport({ activity, reply, kind: 'ai', title: 'Night AI history', pdf: String(args?.[0] || '').toLowerCase() === 'pdf' });
  }
};
