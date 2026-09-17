import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const trimSlash = value => String(value || '').replace(/\/+$/, '');
const temp = ext => path.join(os.tmpdir(), `night-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`);

function ensureFetch(fetchImpl) { if (typeof fetchImpl !== 'function') throw new Error('fetch() is unavailable'); }
function asError(prefix, response, text) {
  let detail = String(text || '').slice(0, 1200);
  try { const parsed = JSON.parse(text); detail = parsed?.error?.message || parsed?.message || detail; } catch {}
  return new Error(`${prefix} ${response.status}: ${detail || response.statusText || 'request failed'}`);
}

function runFfmpeg(args, timeoutMs = 60000) {
  if (!ffmpegPath) throw new Error('FFmpeg is unavailable');
  return new Promise((resolve,reject)=>{
    const child = spawn(ffmpegPath, ['-hide_banner','-loglevel','error','-y',...args], { stdio:['ignore','ignore','pipe'] });
    let err = '';
    child.stderr.on('data', c => { err += c.toString(); if (err.length > 5000) err = err.slice(-5000); });
    const timer = setTimeout(()=>{ child.kill('SIGKILL'); reject(new Error('Audio preparation timed out')); }, timeoutMs);
    child.on('error', e=>{ clearTimeout(timer); reject(e); });
    child.on('close', code=>{ clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.trim() || `FFmpeg exited ${code}`)); });
  });
}

async function toSpeechWav(buffer, mimeType = 'audio/ogg') {
  const ext = /mpeg|mp3/i.test(mimeType) ? 'mp3' : /mp4|m4a/i.test(mimeType) ? 'm4a' : /wav/i.test(mimeType) ? 'wav' : /webm/i.test(mimeType) ? 'webm' : 'ogg';
  const input = temp(ext), output = temp('wav');
  try {
    fs.writeFileSync(input, buffer);
    await runFfmpeg(['-i',input,'-ac','1','-ar','16000','-c:a','pcm_s16le',output]);
    return fs.readFileSync(output);
  } finally { try { fs.rmSync(input,{force:true}); } catch {} try { fs.rmSync(output,{force:true}); } catch {} }
}

export class AzureSpeechService {
  constructor({ config, fetchImpl = globalThis.fetch } = {}) { this.config = config; this.fetchImpl = fetchImpl; }
  key() { return String(this.config?.get?.('AZURE_SPEECH_KEY', this.config?.get?.('AZURE_CORE_KEY', '')) || '').trim(); }
  region() { return String(this.config?.get?.('AZURE_SPEECH_REGION', this.config?.get?.('AZURE_CORE_REGION', '')) || '').trim(); }
  configured() { return Boolean(this.key() && this.region()); }

  async transcribe(buffer, { mimeType = 'audio/ogg', language = null } = {}) {
    ensureFetch(this.fetchImpl);
    if (!this.configured()) throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    const lang = String(language || this.config.get('AZURE_SPEECH_LANGUAGE','en-NG'));
    const wav = await toSpeechWav(buffer, mimeType);
    const url = `https://${this.region()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(lang)}&format=detailed`;
    const response = await this.fetchImpl(url, { method:'POST', headers:{ 'Ocp-Apim-Subscription-Key':this.key(), 'Content-Type':'audio/wav; codecs=audio/pcm; samplerate=16000', Accept:'application/json' }, body:wav });
    const text = await response.text();
    if (!response.ok) throw asError('Azure Speech', response, text);
    let data; try { data = JSON.parse(text); } catch { throw new Error('Azure Speech returned invalid JSON'); }
    const result = data?.NBest?.[0]?.Display || data?.DisplayText || data?.NBest?.[0]?.Lexical || '';
    if (!String(result).trim()) throw new Error(`Azure Speech returned no transcript (${data?.RecognitionStatus || 'unknown status'})`);
    return { text:String(result).trim(), raw:data, language:lang };
  }

  async speak(text, { voice = null, language = null } = {}) {
    ensureFetch(this.fetchImpl);
    if (!this.configured()) throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    const lang = String(language || this.config.get('AZURE_SPEECH_LANGUAGE','en-NG'));
    const voiceName = String(voice || this.config.get('AZURE_TTS_VOICE','en-NG-EzinneNeural'));
    const escaped = String(text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voiceName}">${escaped}</voice></speak>`;
    const url = `https://${this.region()}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await this.fetchImpl(url, { method:'POST', headers:{ 'Ocp-Apim-Subscription-Key':this.key(), 'Content-Type':'application/ssml+xml', 'X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3', 'User-Agent':'Night' }, body:ssml });
    if (!response.ok) throw asError('Azure TTS', response, await response.text());
    return { buffer:Buffer.from(await response.arrayBuffer()), mimeType:'audio/mpeg', voice:voiceName, language:lang };
  }
}

export class AzureVisionService {
  constructor({ config, fetchImpl = globalThis.fetch } = {}) { this.config=config; this.fetchImpl=fetchImpl; }
  endpoint() { return trimSlash(this.config?.get?.('AZURE_VISION_ENDPOINT', this.config?.get?.('AZURE_CORE_ENDPOINT',''))); }
  key() { return String(this.config?.get?.('AZURE_VISION_KEY', this.config?.get?.('AZURE_CORE_KEY','')) || '').trim(); }
  configured() { return Boolean(this.endpoint() && this.key()); }

  async analyze(buffer, { features = ['Read','Caption'] } = {}) {
    ensureFetch(this.fetchImpl);
    if (!this.configured()) throw new Error('Azure Vision is not configured. Set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY.');
    const query = encodeURIComponent(features.join(','));
    const url = `${this.endpoint()}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=${query}&language=en&gender-neutral-caption=true`;
    const response = await this.fetchImpl(url, { method:'POST', headers:{ 'Ocp-Apim-Subscription-Key':this.key(), 'Content-Type':'application/octet-stream' }, body:buffer });
    const text = await response.text();
    if (!response.ok) throw asError('Azure Vision', response, text);
    let data; try { data=JSON.parse(text); } catch { throw new Error('Azure Vision returned invalid JSON'); }
    const readBlocks = data?.readResult?.blocks || [];
    const ocr = readBlocks.flatMap(block => block?.lines || []).map(line=>line?.text).filter(Boolean).join('\n');
    const caption = data?.captionResult?.text || data?.denseCaptionsResult?.values?.[0]?.text || '';
    return { ocr, caption, raw:data };
  }
}

export class AzureImageService {
  constructor({ config, fetchImpl = globalThis.fetch } = {}) { this.config=config; this.fetchImpl=fetchImpl; }
  endpoint() { return trimSlash(this.config?.get?.('AZURE_IMAGE_ENDPOINT','')); }
  key() { return String(this.config?.get?.('AZURE_IMAGE_KEY','') || '').trim(); }
  deployment() { return String(this.config?.get?.('AZURE_IMAGE_DEPLOYMENT','') || '').trim(); }
  configured() { return Boolean(this.endpoint() && this.key() && this.deployment()); }

  async generate(prompt, { size = '1024x1024', quality = 'medium' } = {}) {
    ensureFetch(this.fetchImpl);
    if (!this.configured()) throw new Error('Azure image generation is not configured. Set AZURE_IMAGE_ENDPOINT, AZURE_IMAGE_KEY and AZURE_IMAGE_DEPLOYMENT.');
    const version = String(this.config.get('AZURE_IMAGE_API_VERSION','2025-04-01-preview'));
    const endpoint = this.endpoint();
    const isFull = /\/images\/generations(?:\?|$)/i.test(endpoint);
    const url = isFull ? endpoint : `${endpoint}/openai/deployments/${encodeURIComponent(this.deployment())}/images/generations?api-version=${encodeURIComponent(version)}`;
    const response = await this.fetchImpl(url, { method:'POST', headers:{ 'api-key':this.key(), 'Content-Type':'application/json' }, body:JSON.stringify({ prompt:String(prompt), n:1, size, quality, output_format:'png' }) });
    const text = await response.text();
    if (!response.ok) throw asError('Azure Image', response, text);
    let data; try { data=JSON.parse(text); } catch { throw new Error('Azure Image returned invalid JSON'); }
    const item = data?.data?.[0] || data?.result?.data?.[0] || {};
    if (item.b64_json) return { buffer:Buffer.from(item.b64_json,'base64'), mimeType:'image/png', revisedPrompt:item.revised_prompt || null };
    if (item.url) {
      const imageResponse = await this.fetchImpl(item.url);
      if (!imageResponse.ok) throw new Error(`Generated image download failed: ${imageResponse.status}`);
      return { buffer:Buffer.from(await imageResponse.arrayBuffer()), mimeType:imageResponse.headers.get('content-type') || 'image/png', revisedPrompt:item.revised_prompt || null };
    }
    throw new Error('Azure Image returned no image data');
  }
}
