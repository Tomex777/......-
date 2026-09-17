import { sendActivityReport } from '../src/reports/activityReport.js';

export default {
  name: 'history',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: false,
  feature: 'history',
  async execute({ args, activity, reply }) {
    return sendActivityReport({ activity, reply, title: 'Night history', pdf: String(args?.[0] || '').toLowerCase() === 'pdf' });
  }
};
