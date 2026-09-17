function clean(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E\n\r\t]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text, width = 92) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word.length <= width ? word : word.slice(0, width);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function renderTextPdf({ title = 'Night Report', lines = [] } = {}) {
  const allLines = [String(title), '', ...lines.flatMap(line => wrapLine(line))];
  const perPage = 50;
  const pages = [];
  for (let i = 0; i < allLines.length; i += perPage) pages.push(allLines.slice(i, i + perPage));
  if (!pages.length) pages.push([String(title)]);

  const objects = new Map();
  const pageRefs = [];
  let nextId = 4;
  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageRefs.push(`${pageId} 0 R`);
    const streamLines = pageLines.map((line, index) => {
      const fontSize = index === 0 ? 15 : 10;
      return `${fontSize} Tf (${clean(line)}) Tj T*`;
    });
    const stream = `BT\n/F1 10 Tf\n50 790 Td\n13 TL\n${streamLines.join('\n')}\nET`;
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
  }

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const maxId = Math.max(...objects.keys());
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = Buffer.byteLength(out);
    out += `${id} 0 obj\n${objects.get(id) || '<<>>'}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${maxId + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let id = 1; id <= maxId; id += 1) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'binary');
}
