import { downloadQuotedMedia } from './media.js';

export async function extractDocument(raw) {
  const media = await downloadQuotedMedia(raw);
  if (media.kind !== 'document') throw new Error('Reply to a PDF, DOCX, or text document.');
  const mime = String(media.mimetype || '').toLowerCase();
  const name = String(media.fileName || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    const mod = await import('pdf-parse');
    const parse = mod.default || mod;
    const out = await parse(media.buffer);
    return { text: String(out?.text || '').trim(), pages: out?.numpages || null, kind: 'pdf', fileName: media.fileName };
  }
  if (mime.includes('wordprocessingml') || name.endsWith('.docx')) {
    const mod = await import('mammoth');
    const out = await mod.extractRawText({ buffer: media.buffer });
    return { text: String(out?.value || '').trim(), pages: null, kind: 'docx', fileName: media.fileName };
  }
  if (mime.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(name)) {
    return { text: media.buffer.toString('utf8').trim(), pages: null, kind: 'text', fileName: media.fileName };
  }
  throw new Error(`Unsupported document type: ${media.mimetype || media.fileName || 'unknown'}`);
}
