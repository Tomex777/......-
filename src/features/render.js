import sharp from 'sharp';
import PDFDocument from 'pdfkit';

const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const wrap = (value, max = 34) => {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = []; let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= max) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
};

export async function renderTableImage({ title = 'Night', columns = [], rows = [], footer = null } = {}) {
  const cols = (columns || []).map(String);
  if (!cols.length) throw new Error('Table needs at least one column');
  const safeRows = (rows || []).slice(0, 80).map(row => Array.isArray(row) ? row : cols.map(c => row?.[c] ?? ''));
  const colWidth = Math.max(180, Math.min(340, Math.floor(1280 / cols.length)));
  const width = Math.max(720, Math.min(1800, colWidth * cols.length + 80));
  const contentWidth = width - 80;
  const actualCol = contentWidth / cols.length;
  const headerH = 58;
  const titleH = 94;
  const cellLine = 25;
  const rowHeights = safeRows.map(row => Math.max(54, ...row.map(v => wrap(v, Math.max(18, Math.floor(actualCol / 10))).length * cellLine + 22)));
  const height = Math.min(12000, titleH + headerH + rowHeights.reduce((a,b)=>a+b,0) + (footer ? 72 : 36));
  let y = titleH;
  const elements = [
    `<rect width="100%" height="100%" fill="#f8f4eb"/>`,
    `<text x="40" y="56" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" fill="#171717">${esc(title)}</text>`,
    `<line x1="40" y1="76" x2="${width-40}" y2="76" stroke="#d8d1c4" stroke-width="2"/>`
  ];
  cols.forEach((col,i)=>{
    const x = 40 + i * actualCol;
    elements.push(`<rect x="${x}" y="${y}" width="${actualCol}" height="${headerH}" fill="#eee7dc"/>`);
    elements.push(`<text x="${x+14}" y="${y+37}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="#202020">${esc(col)}</text>`);
  });
  y += headerH;
  safeRows.forEach((row,rowIndex)=>{
    const rh = rowHeights[rowIndex];
    const fill = rowIndex % 2 ? '#fbf8f2' : '#fffdf9';
    row.forEach((value,i)=>{
      const x = 40 + i * actualCol;
      elements.push(`<rect x="${x}" y="${y}" width="${actualCol}" height="${rh}" fill="${fill}" stroke="#e5dfd5" stroke-width="1"/>`);
      const lines = wrap(value, Math.max(18, Math.floor(actualCol / 10)));
      lines.forEach((line,j)=>elements.push(`<text x="${x+14}" y="${y+31+j*cellLine}" font-family="Arial,Helvetica,sans-serif" font-size="19" fill="#262626">${esc(line)}</text>`));
    });
    y += rh;
  });
  if (footer) elements.push(`<text x="40" y="${Math.min(height-24,y+42)}" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#6a655d">${esc(footer)}</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderStructuredPdf({ title = 'Night report', columns = [], rows = [], paragraphs = [], metadata = {} } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 46, info: { Title: title, Creator: 'Night' } });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise((resolve,reject)=>{ doc.on('end',()=>resolve(Buffer.concat(chunks))); doc.on('error',reject); });
  doc.fontSize(22).font('Helvetica-Bold').text(title);
  doc.moveDown(0.5);
  for (const [k,v] of Object.entries(metadata || {})) doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`${k}: ${v}`);
  doc.fillColor('#111111').moveDown(0.8);
  for (const paragraph of paragraphs || []) { doc.fontSize(11).font('Helvetica').text(String(paragraph), { lineGap: 3 }); doc.moveDown(0.5); }
  const cols = columns.map(String);
  if (cols.length && rows.length) {
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = usable / cols.length;
    const drawHeader = () => {
      const y = doc.y;
      cols.forEach((c,i)=>doc.font('Helvetica-Bold').fontSize(9).text(c, doc.page.margins.left + i*colW, y, { width: colW-8 }));
      doc.y = y + 30;
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width-doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.4);
    };
    drawHeader();
    for (const source of rows) {
      const row = Array.isArray(source) ? source : cols.map(c=>source?.[c] ?? '');
      const lines = row.map(v=>wrap(v,24).length);
      const rh = Math.max(28, Math.max(...lines)*13 + 8);
      if (doc.y + rh > doc.page.height - doc.page.margins.bottom) { doc.addPage(); drawHeader(); }
      const y = doc.y;
      row.forEach((v,i)=>doc.font('Helvetica').fontSize(8.5).fillColor('#222222').text(String(v ?? ''), doc.page.margins.left + i*colW, y, { width: colW-8, height: rh-4, ellipsis: true }));
      doc.y = y + rh;
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width-doc.page.margins.right, doc.y).strokeColor('#eeeeee').stroke();
      doc.moveDown(0.2);
    }
  }
  doc.end();
  return done;
}
