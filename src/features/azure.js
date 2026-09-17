import { transcodeAudioToWav } from './media.js';

const trimSlash = value => String(value || '').replace(/\/+$/,'');

export class AzureFeatureClient {
  constructor({ config } = {}) { this.config=config; }

  speechRegion(){return this.config?.get?.('AZURE_SPEECH_REGION',this.config?.get?.('AZURE_CORE_REGION',''))||'';}
  speechKey(){return this.config?.get?.('AZURE_SPEECH_KEY',this.config?.get?.('AZURE_CORE_KEY',''))||'';}

  async transcribe(buffer,{language='en-NG'}={}){
    const region=this.speechRegion(); const key=this.speechKey();
    if(!region||!key) throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_REGION and AZURE_SPEECH_KEY.');
    const wav=await transcodeAudioToWav(buffer);
    const url=`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;
    const res=await fetch(url,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'audio/wav; codecs=audio/pcm; samplerate=16000','Accept':'application/json'},body:wav});
    const text=await res.text(); let data=null; try{data=JSON.parse(text);}catch{}
    if(!res.ok) throw new Error(`Azure Speech ${res.status}: ${data?.DisplayText||text.slice(0,500)}`);
    const out=data?.DisplayText||data?.NBest?.[0]?.Display||'';
    if(!out) throw new Error('Azure Speech returned no transcription.');
    return {text:out,raw:data};
  }

  async speak(text,{voice='en-NG-AbeoNeural'}={}){
    const region=this.speechRegion(); const key=this.speechKey();
    if(!region||!key) throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_REGION and AZURE_SPEECH_KEY.');
    const ssml=`<speak version="1.0" xml:lang="en-NG"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
    const res=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'Night'},body:ssml});
    if(!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0,500)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async vision(buffer,{features='read,caption,tags'}={}){
    const endpoint=trimSlash(this.config?.get?.('AZURE_VISION_ENDPOINT','')); const key=this.config?.get?.('AZURE_VISION_KEY','');
    if(!endpoint||!key) throw new Error('Azure Vision is not configured. Set AZURE_VISION_ENDPOINT and AZURE_VISION_KEY.');
    const url=`${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=${encodeURIComponent(features)}`;
    const res=await fetch(url,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/octet-stream'},body:buffer});
    const data=await res.json().catch(()=>null);
    if(!res.ok) throw new Error(`Azure Vision ${res.status}: ${JSON.stringify(data)?.slice(0,500)}`);
    const lines=(data?.readResult?.blocks||[]).flatMap(b=>b.lines||[]).map(x=>x.text).filter(Boolean);
    return {text:lines.join('\n'),caption:data?.captionResult?.text||'',tags:(data?.tagsResult?.values||[]).map(x=>x.name),raw:data};
  }

  async generateImage(prompt,{size='1024x1024'}={}){
    const endpoint=trimSlash(this.config?.get?.('AZURE_IMAGE_ENDPOINT','')); const key=this.config?.get?.('AZURE_IMAGE_KEY',''); const deployment=this.config?.get?.('AZURE_IMAGE_DEPLOYMENT','');
    if(!endpoint||!key||!deployment) throw new Error('Azure image generation is not configured.');
    const url=`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/generations?api-version=2025-04-01-preview`;
    const res=await fetch(url,{method:'POST',headers:{'api-key':key,'Content-Type':'application/json'},body:JSON.stringify({prompt:String(prompt),size,n:1,output_format:'png'})});
    const data=await res.json().catch(()=>null);
    if(!res.ok) throw new Error(`Azure Image ${res.status}: ${data?.error?.message||JSON.stringify(data)?.slice(0,500)}`);
    const item=data?.data?.[0];
    if(item?.b64_json) return Buffer.from(item.b64_json,'base64');
    if(item?.url){const dl=await fetch(item.url);if(!dl.ok)throw new Error(`Image download ${dl.status}`);return Buffer.from(await dl.arrayBuffer());}
    throw new Error('Azure Image returned no image.');
  }
}

function escapeXml(value){return String(value).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));}
