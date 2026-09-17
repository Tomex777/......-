import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import PDFDocument from 'pdfkit';

const MEDIA_TYPES = new Map([
  ['imageMessage', 'image'], ['videoMessage', 'video'], ['audioMessage', 'audio'],
  ['documentMessage', 'document'], ['stickerMessage', 'sticker']
]);
const WRAPPERS = ['ephemeralMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','documentWithCaptionMessage'];

function unwrap(message = {}) {
  let node = message;
  let guard = 0;
  while (node && guard++ < 10) {
    const key = WRAPPERS.find(k => node?.[k]?.message);
    if (!key) break;
    node = node[key].message;
  }
  return node || {};
}

function currentNode(raw) { return unwrap(raw?.message ?? {}); }
function currentPayload(raw) {
  const node = currentNode(raw);
  const type = Object.keys(node)[0] ?? null;
  return { container: node, type, payload: type ? node[type] : null };
}

export function quotedMessage(raw) {
  const { container, payload } = currentPayload(raw);
  const candidates = [payload?.contextInfo, ...Object.values(container || {}).map(x => x?.contextInfo).filter(Boolean)];
  for (const info of candidates) if (info?.quotedMessage) return unwrap(info.quotedMessage);
  return null;
}

export function mediaDescriptor(raw, { preferQuoted = true } = {}) {
  const q = quotedMessage(raw);
  const candidates = preferQuoted && q ? [q, currentNode(raw)] : [currentNode(raw), q].filter(Boolean);
  for (const container of candidates) {
    const type = Object.keys(container || {}).find(k => MEDIA_TYPES.has(k));
    if (!type) continue;
    const payload = container[type];
    return {
      type,
      kind: MEDIA_TYPES.get(type),
      payload,
      mimeType: payload?.mimetype || null,
      fileName: payload?.fileName || null,
      seconds: Number(payload?.seconds || 0) || null,
      quoted: container === q
    };
  }
  return null;
}

export async function downloadMessageMedia(raw, options = {}) {
  const desc = mediaDescriptor(raw, options);
  if (!desc) throw new Error('Reply to an image, video, audio, document or sticker, or send the command as its caption.');
  const { downloadContentFromMessage } = await import('@itsliaaa/baileys');
  const stream = await downloadContentFromMessage(desc.payload, desc.kind);
  const chunks = [];
  let size = 0;
  const maxBytes = Number(options.maxBytes || 64 * 1024 * 1024);
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error(`Media exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    chunks.push(buffer);
  }
  return { ...desc, buffer: Buffer.concat(chunks) };
}

function tempFile(ext = 'bin') {
  const dir = path.join(os.tmpdir(), 'night-media');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${String(ext).replace(/^\./, '')}`);
}

function runFfmpeg(args, { timeoutMs = 90000 } = {}) {
  if (!ffmpegPath) throw new Error('FFmpeg binary is unavailable');
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 8000) stderr = stderr.slice(-8000); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Media conversion timed out')); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

function extensionForMime(mime = '', fallback = 'bin') {
  const value = String(mime).toLowerCase().split(';')[0];
  return ({
    'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif',
    'video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/ogg':'ogg','audio/mp4':'m4a',
    'application/pdf':'pdf','text/plain':'txt'
  })[value] || fallback;
}

export async function imageToSticker(buffer) {
  return sharp(buffer, { animated: true }).rotate().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 }).toBuffer();
}

export async function videoToSticker(buffer, mimeType = 'video/mp4') {
  const input = tempFile(extensionForMime(mimeType, 'mp4'));
  const output = tempFile('webp');
  try {
    fs.writeFileSync(input, buffer);
    await runFfmpeg(['-i', input, '-t', '8', '-vf', "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000", '-vcodec', 'libwebp', '-lossless', '0', '-q:v', '65', '-loop', '0', '-an', output]);
    return fs.readFileSync(output);
  } finally { try { fs.rmSync(input, { force: true }); } catch {} try { fs.rmSync(output, { force: true }); } catch {} }
}

export async function stickerToImage(buffer) {
  return sharp(buffer, { animated: false }).png().toBuffer();
}

export async function convertImage(buffer, { format = 'png', quality = 82, width = null, height = null, grayscale = false, scan = false } = {}) {
  let image = sharp(buffer).rotate();
  if (width || height) image = image.resize(width ? Number(width) : null, height ? Number(height) : null, { fit: 'inside', withoutEnlargement: false });
  if (grayscale || scan) image = image.grayscale();
  if (scan) image = image.normalize().sharpen().threshold(185);
  const f = String(format || 'png').toLowerCase();
  if (f === 'jpg' || f === 'jpeg') return { buffer: await image.jpeg({ quality: Number(quality) || 82, mozjpeg: true }).toBuffer(), mimeType: 'image/jpeg', ext: 'jpg' };
  if (f === 'webp') return { buffer: await image.webp({ quality: Number(quality) || 82 }).toBuffer(), mimeType: 'image/webp', ext: 'webp' };
  return { buffer: await image.png({ compressionLevel: 9 }).toBuffer(), mimeType: 'image/png', ext: 'png' };
}

export async function transcode(buffer, { inputMime = 'video/mp4', mode = 'video', start = null, duration = null } = {}) {
  const input = tempFile(extensionForMime(inputMime, mode === 'audio' ? 'm4a' : 'mp4'));
  const outputExt = mode === 'audio' ? 'mp3' : mode === 'gif' ? 'gif' : 'mp4';
  const output = tempFile(outputExt);
  try {
    fs.writeFileSync(input, buffer);
    const args = [];
    if (start != null) args.push('-ss', String(start));
    args.push('-i', input);
    if (duration != null) args.push('-t', String(duration));
    if (mode === 'audio') args.push('-vn', '-c:a', 'libmp3lame', '-b:a', '160k');
    else if (mode === 'gif') args.push('-vf', 'fps=12,scale=720:-1:flags=lanczos', '-loop', '0');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
    args.push(output);
    await runFfmpeg(args);
    return { buffer: fs.readFileSync(output), mimeType: mode === 'audio' ? 'audio/mpeg' : mode === 'gif' ? 'image/gif' : 'video/mp4', ext: outputExt };
  } finally { try { fs.rmSync(input, { force: true }); } catch {} try { fs.rmSync(output, { force: true }); } catch {} }
}

export async function imagesToPdf(images = [], { title = 'Night document' } = {}) {
  if (!images.length) throw new Error('No images supplied');
  const doc = new PDFDocument({ autoFirstPage: false, margin: 24, info: { Title: title, Creator: 'Night' } });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  for (const item of images) {
    const img = sharp(item.buffer).rotate();
    const meta = await img.metadata();
    const normalized = await img.jpeg({ quality: 88 }).toBuffer();
    const w = Number(meta.width || 1200), h = Number(meta.height || 1600);
    const page = w > h ? [842, 595] : [595, 842];
    doc.addPage({ size: page, margin: 24 });
    doc.image(normalized, 24, 24, { fit: [page[0] - 48, page[1] - 48], align: 'center', valign: 'center' });
  }
  doc.end();
  return done;
}

export async function createQr(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('QR content is empty');
  return QRCode.toBuffer(value, { type: 'png', width: 768, margin: 2, errorCorrectionLevel: 'M' });
}

export async function readQr(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
  if (!code?.data) throw new Error('No QR code found in the image');
  return code.data;
}

export async function saveMediaBuffer(buffer, { directory = path.resolve('data/library/files'), extension = 'bin' } = {}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${String(extension).replace(/^\./,'')}`);
  fs.writeFileSync(file, buffer, { mode: 0o600 });
  return file;
}

export function extensionFromMedia(desc) {
  return extensionForMime(desc?.mimeType, desc?.kind === 'image' ? 'jpg' : desc?.kind === 'video' ? 'mp4' : desc?.kind === 'audio' ? 'ogg' : desc?.kind === 'sticker' ? 'webp' : 'bin');
}
