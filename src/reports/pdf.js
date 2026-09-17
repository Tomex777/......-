import PDFDocument from 'pdfkit';

export async function renderTextPdf({ title = 'Night report', lines = [], metadata = null } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title, Creator: 'Night' } });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(18).text(title);
  doc.moveDown(0.35);
  doc.font('Helvetica').fontSize(9).fillColor('#666666').text(new Date().toISOString());
  doc.fillColor('#000000').moveDown();

  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      doc.font('Helvetica-Bold').fontSize(10).text(`${key}: `, { continued: true });
      doc.font('Helvetica').text(String(value ?? ''));
    }
    doc.moveDown();
  }

  for (const line of lines) {
    const text = String(line ?? '');
    if (!text) {
      doc.moveDown(0.45);
      continue;
    }
    if (text.startsWith('# ')) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(13).text(text.slice(2));
      doc.font('Helvetica').fontSize(10);
      continue;
    }
    doc.font('Helvetica').fontSize(9.5).text(text, { lineGap: 2 });
  }

  doc.end();
  return done;
}

export function activityLines(rows = []) {
  return rows.map(row => {
    const when = new Date(Number(row.at || 0)).toISOString();
    const kind = String(row.kind || 'event').toUpperCase();
    const name = row.name ? ` ${row.name}` : '';
    const provider = row.provider ? ` [${row.provider}${row.model ? `/${row.model}` : ''}]` : '';
    const status = row.success === false ? ' FAILED' : '';
    const input = String(row.input_text ?? '').replace(/\s+/g, ' ').trim();
    const output = String(row.output_text ?? '').replace(/\s+/g, ' ').trim();
    const summary = input || output;
    return `${when} | ${kind}${name}${provider}${status}${summary ? ` | ${summary.slice(0, 500)}` : ''}`;
  });
}
