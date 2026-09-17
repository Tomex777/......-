import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const clip = (value,max=70) => { const s=String(value??''); return s.length>max?`${s.slice(0,max-1)}…`:s; };

export async function renderTableImage({title='Night',columns=[],rows=[]}={}) {
  const cols = columns.length ? columns : Object.keys(rows[0] || {});
  const safeRows = rows.slice(0,40);
  const width = Math.max(760, Math.min(1800, 220 + cols.length * 210));
  const pad=38, headerH=64, rowH=58, titleH=title?76:26;
  const height = Math.max(220, titleH + headerH + safeRows.length*rowH + pad);
  const colW=(width-pad*2)/Math.max(cols.length,1);
  const lines=[];
  lines.push(`<rect width="100%" height="100%" rx="24" fill="#f7f4ee"/>`);
  if(title) lines.push(`<text x="${pad}" y="48" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#111827">${esc(title)}</text>`);
  const y0=titleH;
  lines.push(`<rect x="${pad}" y="${y0}" width="${width-pad*2}" height="${headerH}" rx="14" fill="#111827"/>`);
  cols.forEach((c,i)=>lines.push(`<text x="${pad+i*colW+14}" y="${y0+40}" font-size="18" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${esc(clip(c,22))}</text>`));
  safeRows.forEach((row,r)=>{
    const y=y0+headerH+r*rowH;
    lines.push(`<rect x="${pad}" y="${y}" width="${width-pad*2}" height="${rowH}" fill="${r%2?'#eee9df':'#f7f4ee'}"/>`);
    cols.forEach((c,i)=>lines.push(`<text x="${pad+i*colW+14}" y="${y+36}" font-size="17" font-family="Arial, sans-serif" fill="#1f2937">${esc(clip(row?.[c]??'',28))}</text>`));
  });
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderTextPdf({title='Night Report',lines=[],sections=[]}={}) {
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:46,info:{Title:title,Author:'Night'}}); const chunks=[];
    doc.on('data',d=>chunks.push(d)); doc.on('error',reject); doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.fontSize(20).text(title,{align:'left'}).moveDown(0.8);
    for(const line of lines) doc.fontSize(10.5).fillColor('#111111').text(String(line),{lineGap:3});
    for(const section of sections){doc.moveDown(0.8).fontSize(14).fillColor('#111111').text(section.title||'');doc.moveDown(0.3);for(const row of section.rows||[])doc.fontSize(9.8).text(typeof row==='string'?row:Object.entries(row).map(([k,v])=>`${k}: ${v??''}`).join('  |  '),{lineGap:3});}
    doc.end();
  });
}

export async function renderTablePdf({title='Night Report',columns=[],rows=[]}={}) {
  const lines=rows.map(row=>columns.map(c=>`${c}: ${row?.[c]??''}`).join(' | '));
  return renderTextPdf({title,lines});
}
