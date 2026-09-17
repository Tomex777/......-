import { renderTextPdf, activityLines } from './pdf.js';
import { renderTableImage } from '../features/render.js';

function recentRows(rows = []) {
  return rows.map(row => {
    const date = new Date(Number(row.at || 0));
    const time = Number.isFinite(date.getTime())
      ? date.toLocaleString('en-NG', { dateStyle:'short', timeStyle:'short' })
      : 'Unknown';
    const kind = String(row.kind || 'event').toUpperCase();
    const name = String(row.name || '—');
    const provider = row.provider ? ` · ${row.provider}` : '';
    const status = row.success === false ? 'Failed' : 'OK';
    const input = String(row.input_text ?? row.output_text ?? '').replace(/\s+/g, ' ').trim();
    return {
      Time: time,
      Type: `${kind}${provider}`,
      Action: name,
      Status: status,
      Details: input ? input.slice(0, 90) : '—'
    };
  });
}

export async function sendActivityReport({ activity, reply, kind = null, title = 'Night history', pdf = false, recentLimit = 25 } = {}) {
  if (!activity) throw new Error('Activity store is unavailable');
  if (pdf) {
    const rows = activity.all({ kind });
    const buffer = await renderTextPdf({ title, lines: activityLines(rows), metadata: { Entries: rows.length } });
    await reply({ document: buffer, mimetype: 'application/pdf', fileName: `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'night-history'}.pdf` });
    return { count: rows.length, pdf: true, complete: true };
  }

  const rows = activity.recent({ kind, limit: recentLimit });
  if (!rows.length) {
    await reply('No activity yet.');
    return { count: 0, pdf: false, image: false };
  }
  const image = await renderTableImage({
    title: `${title} · latest ${rows.length}`,
    columns: ['Time','Type','Action','Status','Details'],
    rows: recentRows(rows)
  });
  await reply({ image, caption: `${title} — latest ${rows.length} entries. Use .${kind === 'command' ? 'cmdhistory' : kind === 'ai' ? 'aihistory' : 'history'} pdf for the full report.` });
  return { count: rows.length, pdf: false, image: true };
}
