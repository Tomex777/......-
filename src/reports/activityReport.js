import { renderTextPdf, activityLines } from './pdf.js';

function shortLine(row) {
  const time = new Date(Number(row.at || 0)).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  const kind = String(row.kind || 'event').toUpperCase();
  const name = row.name ? ` ${row.name}` : '';
  const status = row.success === false ? ' failed' : '';
  const provider = row.provider ? ` [${row.provider}]` : '';
  const input = String(row.input_text ?? '').replace(/\s+/g, ' ').trim();
  return `${time}  ${kind}${name}${provider}${status}${input ? ` — ${input.slice(0, 120)}` : ''}`;
}

export async function sendActivityReport({ activity, reply, kind = null, title = 'Night history', pdf = false, recentLimit = 25, pdfLimit = 5000 } = {}) {
  if (!activity) throw new Error('Activity store is unavailable');
  if (pdf) {
    const rows = activity.all({ kind, limit: pdfLimit });
    const buffer = await renderTextPdf({ title, lines: activityLines(rows), metadata: { Entries: rows.length } });
    await reply({ document: buffer, mimetype: 'application/pdf', fileName: `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'night-history'}.pdf` });
    return { count: rows.length, pdf: true };
  }
  const rows = activity.recent({ kind, limit: recentLimit });
  const lines = rows.length ? rows.map(shortLine) : ['No activity yet.'];
  await reply([title, '', ...lines].join('\n'));
  return { count: rows.length, pdf: false };
}
