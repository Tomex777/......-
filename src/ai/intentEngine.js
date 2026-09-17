import { quotedText } from '../features/media.js';
import { NightAgent } from './agent.js';

function wantsPdf(text){return /\b(pdf|document)\b/i.test(text);}
function comparison(text){return /\b(compare|comparison|versus|\bvs\.?\b|difference between)\b/i.test(text);}
function cleanAfter(text,re){return String(text).replace(re,'').trim();}
function extractJson(text){const raw=String(text||'').trim();const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||raw;const start=fenced.indexOf('{'),end=fenced.lastIndexOf('}');if(start<0||end<start)return null;try{return JSON.parse(fenced.slice(start,end+1));}catch{return null;}}

function capabilityLike(text){
  return /\b(?:pinterest|gif|sticker|voice note|text[- ]?to[- ]?speech|tts|transcrib|ocr|status|remind|reminder|qr(?: code)?|meme|anime|manga|save (?:this|that)|saved (?:item|message|file)|recent saves?|note\b|todo\b|task\b|chess|trivia|hangman|word ?chain|would you rather|read (?:this|that) aloud|say (?:this|that) as (?:audio|a voice note))\b/i.test(text);
}

function payloadFromAgentOutput(output){
  if(output==null)return null;
  if(typeof output==='string')return{text:output};
  if(output.kind==='image')return{image:output.buffer,caption:output.caption||''};
  if(output.kind==='image-url')return{image:{url:output.url},caption:output.caption||''};
  if(output.kind==='sticker')return{sticker:output.buffer};
  if(output.kind==='audio')return{audio:output.buffer,mimetype:output.mimetype||'audio/mpeg',ptt:Boolean(output.ptt)};
  if(output.kind==='gif')return{video:{url:output.url},gifPlayback:true,caption:output.caption||''};
  if(output.kind==='video')return{video:output.buffer,mimetype:output.mimetype||'video/mp4',caption:output.caption||''};
  if(output.kind==='document')return{document:output.buffer,mimetype:output.mimetype||'application/pdf',fileName:output.fileName||'Night-document.pdf'};
  return{text:JSON.stringify(output,null,2)};
}

export class IntentEngine {
  constructor({ai,features,sessions,logger=console}={}){this.ai=ai;this.features=features;this.sessions=sessions;this.logger=logger;this.agent=new NightAgent({ai,features,logger});}

  async handle({text,message,raw,senderJid}){
    const input=String(text||'').trim();if(!input)return null;
    const ctx={sessionId:message.sessionId,chatJid:message.chatJid,senderJid};

    if(/\b(workflow|and then|then after|after that|do all of (?:this|these)|first .+ then)\b/i.test(input)){
      const r=await this.agent.run({request:input,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,raw});
      const payload=payloadFromAgentOutput(r.output);
      if(payload)return{payload,intent:'workflow'};
    }
    if(/\b(make|turn|convert).{0,18}(this|that).{0,12}sticker\b/i.test(input)||/^sticker\b/i.test(input)){const sticker=await this.features.sticker(raw);return{payload:{sticker},intent:'sticker'};}
    if(/\b(transcribe|what (?:does|did) (?:this|that) (?:voice|audio|video)|voice note says)\b/i.test(input)){const r=await this.features.transcribe(raw);return{payload:{text:r.text},intent:'transcribe'};}
    if(/\b(ocr|extract (?:the )?text|read (?:the )?(?:text|image|screenshot))\b/i.test(input)){const r=await this.features.vision(raw);return{payload:{text:r.text||r.caption||'No text found.'},intent:'ocr'};}
    if(/\b(describe|what(?:'s| is) in) (?:this|that) (?:image|photo|picture|screenshot)\b/i.test(input)){const r=await this.features.vision(raw);return{payload:{text:[r.caption,r.tags?.length?`Tags: ${r.tags.join(', ')}`:''].filter(Boolean).join('\n')||'No description available.'},intent:'vision'};}
    if(/\btranslate (?:this|that)\b/i.test(input)){const q=quotedText(raw);if(q){const r=await this.ai.translate({...ctx,text:q});return{payload:{text:r.text},intent:'translate'};}}
    if(/\bsummar(?:ize|ise) (?:this|that)\b/i.test(input)){const q=quotedText(raw);if(q){const r=await this.ai.summarize({...ctx,text:q});return{payload:{text:r.text},intent:'summarize'};}}
    if(/\b(post|put|upload).{0,20}(?:status|whatsapp status)\b/i.test(input)){await this.features.postStatus({sessionId:message.sessionId,text:cleanAfter(input,/^(?:please\s+)?(?:post|put|upload)\s+/i)||null,raw});return{payload:{text:'Status posted.'},intent:'status'};}
    if(/\bremind me\b/i.test(input)){const request=cleanAfter(input,/^.*?remind me\s*/i);const r=await this.features.reminder({text:request,sessionId:message.sessionId,chatJid:message.chatJid});return{payload:{text:`Reminder set for ${new Date(r.dueAt).toLocaleString('en-NG')}: ${r.text}`},intent:'reminder'};}
    if(/\b(?:make|create|generate) (?:a )?qr(?: code)?\b/i.test(input)){const value=cleanAfter(input,/^.*?(?:qr(?: code)?)\s*(?:for|of|with)?\s*/i);if(value){const image=await this.features.qr(value);return{payload:{image,caption:value},intent:'qr'};}}
    if(/\b(?:generate|create|make|draw) (?:an? )?(?:image|picture|illustration)\b/i.test(input)){const prompt=cleanAfter(input,/^.*?(?:image|picture|illustration)\s*(?:of|for|showing)?\s*/i)||input;const image=await this.features.image(prompt);return{payload:{image,caption:prompt},intent:'image.generate'};}
    if(/\bdark meme\b/i.test(input)){const rows=await this.features.memes(true);if(rows.length){const x=rows[Math.floor(Math.random()*rows.length)];return{payload:{image:{url:x.url},caption:x.title},intent:'darkmeme'};}}
    if(/\b(?:send|show|give me|find) (?:a )?meme\b/i.test(input)){const rows=await this.features.memes(false);if(rows.length){const x=rows[Math.floor(Math.random()*rows.length)];return{payload:{image:{url:x.url},caption:x.title},intent:'meme'};}}
    if(/\b(?:trending|popular|airing|recent) anime\b/i.test(input)){const mode=(input.match(/\b(trending|popular|airing|recent)\b/i)?.[1]||'trending').toLowerCase();const rows=await this.features.anime(mode,'');return{payload:{text:rows.map((x,i)=>`${i+1}. ${x.title}${x.score?` — ${x.score}/10`:''}`).join('\n')||'No anime found.'},intent:'anime'};}
    if(/\b(?:trending|popular|recent) manga\b/i.test(input)){const mode=(input.match(/\b(trending|popular|recent)\b/i)?.[1]||'trending').toLowerCase();const rows=await this.features.manga(mode,'');return{payload:{text:rows.map((x,i)=>`${i+1}. ${x.title}${x.score?` — ${x.score}/10`:''}`).join('\n')||'No manga found.'},intent:'manga'};}
    if(/\b(search|look up|find online|search the (?:web|internet))\b/i.test(input)){const r=await this.ai.search({...ctx,text:input});return{payload:{text:r.text},intent:'web.search'};}
    if(comparison(input)){
      let research='';
      if(typeof this.ai.search==='function'){
        try{
          const found=await this.ai.search({...ctx,text:`Research the facts needed for this comparison: ${input}. Prefer current authoritative specifications and clearly distinguish unavailable or unconfirmed facts.`,remember:false});
          research=String(found?.text||'').trim();
        }catch(error){
          this.logger.warn?.({err:error.message},'comparison web research failed; using model knowledge');
        }
      }
      const grounding=research?`\n\nWeb research to ground the comparison:\n${research.slice(0,18000)}`:'';
      const r=await this.ai.ask({...ctx,text:`Create a factual comparison for this request: ${input}${grounding}\n\nReturn JSON only in this shape: {"title":"...","columns":["Item","..."] ,"rows":[{"Item":"..."}]}. Use the research above when supplied. Do not invent missing specifications. Keep the table concise and readable.`,remember:false,complexity:.55});
      const spec=extractJson(r.text);
      if(spec?.columns?.length&&Array.isArray(spec.rows)){
        if(wantsPdf(input)){
          const pdf=await this.features.tablePdf(spec);
          return{payload:{document:pdf,mimetype:'application/pdf',fileName:'Night-comparison.pdf'},intent:'table.pdf'};
        }
        const image=await this.features.table(spec);
        return{payload:{image,caption:spec.title||'Comparison'},intent:'table.image'};
      }
    }

    if(capabilityLike(input)){
      try{
        const r=await this.agent.run({request:input,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,raw});
        const payload=payloadFromAgentOutput(r.output);
        if(payload)return{payload,intent:`agent.${r.trace?.map(x=>x.type).join('+')||'capability'}`};
      }catch(error){
        this.logger.warn?.({err:error.message,intentText:input.slice(0,160)},'capability intent planning failed');
      }
    }
    return null;
  }
}
