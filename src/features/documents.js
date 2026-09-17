import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

function mime(value='') { return String(value).toLowerCase().split(';')[0]; }

export class DocumentService {
  constructor({ vision = null } = {}) { this.vision = vision; }

  async extract(buffer, { mimeType = '', fileName = '' } = {}) {
    const type = mime(mimeType);
    const name = String(fileName || '').toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      const parsed = await pdfParse(buffer);
      return { text:String(parsed?.text || '').trim(), pages:Number(parsed?.numpages || 0), type:'pdf', metadata:parsed?.info || null };
    }
    if (type.includes('wordprocessingml') || name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return { text:String(result?.value || '').trim(), type:'docx', warnings:result?.messages || [] };
    }
    if (type.startsWith('text/') || /\.(txt|md|csv|json|xml|html?)$/i.test(name)) {
      return { text:buffer.toString('utf8').trim(), type:type || 'text/plain' };
    }
    if (type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name)) {
      if (!this.vision) throw new Error('Image document OCR service is unavailable');
      const result = await this.vision.analyze(buffer, { features:['Read','Caption'] });
      return { text:result.ocr || result.caption || '', type:'image', caption:result.caption || null };
    }
    throw new Error(`Unsupported document type${type ? `: ${type}` : ''}`);
  }
}
