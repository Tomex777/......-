import { renderTextPdf } from '../src/reports/pdf.js';
import { renderTableImage } from '../src/features/render.js';

function linesFor(report) {
  const providers = report.providers?.length
    ? report.providers.map(x => `${x.provider}: ${x.count}`).join(', ')
    : 'None yet';
  return [
    `Total activity: ${report.total}`,
    `Commands: ${report.commands}`,
    `AI requests: ${report.ai}`,
    `Failures: ${report.failures}`,
    `Today: ${report.today}`,
    `AI providers: ${providers}`,
    '',
    '# Top commands',
    ...(report.topCommands?.length ? report.topCommands.map((row, i) => `${i + 1}. .${row.name} — ${row.count}`) : ['None yet'])
  ];
}

function imageRows(report) {
  const providers = report.providers?.length
    ? report.providers.map(x => `${x.provider} (${x.count})`).join(', ')
    : 'None yet';
  const rows = [
    { Metric:'Total activity', Value:String(report.total) },
    { Metric:'Commands', Value:String(report.commands) },
    { Metric:'AI requests', Value:String(report.ai) },
    { Metric:'Failures', Value:String(report.failures) },
    { Metric:'Today', Value:String(report.today) },
    { Metric:'AI providers', Value:providers }
  ];
  for (const [index,row] of (report.topCommands || []).slice(0,10).entries()) {
    rows.push({ Metric:`Top command #${index + 1}`, Value:`.${row.name} · ${row.count}` });
  }
  return rows;
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
      const buffer = await renderTextPdf({ title: 'Night usage report', lines: linesFor(report) });
      await reply({ document: buffer, mimetype: 'application/pdf', fileName: 'Night-Usage.pdf' });
      return { ...report, pdf: true };
    }

    const image = await renderTableImage({
      title: 'Night usage',
      columns: ['Metric','Value'],
      rows: imageRows(report)
    });
    await reply({ image, caption:'Night usage summary. Use .usage pdf for the detailed report.' });
    return { ...report, image: true };
  }
};
