import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

function firstMedia(message = {}) {
  const types = [
    ['image', message.imageMessage], ['video', message.videoMessage], ['audio', message.audioMessage],
    ['sticker', message.stickerMessage], ['document', message.documentMessage]
  ];
  return types.find(([,node]) => node) || [null,null];
}

export function quotedEnvelope(raw) {
  const m = raw?.message ?? {};
  const carrier = m.extendedTextMessage ?? m.imageMessage ?? m.videoMessage ?? m.documentMessage ?? m.audioMessage ?? m.stickerMessage ?? {};
  const q = carrier?.contextInfo?.quotedMessage ?? null;
  if (!q) return null;
  return { message: q, key: { remoteJid: raw?.key?.remoteJid, id: carrier?.contextInfo?.stanzaId, participant: carrier?.contextInfo?.participant } };
}

export function quotedText(raw) {
  const q = quotedEnvelope(raw)?.message;
  if (!q) return '';
  return String(q.conversation ?? q.extendedTextMessage?.text ?? q.imageMessage?.caption ?? q.videoMessage?.caption ?? q.documentMessage?.caption ?? '').trim();
}

export async function downloadQuotedMedia(raw) {
  const quoted = quotedEnvelope(raw);
  if (!quoted) throw new Error('Reply to a media message first.');
  const [kind,node] = firstMedia(quoted.message);
  if (!node) throw new Error('The replied message does not contain supported media.');
  const { downloadContentFromMessage } = await import('@itsliaaa/baileys');
  const streamType = kind === 'sticker' ? 'sticker' : kind;
  const stream = await downloadContentFromMessage(node, streamType);
  const chunks=[];
  for await (const chunk of stream) chunks.push(chunk);
  const buffer=Buffer.concat(chunks);
  if(!buffer.length) throw new Error('Could not download that media.');
  return { buffer, kind, mimetype: node.mimetype || null, fileName: node.fileName || null, node };
}

function runFfmpeg(args,input) {
  if(!ffmpegPath) throw new Error('ffmpeg is unavailable in this build');
  return new Promise((resolve,reject)=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'night-media-'));
    const inFile=path.join(dir,'input'); const outFile=path.join(dir,'output');
    fs.writeFileSync(inFile,input);
    const proc=spawn(ffmpegPath,args(inFile,outFile),{stdio:['ignore','ignore','pipe']});
    let err=''; proc.stderr.on('data',d=>err+=d);
    proc.on('error',reject);
    proc.on('close',code=>{try{if(code!==0)throw new Error(err.slice(-1200)||`ffmpeg exited ${code}`);const out=fs.readFileSync(outFile);resolve(out);}catch(e){reject(e);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
  });
}

export async function toSticker({buffer,kind}) {
  if(kind==='image' || kind==='sticker') {
    return sharp(buffer,{animated:true}).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  }
  if(kind==='video' || kind==='audio') {
    return runFfmpeg((input,output)=>['-y','-i',input,'-t','6','-vf','fps=15,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000','-loop','0','-an','-vcodec','libwebp','-lossless','0','-q:v','70','-preset','picture','-f','webp',output],buffer);
  }
  throw new Error('Only images, stickers and short videos can be converted to stickers.');
}

export async function stickerToImage(buffer){return sharp(buffer,{animated:false}).png().toBuffer();}
export async function resizeImage(buffer,{width=1080,height=null}={}){return sharp(buffer).resize({width:Number(width)||1080,height:height?Number(height):undefined,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();}
export async function compressImage(buffer){return sharp(buffer).jpeg({quality:72,mozjpeg:true}).toBuffer();}
export async function redactImage(buffer,{left=0,top=0,width=100,height=100}={}){
  const img=sharp(buffer); const meta=await img.metadata();
  const w=Math.max(1,Math.min(Number(width)||100,(meta.width||1)-Number(left))); const h=Math.max(1,Math.min(Number(height)||100,(meta.height||1)-Number(top)));
  const patch=await sharp({create:{width:w,height:h,channels:4,background:{r:20,g:20,b:20,alpha:1}}}).png().toBuffer();
  return img.composite([{input:patch,left:Number(left)||0,top:Number(top)||0}]).png().toBuffer();
}

export async function transcodeAudioToWav(buffer){return runFfmpeg((input,output)=>['-y','-i',input,'-ac','1','-ar','16000','-f','wav',output],buffer);}
export async function transcodeToMp4(buffer){return runFfmpeg((input,output)=>['-y','-i',input,'-movflags','+faststart','-pix_fmt','yuv420p','-c:v','libx264','-c:a','aac','-f','mp4',output],buffer);}
